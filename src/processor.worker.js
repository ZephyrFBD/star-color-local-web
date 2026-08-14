import { WebGpuGaussian } from "./webgpu.js";

let gpu = null;
let source;
let width;
let height;
let colors;
let bits;
let sourceKind;
let srgbTable;
let locale = "en";

const sendProgress = (value, stage, detail = "") => postMessage({ type: "progress", value, stage, detail });
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
const tr = (english, chinese) => locale === "zh" ? chinese : english;
const localizedNumber = (value) => value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US");

function sourceValue(pixel, channel) {
  if (sourceKind === "rgba8") return srgbTable[source[pixel * 4 + channel]];
  const scale = bits > 8 ? 1 / 65535 : 1 / 255;
  const offset = pixel * colors;
  const r = source[offset] * scale;
  const g = source[offset + Math.min(1, colors - 1)] * scale;
  const b = source[offset + Math.min(2, colors - 1)] * scale;
  // The RAW runtime returns linear ProPhoto RGB; convert it to the linear sRGB workspace used by the original processor.
  const value = channel === 0
    ? 1.3459433 * r - 0.2556075 * g - 0.0511118 * b
    : channel === 1
      ? -0.5445989 * r + 1.5081673 * g + 0.0205351 * b
      : 1.2118128 * b;
  return Math.max(0, Math.min(1, value));
}

async function buildPlane(channel, progressStart, progressEnd) {
  const n = width * height;
  const plane = new Float32Array(n);
  const stride = Math.max(1, Math.floor(height / 24));
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) plane[row + x] = sourceValue(row + x, channel);
    if (y % stride === 0) {
      sendProgress(progressStart + (progressEnd - progressStart) * y / height, tr("Prepare linear color", "准备线性色彩"), tr(`Read color channel ${channel + 1}`, `读取第 ${channel + 1} 个色彩通道`));
      await pause();
    }
  }
  return plane;
}

function gaussianKernel(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 4));
  const kernel = new Float32Array(radius * 2 + 1);
  let total = 0;
  for (let i = -radius; i <= radius; i++) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = value;
    total += value;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= total;
  return { kernel, radius };
}

async function exactGaussianCpu(input, w, h, sigma, label) {
  if (sigma <= 0) return input.slice();
  const { kernel, radius } = gaussianKernel(sigma);
  const temp = new Float32Array(input.length);
  const output = new Float32Array(input.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += input[row + Math.max(0, Math.min(w - 1, x + k))] * kernel[k + radius];
      temp[row + x] = sum;
    }
    if ((y & 63) === 0) {
      postMessage({ type: "pulse", detail: `${label} · ${tr("CPU horizontal", "CPU 横向")} ${Math.round(y / h * 100)}%` });
      await pause();
    }
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += temp[Math.max(0, Math.min(h - 1, y + k)) * w + x] * kernel[k + radius];
      output[row + x] = sum;
    }
    if ((y & 63) === 0) {
      postMessage({ type: "pulse", detail: `${label} · ${tr("CPU vertical", "CPU 纵向")} ${Math.round(y / h * 100)}%` });
      await pause();
    }
  }
  return output;
}

function boxesForGauss(sigma, count = 3) {
  const ideal = Math.sqrt((12 * sigma * sigma / count) + 1);
  let lower = Math.floor(ideal);
  if ((lower & 1) === 0) lower--;
  const upper = lower + 2;
  const m = Math.round((12 * sigma * sigma - count * lower * lower - 4 * count * lower - 3 * count) / (-4 * lower - 4));
  return Array.from({ length: count }, (_, i) => (i < m ? lower : upper));
}

function boxHorizontal(src, dst, w, h, radius) {
  const divisor = 1 / (radius + radius + 1);
  const prefix = new Float64Array(w + 1);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    const first = src[base];
    const last = src[base + w - 1];
    prefix[0] = 0;
    for (let x = 0; x < w; x++) prefix[x + 1] = prefix[x] + src[base + x];
    for (let x = 0; x < w; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(w - 1, x + radius);
      const missingLeft = Math.max(0, radius - x);
      const missingRight = Math.max(0, x + radius - (w - 1));
      dst[base + x] = (prefix[right + 1] - prefix[left] + missingLeft * first + missingRight * last) * divisor;
    }
  }
}

