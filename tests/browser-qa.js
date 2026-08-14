const width = 800;
const height = 500;
const stars = [
  [120, 90, 1.1, [170, 125, 80]],
  [315, 210, 2.0, [80, 135, 210]],
  [610, 125, 3.2, [220, 190, 140]],
  [525, 365, 1.45, [130, 190, 230]],
  [205, 405, 4.2, [240, 150, 90]],
];

const original = new Uint8ClampedArray(width * height * 4);
const trueBackground = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const rgb = [26 + 34 * x / (width - 1) + 8 * y / (height - 1), 31 + 18 * x / (width - 1) + 12 * y / (height - 1), 52 + 12 * x / (width - 1) + 16 * y / (height - 1)];
    const p = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) trueBackground[p + c] = Math.max(0, Math.min(255, Math.round(rgb[c])));
    trueBackground[p + 3] = 255;
    for (const [sx, sy, sigma, color] of stars) {
      const dx = x - sx;
      const dy = y - sy;
      const alpha = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      if (alpha > 1e-6) for (let c = 0; c < 3; c++) rgb[c] += color[c] * alpha;
    }
    for (let c = 0; c < 3; c++) original[p + c] = Math.max(0, Math.min(255, Math.round(rgb[c])));
    original[p + 3] = 255;
  }
}

const defaults = {
  threshold: 8, radius: 3, gain: 1, background: "preserve", landscapeFilter: false, preferGpu: false,
  coreSigma: 0.65, surroundSigma: 3, backgroundSigma: 12, minArea: 1, maxArea: 60, maxSize: 14,
  chromaLimit: 0.72, haloFloor: 0.2, skyRatio: 0.9, landscapeScale: 16, landscapeBlur: 4,
};

async function run(gain) {
  const worker = new Worker(new URL("../src/processor.worker.js", import.meta.url), { type: "module" });
  const copy = original.slice();
  const result = await new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => data.type === "result" ? resolve(data) : data.type === "error" ? reject(new Error(data.message)) : null;
    worker.onerror = (event) => reject(new Error(event.message));
    worker.postMessage({ type: "process", width, height, colors: 4, bits: 8, sourceKind: "rgba8", buffer: copy.buffer, options: { ...defaults, gain }, debug: true }, [copy.buffer]);
  });
  worker.terminate();
  const bitmap = await createImageBitmap(result.blob);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { pixels: context.getImageData(0, 0, width, height).data, mask: new Uint8Array(result.debugMask), inpaint: new Float32Array(result.debugInpaint), stars: result.stars };
}

async function runBlack() {
  const worker = new Worker(new URL("../src/processor.worker.js", import.meta.url), { type: "module" });
  const copy = original.slice();
  const result = await new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => data.type === "result" ? resolve(data) : data.type === "error" ? reject(new Error(data.message)) : null;
    worker.onerror = (event) => reject(new Error(event.message));
    worker.postMessage({ type: "process", width, height, colors: 4, bits: 8, sourceKind: "rgba8", buffer: copy.buffer, options: { ...defaults, background: "black" }, debug: true }, [copy.buffer]);
  });
  worker.terminate();
  return { mask: new Uint8Array(result.debugMask), stars: result.stars };
}

const one = await run(1);
const two = await run(2);
const black = await runBlack();
let outsideMax = 0, outsideSum = 0, outsideChannels = 0, insideMax = 0, insideSum = 0, insideChannels = 0;
let seamMax = 0, seamSum = 0, seamChannels = 0, enhancedLuma = 0, alphaErrors = 0, maskPixels = 0;
let reconstructedBgMax = 0, reconstructedBgSum = 0, reconstructedBgChannels = 0;
const linear = new Float32Array(256);
for (let i = 0; i < 256; i++) { const x = i / 255; linear[i] = x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
for (let i = 0; i < width * height; i++) {
  const p = i * 4;
  if (one.pixels[p + 3] !== 255 || two.pixels[p + 3] !== 255) alphaErrors++;
  if (one.mask[i]) {
    maskPixels++;
    let edge = false;
    const x = i % width, y = (i / width) | 0;
    if (x === 0 || x + 1 === width || y === 0 || y + 1 === height) edge = true;
    else edge = !one.mask[i - 1] || !one.mask[i + 1] || !one.mask[i - width] || !one.mask[i + width];
    for (let c = 0; c < 3; c++) {
      const error = Math.abs(one.pixels[p + c] - original[p + c]);
      insideMax = Math.max(insideMax, error); insideSum += error; insideChannels++;
      if (edge) { seamMax = Math.max(seamMax, error); seamSum += error; seamChannels++; }
      const bgError = Math.abs(two.inpaint[i * 3 + c] - linear[trueBackground[p + c]]) * 255;
      reconstructedBgMax = Math.max(reconstructedBgMax, bgError);
      reconstructedBgSum += bgError;
      reconstructedBgChannels++;
    }
    enhancedLuma += 0.2126 * (two.pixels[p] - one.pixels[p]) + 0.7152 * (two.pixels[p + 1] - one.pixels[p + 1]) + 0.0722 * (two.pixels[p + 2] - one.pixels[p + 2]);
  } else {
    for (let c = 0; c < 3; c++) {
      const error = Math.abs(one.pixels[p + c] - original[p + c]);
      outsideMax = Math.max(outsideMax, error); outsideSum += error; outsideChannels++;
    }
  }
}

const metrics = {
  detectedComponents: one.stars,
  maskPixels,
  outsideMaxError: outsideMax,
  outsideMeanError: outsideSum / outsideChannels,
  gain1InsideMaxError: insideMax,
  gain1InsideMeanError: insideSum / insideChannels,
  seamMaxError: seamMax,
  seamMeanError: seamSum / seamChannels,
  gain2MeanLumaIncrease: enhancedLuma / maskPixels,
  reconstructedBackgroundMaxLinear8: reconstructedBgMax,
  reconstructedBackgroundMeanLinear8: reconstructedBgSum / reconstructedBgChannels,
  alphaErrors,
  blackAndPreserveStarCountEqual: black.stars === one.stars,
  blackAndPreserveMaskEqual: black.mask.length === one.mask.length && black.mask.every((value, index) => value === one.mask[index]),
};
metrics.pass = outsideMax <= 1 && metrics.gain1InsideMeanError <= 2 && metrics.seamMeanError <= 2 && metrics.gain2MeanLumaIncrease > 3 && metrics.reconstructedBackgroundMeanLinear8 < 2 && alphaErrors === 0 && metrics.blackAndPreserveStarCountEqual && metrics.blackAndPreserveMaskEqual;
document.querySelector("#result").textContent = JSON.stringify(metrics, null, 2);
document.body.dataset.done = "true";
