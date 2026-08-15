import { createStoredZip } from "../src/zip.js";

const source = [
  { name: "first.png", bytes: new Uint8Array([1, 2, 3, 4, 5]) },
  { name: "彩色星点.png", bytes: new TextEncoder().encode("zip streaming test") },
];
const progress = [];
const zip = await createStoredZip(source.map((entry) => ({ name: entry.name, blob: new Blob([entry.bytes]), date: new Date("2026-08-15T12:00:00Z") })), (state) => progress.push(state));
const bytes = new Uint8Array(await zip.arrayBuffer());
const view = new DataView(bytes.buffer);
let eocd = bytes.length - 22;
if (view.getUint32(eocd, true) !== 0x06054b50) throw new Error("ZIP end record is missing");
if (view.getUint16(eocd + 10, true) !== source.length) throw new Error("ZIP entry count is incorrect");
let central = view.getUint32(eocd + 16, true);
const decoder = new TextDecoder();
for (const expected of source) {
  if (view.getUint32(central, true) !== 0x02014b50) throw new Error("Central directory entry is missing");
  const size = view.getUint32(central + 24, true);
  const nameLength = view.getUint16(central + 28, true);
  const extraLength = view.getUint16(central + 30, true);
  const commentLength = view.getUint16(central + 32, true);
  const local = view.getUint32(central + 42, true);
  const name = decoder.decode(bytes.subarray(central + 46, central + 46 + nameLength));
  if (name !== expected.name || size !== expected.bytes.length) throw new Error("Central directory metadata is incorrect");
  if (view.getUint32(local, true) !== 0x04034b50) throw new Error("Local ZIP entry is missing");
  const localNameLength = view.getUint16(local + 26, true);
  const localExtraLength = view.getUint16(local + 28, true);
  const dataStart = local + 30 + localNameLength + localExtraLength;
  const actual = bytes.subarray(dataStart, dataStart + size);
  if (!expected.bytes.every((value, index) => actual[index] === value)) throw new Error("Stored ZIP data changed");
  if (view.getUint32(dataStart + size, true) !== 0x08074b50) throw new Error("ZIP data descriptor is missing");
  central += 46 + nameLength + extraLength + commentLength;
}
if (!progress.length || progress.at(-1).completed !== source.length) throw new Error("ZIP progress did not complete");
console.log(JSON.stringify({ pass: true, bytes: zip.size, files: source.length, progressEvents: progress.length }));