function boxVertical(src, dst, w, h, radius) {
  const divisor = 1 / (radius + radius + 1);
  const prefix = new Float64Array(h + 1);
  for (let x = 0; x < w; x++) {
    const first = src[x];
    const last = src[(h - 1) * w + x];
    prefix[0] = 0;
    for (let y = 0; y < h; y++) prefix[y + 1] = prefix[y] + src[y * w + x];
    for (let y = 0; y < h; y++) {
      const top = Math.max(0, y - radius);
      const bottom = Math.min(h - 1, y + radius);
      const missingTop = Math.max(0, radius - y);
      const missingBottom = Math.max(0, y + radius - (h - 1));
      dst[y * w + x] = (prefix[bottom + 1] - prefix[top] + missingTop * first + missingBottom * last) * divisor;
    }
  }
}

async function fastGaussianCpu(input, w, h, sigma, label) {
  if (sigma <= 0) return input.slice();
  let current = input;
  const temp = new Float32Array(input.length);
  let output = new Float32Array(input.length);
  const sizes = boxesForGauss(sigma);
  for (let pass = 0; pass < sizes.length; pass++) {
    const radius = Math.max(1, (sizes[pass] - 1) >> 1);
    boxHorizontal(current, temp, w, h, Math.min(radius, Math.max(1, w - 1)));
    boxVertical(temp, output, w, h, Math.min(radius, Math.max(1, h - 1)));
    current = output;
    if (pass < sizes.length - 1) output = new Float32Array(input.length);
    postMessage({ type: "pulse", detail: `${label} · ${tr("CPU fast Gaussian", "CPU 快速高斯")} ${pass + 1}/3` });
    await pause();
  }
  return current;
}

async function blur(input, w, h, sigma, label) {
  if (w === width && h === height && gpu) {
    try {
      postMessage({ type: "pulse", detail: `${label} · WebGPU` });
      return await gpu.blur(input, sigma);
    } catch (error) {
      gpu.destroy();
      gpu = null;
      postMessage({ type: "engine", engine: "cpu", warning: tr(`WebGPU computation failed; automatically fell back to CPU: ${error.message}`, `WebGPU 计算失败，已自动回退 CPU：${error.message}`) });
    }
  }
  return sigma > 4 ? fastGaussianCpu(input, w, h, sigma, label) : exactGaussianCpu(input, w, h, sigma, label);
}

