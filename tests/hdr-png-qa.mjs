import { inflateSync } from "node:zlib";
import { encodeHdrPng } from "../src/hdr-png.js";

const width = 3;
const height = 2;
const values = [
  [0, 0, 0, 1], [1, 1, 1, 1], [5, 2, 0.5, 1],
  [0.1, 0.2, 0.3, 1], [20, 10, 3, 1], [0, 0, 0, 0],
];
const blob = await encodeHdrPng(width, height, (pixel, rgba) => rgba.set(values[pixel]));
const bytes = new Uint8Array(await blob.arrayBuffer());
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
if (!signature.every((value, index) => bytes[index] === value)) throw new Error("Invalid PNG signature");

const chunks = [];
let offset = 8;
while (offset < bytes.length) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
  const length = view.getUint32(0, false);
  const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
  chunks.push({ type, data: bytes.slice(offset + 8, offset + 8 + length) });
  offset += 12 + length;
}
const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
const cicp = chunks.find((chunk) => chunk.type === "cICP")?.data;
const idat = chunks.filter((chunk) => chunk.type === "IDAT").flatMap((chunk) => [...chunk.data]);
if (!ihdr || ihdr[8] !== 16 || ihdr[9] !== 6) throw new Error("Expected 16-bit RGBA PNG");
if (!cicp || ![9, 16, 0, 1].every((value, index) => cicp[index] === value)) throw new Error("Expected BT.2020 PQ cICP metadata");
const scanlines = inflateSync(Uint8Array.from(idat));
if (scanlines.length !== height * (1 + width * 8)) throw new Error("Unexpected decoded scanline size");
if (scanlines[0] !== 1 || scanlines[1 + width * 8] !== 1) throw new Error("Expected PNG Sub filtering");
console.log(JSON.stringify({ pass: true, bytes: blob.size, bitDepth: ihdr[8], colorType: ihdr[9], cICP: [...cicp] }));
