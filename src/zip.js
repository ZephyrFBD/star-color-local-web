const ZIP32_MAX = 0xffffffff;
const ZIP16_MAX = 0xffff;
const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function dosDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

function view(size) {
  const bytes = new Uint8Array(size);
  return { bytes, data: new DataView(bytes.buffer) };
}

function zip64OffsetExtra(offset) {
  const { bytes, data } = view(12);
  data.setUint16(0, 0x0001, true);
  data.setUint16(2, 8, true);
  data.setBigUint64(4, BigInt(offset), true);
  return bytes;
}

async function crc32(blob, onChunk) {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const byte of value) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
    onChunk?.(value.byteLength);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, stamp) {
  const { bytes, data } = view(30 + name.byteLength);
  data.setUint32(0, 0x04034b50, true);
  data.setUint16(4, 20, true);
  data.setUint16(6, 0x0808, true); // UTF-8 plus trailing data descriptor.
  data.setUint16(8, 0, true); // Stored: PNG is already compressed.
  data.setUint16(10, stamp.time, true);
  data.setUint16(12, stamp.date, true);
  data.setUint16(26, name.byteLength, true);
  bytes.set(name, 30);
  return bytes;
}

function dataDescriptor(crc, size) {
  const { bytes, data } = view(16);
  data.setUint32(0, 0x08074b50, true);
  data.setUint32(4, crc, true);
  data.setUint32(8, size, true);
  data.setUint32(12, size, true);
  return bytes;
}

function centralHeader(entry) {
  const largeOffset = entry.offset > ZIP32_MAX;
  const extra = largeOffset ? zip64OffsetExtra(entry.offset) : new Uint8Array();
  const { bytes, data } = view(46 + entry.name.byteLength + extra.byteLength);
  data.setUint32(0, 0x02014b50, true);
  data.setUint16(4, largeOffset ? 45 : 20, true);
  data.setUint16(6, largeOffset ? 45 : 20, true);
  data.setUint16(8, 0x0808, true);
  data.setUint16(10, 0, true);
  data.setUint16(12, entry.stamp.time, true);
  data.setUint16(14, entry.stamp.date, true);
  data.setUint32(16, entry.crc, true);
  data.setUint32(20, entry.size, true);
  data.setUint32(24, entry.size, true);
  data.setUint16(28, entry.name.byteLength, true);
  data.setUint16(30, extra.byteLength, true);
  data.setUint32(42, largeOffset ? ZIP32_MAX : entry.offset, true);
  bytes.set(entry.name, 46);
  bytes.set(extra, 46 + entry.name.byteLength);
  return bytes;
}

function endRecords(entries, centralSize, centralOffset) {
  const needsZip64 = entries > ZIP16_MAX || centralSize > ZIP32_MAX || centralOffset > ZIP32_MAX;
  const parts = [];
  if (needsZip64) {
    const zip64Offset = centralOffset + centralSize;
    const zip64 = view(56);
    zip64.data.setUint32(0, 0x06064b50, true);
    zip64.data.setBigUint64(4, 44n, true);
    zip64.data.setUint16(12, 45, true);
    zip64.data.setUint16(14, 45, true);
    zip64.data.setBigUint64(24, BigInt(entries), true);
    zip64.data.setBigUint64(32, BigInt(entries), true);
    zip64.data.setBigUint64(40, BigInt(centralSize), true);
    zip64.data.setBigUint64(48, BigInt(centralOffset), true);
    const locator = view(20);
    locator.data.setUint32(0, 0x07064b50, true);
    locator.data.setBigUint64(8, BigInt(zip64Offset), true);
    locator.data.setUint32(16, 1, true);
    parts.push(zip64.bytes, locator.bytes);
  }
  const end = view(22);
  end.data.setUint32(0, 0x06054b50, true);
  end.data.setUint16(8, Math.min(entries, ZIP16_MAX), true);
  end.data.setUint16(10, Math.min(entries, ZIP16_MAX), true);
  end.data.setUint32(12, Math.min(centralSize, ZIP32_MAX), true);
  end.data.setUint32(16, Math.min(centralOffset, ZIP32_MAX), true);
  parts.push(end.bytes);
  return parts;
}

export async function createStoredZip(entries, onProgress) {
  if (!entries.length) throw new Error("No files are available for ZIP download");
  if (entries.length > Number.MAX_SAFE_INTEGER) throw new Error("Too many ZIP entries");
  const totalBytes = entries.reduce((sum, entry) => sum + entry.blob.size, 0);
  const parts = [];
  const directory = [];
  let offset = 0;
  let processedBytes = 0;
  let completed = 0;
  for (const entry of entries) {
    if (entry.blob.size > ZIP32_MAX) throw new Error(`A single file exceeds the 4 GB ZIP entry limit: ${entry.name}`);
    const name = encoder.encode(entry.name.replaceAll("\\", "/"));
    const stamp = dosDateTime(entry.date);
    const header = localHeader(name, stamp);
    const crc = await crc32(entry.blob, (bytes) => {
      processedBytes += bytes;
      onProgress?.({ completed, total: entries.length, processedBytes, totalBytes, name: entry.name });
    });
    const descriptor = dataDescriptor(crc, entry.blob.size);
    parts.push(header, entry.blob, descriptor);
    directory.push({ name, stamp, crc, size: entry.blob.size, offset });
    offset += header.byteLength + entry.blob.size + descriptor.byteLength;
    completed++;
    onProgress?.({ completed, total: entries.length, processedBytes, totalBytes, name: entry.name });
  }
  const centralOffset = offset;
  const centralParts = directory.map(centralHeader);
  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  parts.push(...centralParts, ...endRecords(entries.length, centralSize, centralOffset));
  return new Blob(parts, { type: "application/zip" });
}