function sampledMedian(values) {
  values.sort();
  const middle = values.length >> 1;
  return values.length & 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

async function robustNoise(response) {
  const border = Math.min(100, Math.floor(Math.min(width, height) * 0.08));
  const innerW = width - border * 2;
  const innerH = height - border * 2;
  const sampleTarget = 2_000_000;
  const stride = Math.max(1, Math.ceil(Math.sqrt((innerW * innerH) / sampleTarget)));
  const count = Math.ceil(innerW / stride) * Math.ceil(innerH / stride);
  const sample = new Float32Array(count);
  let at = 0;
  for (let y = border; y < height - border; y += stride) {
    const row = y * width;
    for (let x = border; x < width - border; x += stride) sample[at++] = response[row + x];
  }
  const used = at === sample.length ? sample : sample.slice(0, at);
  const center = sampledMedian(used);
  for (let i = 0; i < used.length; i++) used[i] = Math.abs(used[i] - center);
  const noise = Math.max(1e-8, 1.4826 * sampledMedian(used));
  return { center, noise, stride };
}

async function findCandidates(response, threshold, options) {
  const n = response.length;
  const seed = new Uint8Array(n);
  for (let i = 0; i < n; i++) seed[i] = response[i] > threshold ? 1 : 0;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  const candidates = [];
  const { minArea, maxArea, maxSize } = options;

  for (let start = 0; start < n; start++) {
    if (!seed[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let minX = width, maxX = -1, minY = height, maxY = -1, peak = start;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = (pixel / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (response[pixel] > response[peak]) peak = pixel;
      if (x > 0) add(pixel - 1);
      if (x + 1 < width) add(pixel + 1);
      if (y > 0) add(pixel - width);
      if (y + 1 < height) add(pixel + width);
    }
    if (tail >= minArea && tail <= maxArea && maxX - minX + 1 <= maxSize && maxY - minY + 1 <= maxSize) {
      candidates.push({ pixels: queue.slice(0, tail), peak });
    }
    if ((start & 262143) === 0) await pause();

    function add(pixel) {
      if (seed[pixel] && !visited[pixel]) {
        visited[pixel] = 1;
        queue[tail++] = pixel;
      }
    }
  }
  return candidates;
}

async function coarseLandscape(options) {
  if (!options.landscapeFilter) return null;
  const scale = options.landscapeScale;
  const coarseW = Math.ceil(width / scale);
  const coarseH = Math.ceil(height / scale);
  const planes = [];
  for (let c = 0; c < 3; c++) {
    const plane = new Float32Array(coarseW * coarseH);
    for (let y = 0; y < coarseH; y++) {
      const sy = Math.min(height - 1, y * scale);
      for (let x = 0; x < coarseW; x++) plane[y * coarseW + x] = sourceValue(sy * width + Math.min(width - 1, x * scale), c);
    }
    planes.push(options.landscapeBlur > 0 ? await exactGaussianCpu(plane, coarseW, coarseH, options.landscapeBlur, tr("Landscape analysis", "地景分析")) : plane);
  }
  return { planes, width: coarseW, height: coarseH, scale };
}

function acceptCandidates(candidates, backgrounds, landscape, options) {
  const accepted = [];
  for (const component of candidates) {
    const p = component.peak;
    const residual = [0, 1, 2].map((c) => Math.max(0, sourceValue(p, c) - backgrounds[c][p]));
    const total = residual[0] + residual[1] + residual[2];
    if (total <= 0 || Math.max(...residual) / total > options.chromaLimit) continue;
    if (landscape) {
      const x = p % width;
      const y = (p / width) | 0;
      const cx = Math.min(landscape.width - 1, Math.round(x / landscape.scale));
      const cy = Math.min(landscape.height - 1, Math.round(y / landscape.scale));
      const cp = cy * landscape.width + cx;
      const r = landscape.planes[0][cp];
      const g = landscape.planes[1][cp];
      const b = landscape.planes[2][cp];
      if (!(b > options.skyRatio * r && b > options.skyRatio * g)) continue;
    }
    accepted.push(component);
  }
  return accepted;
}

function makeFootprint(components, response, floor) {
  const n = response.length;
  let mask = new Uint8Array(n);
  for (const component of components) for (const pixel of component.pixels) mask[pixel] = 1;
  for (let step = 0; step < floor.radius; step++) {
    const next = mask.slice();
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const p = row + x;
        if (!mask[p]) continue;
        if (x > 0) next[p - 1] = 1;
        if (x + 1 < width) next[p + 1] = 1;
        if (y > 0) next[p - width] = 1;
        if (y + 1 < height) next[p + width] = 1;
      }
    }
    mask = next;
  }
  let pixels = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i] && response[i] > floor.value) pixels++;
    else mask[i] = 0;
  }
  return { mask, pixels };
}

const linearToByte = (value) => {
  const x = Math.max(0, Math.min(1, value));
  const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(srgb * 255)));
};

function interpolatedBackground(pixel, channel, mask, fallback, maxDistance) {
  const x = pixel % width;
  const y = (pixel / width) | 0;
  const axes = [
    [[-1, 0], [1, 0]],
    [[0, -1], [0, 1]],
    [[-1, -1], [1, 1]],
    [[1, -1], [-1, 1]],
  ];
  let weighted = 0;
  let weightSum = 0;

  for (const [negative, positive] of axes) {
    const a = findBoundary(negative[0], negative[1]);
    const b = findBoundary(positive[0], positive[1]);
    if (a && b) {
      const span = a.distance + b.distance;
      const value = (a.value * b.distance + b.value * a.distance) / span;
      const weight = 1 / span;
      weighted += value * weight;
      weightSum += weight;
    } else {
      const point = a || b;
      if (point) {
        const weight = 0.35 / point.distance;
        weighted += point.value * weight;
        weightSum += weight;
      }
    }
  }
  return weightSum > 0 ? weighted / weightSum : fallback;

  function findBoundary(dx, dy) {
    for (let distance = 1; distance <= maxDistance; distance++) {
      const sx = x + dx * distance;
      const sy = y + dy * distance;
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) return null;
      const sample = sy * width + sx;
      if (!mask[sample]) return { distance, value: sourceValue(sample, channel) };
    }
    return null;
  }
}

