const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const SDR_WHITE_NITS = 203;
const PQ_MAX_NITS = 10_000;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function ascii(value) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function crc32(parts) {
  let crc = 0xffffffff;
  for (const part of parts) for (const byte of part) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, false);
  return bytes;
}

function chunk(type, data) {
  const name = ascii(type);
  return new Blob([uint32(data.byteLength), name, data, uint32(crc32([name, data]))]);
}

function pqCode(linearValue) {
  const m1 = 2610 / 16384;
  const m2 = 2523 / 32;
  const c1 = 3424 / 4096;
  const c2 = 2413 / 128;
  const c3 = 2392 / 128;
  const normalized = Math.max(0, Math.min(1, linearValue * SDR_WHITE_NITS / PQ_MAX_NITS));
  const powered = Math.pow(normalized, m1);
  const encoded = Math.pow((c1 + c2 * powered) / (1 + c3 * powered), m2);
  return Math.max(0, Math.min(65535, Math.round(encoded * 65535)));
}

function writeSample(target, offset, value) {
  target[offset] = value >>> 8;
  target[offset + 1] = value & 255;
}

async function deflateRows(width, height, readLinearPixel, onProgress) {
  if (typeof CompressionStream !== "function") throw new Error("HDR PNG export requires CompressionStream support in this browser");
  const compression = new CompressionStream("deflate");
  const writer = compression.writable.getWriter();
  const compressedParts = [];
  const collect = (async () => {
    const reader = compression.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      compressedParts.push(value);
    }
  })();
  const row = new Uint8Array(1 + width * 8);
  const rgba = new Float64Array(4);
  const progressStride = Math.max(1, Math.floor(height / 30));
  for (let y = 0; y < height; y++) {
    row[0] = 1; // PNG Sub filter.
    for (let x = 0; x < width; x++) {
      readLinearPixel(y * width + x, rgba);
      const r2020 = Math.max(0, 0.627404 * rgba[0] + 0.329282 * rgba[1] + 0.0433136 * rgba[2]);
      const g2020 = Math.max(0, 0.069097 * rgba[0] + 0.91954 * rgba[1] + 0.0113612 * rgba[2]);
      const b2020 = Math.max(0, 0.0163916 * rgba[0] + 0.0880132 * rgba[1] + 0.8955952 * rgba[2]);
      const offset = 1 + x * 8;
      writeSample(row, offset, pqCode(r2020));
      writeSample(row, offset + 2, pqCode(g2020));
      writeSample(row, offset + 4, pqCode(b2020));
      writeSample(row, offset + 6, Math.max(0, Math.min(65535, Math.round(rgba[3] * 65535))));
    }
    for (let byte = row.length - 1; byte >= 9; byte--) row[byte] = (row[byte] - row[byte - 8]) & 255;
    await writer.write(row);
    if (y % progressStride === 0) onProgress?.(y / height);
  }
  await writer.close();
  await collect;
  return compressedParts;
}

export async function encodeHdrPng(width, height, readLinearPixel, onProgress) {
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width, false);
  header.setUint32(4, height, false);
  ihdr[8] = 16;
  ihdr[9] = 6;
  const compressed = await deflateRows(width, height, readLinearPixel, onProgress);
  const idatName = ascii("IDAT");
  const idatLength = compressed.reduce((total, part) => total + part.byteLength, 0);
  return new Blob([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    // BT.2020 primaries, PQ transfer, RGB matrix, full range (ITU-T H.273 code points).
    chunk("cICP", new Uint8Array([9, 16, 0, 1])),
    uint32(idatLength), idatName, ...compressed, uint32(crc32([idatName, ...compressed])),
    chunk("IEND", new Uint8Array()),
  ], { type: "image/png" });
}