function dilateMask(mask, iterations) {
  let current = mask;
  for (let step = 0; step < iterations; step++) {
    const next = current.slice();
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const p = row + x;
        if (!current[p]) continue;
        if (x > 0) next[p - 1] = 1;
        if (x + 1 < width) next[p + 1] = 1;
        if (y > 0) next[p - width] = 1;
        if (y + 1 < height) next[p + width] = 1;
      }
    }
    current = next;
  }
  return current;
}

async function encodeResult(mask, backgrounds, options, debug = false) {
  const n = width * height;
  const rgba = new Uint8ClampedArray(n * 4);
  const debugInpaint = debug && options.background === "preserve" ? new Float32Array(n * 3) : null;
  const opaque = options.background === "black";
  const preserve = options.background === "preserve";
  const repairRadius = Math.max(0, Math.round(options.repairRadius ?? 3));
  const inpaintMask = preserve ? dilateMask(mask, repairRadius) : mask;
  const inpaintDistance = Math.max(16, options.maxSize + options.radius + repairRadius * 2 + 8);
  for (let i = 0; i < n; i++) {
    const out = i * 4;
    if (preserve) {
      for (let c = 0; c < 3; c++) {
        const original = sourceValue(i, c);
        let value = original;
        if (mask[i]) {
          const cleanBackground = interpolatedBackground(i, c, inpaintMask, backgrounds[c][i], inpaintDistance);
          if (debugInpaint) debugInpaint[i * 3 + c] = cleanBackground;
          const starSignal = Math.max(0, original - cleanBackground) * options.gain;
          value = cleanBackground + starSignal;
        }
        rgba[out + c] = linearToByte(value);
      }
      rgba[out + 3] = 255;
    } else if (mask[i]) {
      rgba[out] = linearToByte(Math.max(0, sourceValue(i, 0) - backgrounds[0][i]) * options.gain);
      rgba[out + 1] = linearToByte(Math.max(0, sourceValue(i, 1) - backgrounds[1][i]) * options.gain);
      rgba[out + 2] = linearToByte(Math.max(0, sourceValue(i, 2) - backgrounds[2][i]) * options.gain);
      rgba[out + 3] = 255;
    } else {
      rgba[out + 3] = opaque ? 255 : 0;
    }
    if ((i & 1048575) === 0) await pause();
  }
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: true });
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
  return { blob: await canvas.convertToBlob({ type: "image/png" }), debugInpaint };
}

self.onmessage = async ({ data: message }) => {
  if (message.type === "locale") { locale = message.locale === "zh" ? "zh" : "en"; return; }
  if (message.type !== "process") return;
  try {
    locale = message.locale === "zh" ? "zh" : "en";
    width = message.width;
    height = message.height;
    colors = message.colors;
    bits = message.bits;
    sourceKind = message.sourceKind;
    source = sourceKind === "rgba8" ? new Uint8ClampedArray(message.buffer) : bits > 8 ? new Uint16Array(message.buffer) : new Uint8Array(message.buffer);
    const options = message.options;
    if (sourceKind === "rgba8") {
      srgbTable = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = i / 255;
        srgbTable[i] = x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }
    }

    if (options.preferGpu) {
      try {
        gpu = await WebGpuGaussian.create(width, height, locale);
        postMessage({ type: "engine", engine: "webgpu" });
      } catch (error) {
        postMessage({ type: "engine", engine: "cpu", warning: tr(`WebGPU unavailable; using CPU Worker: ${error.message}`, `WebGPU 不可用，已使用 CPU Worker：${error.message}`) });
      }
    } else postMessage({ type: "engine", engine: "cpu" });

    const megapixels = width * height / 1_000_000;
    sendProgress(24, tr("Prepare linear color", "准备线性色彩"), `${width} × ${height} · ${megapixels.toFixed(1)} MP`);
    const luminance = new Float32Array(width * height);
    for (let c = 0; c < 3; c++) {
      const plane = await buildPlane(c, 24 + c * 2, 26 + c * 2);
      const weight = c === 0 ? 0.2126 : c === 1 ? 0.7152 : 0.0722;
      for (let i = 0; i < luminance.length; i++) luminance[i] += plane[i] * weight;
    }

    sendProgress(31, tr("Detect star response", "检测星点响应"), tr("Separate star cores from large-scale light pollution", "分离星核与大尺度光污染"));
    const core = await blur(luminance, width, height, options.coreSigma, tr("Star core scale", "星核尺度"));
    sendProgress(39, tr("Detect star response", "检测星点响应"), tr("Calculate the surround scale", "计算周边尺度"));
    const surround = await blur(luminance, width, height, options.surroundSigma, tr("Surround scale", "周边尺度"));
    for (let i = 0; i < core.length; i++) core[i] -= surround[i];

    sendProgress(48, tr("Estimate noise", "估计噪声"), tr("Calculate robust median and MAD", "计算稳健中位数与 MAD"));
    const stats = await robustNoise(core);
    const detectionThreshold = stats.center + options.threshold * stats.noise;
    let responseMax = -Infinity;
    for (let i = 0; i < core.length; i++) if (core[i] > responseMax) responseMax = core[i];
    sendProgress(52, tr("Identify stars", "识别星点"), tr(`Noise ${stats.noise.toExponential(2)} · threshold ${detectionThreshold.toExponential(2)} · peak ${responseMax.toExponential(2)}`, `噪声 ${stats.noise.toExponential(2)} · 阈值 ${detectionThreshold.toExponential(2)} · 峰值 ${responseMax.toExponential(2)}`));
    const candidates = await findCandidates(core, detectionThreshold, options);

    sendProgress(58, tr("Analyze sky and landscape", "分析天空与地景"), tr(`${localizedNumber(candidates.length)} shape candidates`, `形状候选 ${localizedNumber(candidates.length)} 个`));
    const landscape = await coarseLandscape(options);
    const backgrounds = [];
    for (let c = 0; c < 3; c++) {
      const from = 60 + c * 7;
      const plane = await buildPlane(c, from, from + 2);
      sendProgress(from + 2, tr("Remove light-pollution background", "去除光污染背景"), tr(`Color channel ${c + 1}/3`, `色彩通道 ${c + 1}/3`));
      backgrounds.push(await blur(plane, width, height, options.backgroundSigma, tr(`Background channel ${c + 1}/3`, `背景通道 ${c + 1}/3`)));
    }

    sendProgress(82, tr("Filter real stars", "筛选真实星点"), tr("Check color, area, and landscape position", "检查颜色、面积与地景位置"));
    const accepted = acceptCandidates(candidates, backgrounds, landscape, options);
    const footprint = makeFootprint(accepted, core, {
      radius: options.radius,
      value: stats.center + options.haloFloor * stats.noise,
    });

    sendProgress(91, options.background === "preserve" ? tr("Interpolate a starless background and add enhanced stars", "插值无星背景并叠回强化星光") : tr("Generate color PNG", "生成彩色 PNG"), tr(`Retained ${localizedNumber(accepted.length)} stars · ${localizedNumber(footprint.pixels)} pixels`, `保留 ${localizedNumber(accepted.length)} 颗星 · ${localizedNumber(footprint.pixels)} 个像素`));
    const encoded = await encodeResult(footprint.mask, backgrounds, options, message.debug);
    const blob = encoded.blob;
    sendProgress(100, tr("Processing complete", "处理完成"), tr(`${localizedNumber(accepted.length)} stars · ${(blob.size / 1024 / 1024).toFixed(1)} MB PNG`, `${localizedNumber(accepted.length)} 颗星 · ${(blob.size / 1024 / 1024).toFixed(1)} MB PNG`));
    gpu?.destroy();
    gpu = null;
    const result = { type: "result", blob, width, height, stars: accepted.length, pixels: footprint.pixels };
    if (message.debug) {
      result.debugMask = footprint.mask.buffer;
      result.debugInpaint = encoded.debugInpaint?.buffer;
      postMessage(result, [result.debugMask, ...(result.debugInpaint ? [result.debugInpaint] : [])]);
    } else postMessage(result);
  } catch (error) {
    gpu?.destroy();
    gpu = null;
    postMessage({ type: "error", message: error?.stack || error?.message || String(error) });
  }
};
