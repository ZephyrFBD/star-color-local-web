const RAW_EXTENSIONS = new Set(["dng", "nef", "nrw", "cr2", "cr3", "arw", "raf", "rw2", "orf", "pef", "raw"]);
const DEFAULTS = Object.freeze({
  threshold: 8,
  radius: 3,
  gain: 5,
  background: "preserve",
  landscapeFilter: true,
  preferGpu: true,
  coreSigma: 0.65,
  surroundSigma: 3,
  backgroundSigma: 12,
  minArea: 1,
  maxArea: 60,
  maxSize: 14,
  chromaLimit: 0.72,
  haloFloor: 0.2,
  skyRatio: 0.9,
  landscapeScale: 16,
  landscapeBlur: 4,
});

const TEXT = {
  en: {
    "meta.title": "Local Color Star Extractor", "meta.description": "A color star extractor that processes photos entirely in your browser",
    "hero.title": "Keep the stars.", "hero.subtitle": "Your photos stay on your device.", "hero.description": "RAW decoding, star detection, and PNG generation all run locally in your browser. Original star colors and relative brightness are preserved; the server only delivers static files.",
    "badge.privacy": "🔒 Zero upload · Local processing", "engine.detecting": "Detecting WebGPU…", "engine.enabled": "WebGPU enabled", "engine.cpu": "CPU Worker mode", "engine.inline": "Local main-thread compatibility mode", "engine.available": "WebGPU available; it will be enabled during processing", "engine.unavailable": "WebGPU unavailable; CPU Worker will be used",
    "upload.drop": "Drop a photo here", "upload.choose": "or click to choose a local file", "upload.formats": "DNG / common camera RAW / JPG / PNG / WebP", "file.remove": "Remove file",
    "control.threshold": "Detection strictness", "control.thresholdHint": "Higher values reduce false positives but may miss faint stars", "control.radius": "Star expansion", "control.radiusHint": "Keep color and glow around each detected star", "control.gain": "Uniform brightness gain", "control.gainHint": "Does not normalize individual stars or images",
    "background.legend": "Export background", "background.black": "Black", "background.transparent": "Transparent", "background.preserve": "Preserve background", "background.hint": "Preserve background removes detected stars, interpolates a starless background from nearby pixels, then adds the enhanced color stars back.",
    "landscape.title": "Exclude warm landscapes", "landscape.hint": "Reduce trees and building lights detected as stars", "gpu.title": "Prefer WebGPU", "gpu.hint": "Automatically fall back to a CPU Worker when unavailable or unsuccessful",
    "advanced.title": "Advanced detection settings", "advanced.hint": "Every option has a default value", "advanced.core": "Star core scale", "advanced.surround": "Surround scale", "advanced.background": "Background scale", "advanced.minArea": "Minimum star area", "advanced.maxArea": "Maximum star area", "advanced.maxSize": "Maximum star size", "advanced.chroma": "Monochrome spike limit", "advanced.halo": "Halo retention floor", "advanced.sky": "Cool-sky ratio", "advanced.landscapeScale": "Landscape sample spacing", "advanced.landscapeBlur": "Landscape smoothing scale", "advanced.reset": "Restore all defaults",
    "action.extract": "Extract color stars locally", "action.processing": "Processing locally…", "action.download": "Download color PNG", "progress.readFile": "Read file", "progress.notStarted": "Not started",
    "preview.title": "Color stars", "preview.waiting": "Waiting", "preview.empty": "Your local result will appear here", "preview.alt": "Extracted color stars", "preview.processing": "Analyzing starlight locally…", "privacy.footer": "Photo data is never sent over the network. Closing or refreshing this tab releases the temporary processing data.",
    "file.raw": "Camera RAW (16-bit linear decode)", "file.standard": "Standard image (converted to linear light)", "status.fileLocal": "The file remains in this tab's memory and is never uploaded.", "error.outOfRange": "{field} is outside the valid range", "error.surround": "Surround scale must be greater than star core scale", "error.area": "Maximum star area cannot be smaller than minimum star area",
    "raw.read": "Read RAW", "raw.load": "Loading the local 16-bit RAW decoder", "common.cancelled": "Cancelled", "raw.decode": "Decode RAW", "raw.fullParallel": "16-bit linear full resolution · browser parallel", "raw.fullLow": "16-bit linear full resolution · low-memory single thread", "error.rawSize": "The RAW file does not contain valid full-resolution dimensions", "error.rawDecode": "The RAW decoder returned no valid image; this camera compression format may not be supported yet", "image.read": "Read image", "image.decode": "Decoding the local image in your browser",
    "status.localProcessing": "All computation stays in this browser tab. Keep the page open while processing large RAW files.", "decode.complete": "Decode complete", "decode.memory": "{width} × {height} · estimated peak memory {memory}", "error.memory": "This image is estimated to require about {memory}, above the browser safety limit. Close other tabs and try again; resolution will not be reduced.", "error.worker": "The processing Worker stopped unexpectedly",
    "result.meta": "{width} × {height} · {stars} stars", "result.done": "Done: retained {stars} stars and {pixels} color pixels. The original image was not uploaded.", "status.cancelled": "Processing cancelled; temporary local data was released.", "status.failed": "Processing failed: {error}", "status.noOutput": "An error occurred; no output file was created", "status.defaults": "All parameters were restored to their defaults.",
  },
  zh: {
    "meta.title": "本地彩色星点提取器", "meta.description": "照片完全在浏览器本地处理的彩色星点提取器",
    "hero.title": "留下星光。", "hero.subtitle": "照片不离开你的电脑。", "hero.description": "RAW 解码、星点检测与 PNG 生成全部在浏览器本地完成。保留每颗星的原始颜色和明暗层次，服务器只提供网页文件。",
    "badge.privacy": "🔒 零上传 · 本地处理", "engine.detecting": "正在检测 WebGPU…", "engine.enabled": "WebGPU 已启用", "engine.cpu": "CPU Worker 模式", "engine.inline": "本地主线程兼容模式", "engine.available": "WebGPU 可用，处理时尝试启用", "engine.unavailable": "WebGPU 不可用，将使用 CPU Worker",
    "upload.drop": "把照片拖到这里", "upload.choose": "或点击选择本地文件", "upload.formats": "DNG / 常见相机 RAW / JPG / PNG / WebP", "file.remove": "移除文件",
    "control.threshold": "检测严格度", "control.thresholdHint": "越高越少误检，暗星也可能减少", "control.radius": "星点外扩", "control.radiusHint": "保留星点周围的颜色与光晕", "control.gain": "统一亮度倍率", "control.gainHint": "不会对单颗星或单张照片自动归一化",
    "background.legend": "导出背景", "background.black": "黑色", "background.transparent": "透明", "background.preserve": "保留背景", "background.hint": "“保留背景”会先移除星点并从周围像素插值得到无星背景，再叠回增强后的彩色星光。",
    "landscape.title": "排除暖色地景", "landscape.hint": "减少树木、建筑灯光被识别为星点", "gpu.title": "优先使用 WebGPU", "gpu.hint": "不可用或失败时自动回退 CPU Worker",
    "advanced.title": "高级检测参数", "advanced.hint": "全部参数均有默认值", "advanced.core": "星核尺度", "advanced.surround": "周边尺度", "advanced.background": "背景尺度", "advanced.minArea": "最小星点面积", "advanced.maxArea": "最大星点面积", "advanced.maxSize": "最大星点边长", "advanced.chroma": "单色尖峰上限", "advanced.halo": "光晕保留阈值", "advanced.sky": "天空冷色比例", "advanced.landscapeScale": "地景采样间隔", "advanced.landscapeBlur": "地景平滑尺度", "advanced.reset": "恢复全部默认值",
    "action.extract": "在本机提取彩色星点", "action.processing": "正在本机处理…", "action.download": "下载彩色 PNG", "progress.readFile": "读取文件", "progress.notStarted": "尚未开始",
    "preview.title": "彩色星点", "preview.waiting": "等待处理", "preview.empty": "本地处理结果将在这里显示", "preview.alt": "彩色星点提取结果", "preview.processing": "正在本机分析星光…", "privacy.footer": "照片内容不会通过网络发送。关闭或刷新页面后，本次处理数据即从页面内存中释放。",
    "file.raw": "相机 RAW（16 位线性解码）", "file.standard": "标准图片（转为线性光）", "status.fileLocal": "文件仅保存在当前页面内存中，不会上传。", "error.outOfRange": "{field} 超出有效范围", "error.surround": "周边尺度必须大于星核尺度", "error.area": "最大星点面积不能小于最小面积",
    "raw.read": "读取 RAW", "raw.load": "加载本地 16 位 RAW 解码器", "common.cancelled": "已取消", "raw.decode": "解码 RAW", "raw.fullParallel": "16 位线性全分辨率 · 浏览器并行", "raw.fullLow": "16 位线性全分辨率 · 低内存单线程", "error.rawSize": "RAW 文件缺少有效的全分辨率尺寸信息", "error.rawDecode": "RAW 解码器没有返回有效图像；该相机压缩格式可能暂不受支持", "image.read": "读取图片", "image.decode": "浏览器正在解码本地文件",
    "status.localProcessing": "所有计算都在这个浏览器标签页内进行。处理大 RAW 时请保持页面开启。", "decode.complete": "解码完成", "decode.memory": "{width} × {height} · 预计峰值内存约 {memory}", "error.memory": "该图片预计需要约 {memory} 内存，超过浏览器安全上限。可关闭其他标签页后再试；不会自动降分辨率。", "error.worker": "处理 Worker 意外终止",
    "result.meta": "{width} × {height} · {stars} 颗星", "result.done": "完成：保留 {stars} 颗星、{pixels} 个彩色像素。原图没有上传。", "status.cancelled": "处理已取消；本地临时数据已释放。", "status.failed": "处理失败：{error}", "status.noOutput": "发生错误，未生成输出文件", "status.defaults": "参数已恢复默认值。",
  },
};

let locale = "en";
const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), TEXT[locale][key] || TEXT.en[key] || key);

const $ = (selector) => document.querySelector(selector);
const elements = {
  fileInput: $("#fileInput"), dropZone: $("#dropZone"), fileCard: $("#fileCard"), fileName: $("#fileName"), fileSize: $("#fileSize"),
  removeFile: $("#removeFile"), extract: $("#extractButton"), buttonLabel: $("#buttonLabel"), engine: $("#engineBadge"),
  progressBox: $("#progressBox"), progressStage: $("#progressStage"), progressValue: $("#progressValue"), progressBar: $("#progressBar"), progressDetail: $("#progressDetail"),
  status: $("#status"), processing: $("#processing"), emptyPreview: $("#emptyPreview"), resultImage: $("#resultImage"),
  resultMeta: $("#resultMeta"), download: $("#downloadButton"), reset: $("#resetDefaults"), language: $("#languageToggle"),
};

let selectedFile = null;
let activeRaw = null;
let activeAbort = null;
let activeWorker = null;
let resultUrl = null;
let cancelled = false;
let engineState = "detect";
let busyState = false;
let lastResult = null;

function applyLocale() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').content = t("meta.description");
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-aria]")) node.setAttribute("aria-label", t(node.dataset.i18nAria));
  for (const node of document.querySelectorAll("[data-i18n-alt]")) node.setAttribute("alt", t(node.dataset.i18nAlt));
  elements.language.textContent = locale === "en" ? "中文" : "English";
  elements.language.setAttribute("aria-label", locale === "en" ? "Switch to Chinese" : "切换到英文");
  setEngineBadge(engineState);
  setBusy(busyState);
  if (selectedFile) updateFileDescription();
  if (lastResult) updateResultCopy(lastResult);
}

function toggleLocale() {
  locale = locale === "en" ? "zh" : "en";
  applyLocale();
  activeWorker?.postMessage({ type: "locale", locale });
}

function setEngineBadge(engine, warning = "") {
  engineState = engine;
  elements.engine.classList.remove("gpu", "cpu");
  if (engine === "webgpu") {
    elements.engine.classList.add("gpu");
    elements.engine.textContent = t("engine.enabled");
  } else if (engine === "cpu") {
    elements.engine.classList.add("cpu");
    elements.engine.textContent = t(globalThis.__singleInlineMode ? "engine.inline" : "engine.cpu");
  } else elements.engine.textContent = navigator.gpu ? t("engine.available") : t("engine.unavailable");
  if (warning) setStatus(warning);
}

applyLocale();
setEngineBadge("detect");

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i++) { value /= 1024; unit = units[i]; }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

function extension(file) { return file.name.split(".").pop()?.toLowerCase() || ""; }
function isRaw(file) { return RAW_EXTENSIONS.has(extension(file)); }

function setFile(file) {
  if (!file) return;
  selectedFile = file;
  elements.fileName.textContent = file.name;
  updateFileDescription();
  $(".file-mark").textContent = isRaw(file) ? extension(file).toUpperCase() : "IMG";
  elements.dropZone.classList.add("hidden");
  elements.fileCard.classList.remove("hidden");
  elements.extract.disabled = false;
  clearResult();
  setStatus(t("status.fileLocal"), false);
}

function updateFileDescription() {
  if (selectedFile) elements.fileSize.textContent = `${formatBytes(selectedFile.size)} · ${t(isRaw(selectedFile) ? "file.raw" : "file.standard")}`;
}

function removeFile() {
  cancelProcessing(false);
  selectedFile = null;
  elements.fileInput.value = "";
  elements.dropZone.classList.remove("hidden");
  elements.fileCard.classList.add("hidden");
  elements.extract.disabled = true;
  elements.progressBox.classList.add("hidden");
  clearResult();
  setStatus("");
}

function clearResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  elements.resultImage.removeAttribute("src");
  elements.resultImage.classList.add("hidden");
  elements.emptyPreview.classList.remove("hidden");
  elements.download.disabled = true;
  lastResult = null;
  elements.resultMeta.textContent = t("preview.waiting");
}

function setStatus(text, error = false) {
  elements.status.textContent = text;
  elements.status.classList.toggle("error", error);
}

function setProgress(value, stage, detail) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  elements.progressBox.classList.remove("hidden");
  elements.progressValue.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  if (stage) elements.progressStage.textContent = stage;
  if (detail) elements.progressDetail.textContent = detail;
}

function setBusy(busy) {
  busyState = busy;
  elements.extract.disabled = busy || !selectedFile;
  elements.removeFile.disabled = busy;
  elements.processing.classList.toggle("hidden", !busy);
  elements.buttonLabel.textContent = t(busy ? "action.processing" : "action.extract");
}

function numberValue(id) {
  const input = document.getElementById(id);
  const value = Number(input.value);
  const min = Number(input.min);
  const max = Number(input.max);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(t("error.outOfRange", { field: input.closest("label")?.innerText?.split("\n")[0] || id }));
  return value;
}

function options() {
  const value = {
    threshold: numberValue("threshold"), radius: numberValue("radius"), gain: numberValue("gain"),
    background: document.querySelector('input[name="background"]:checked').value,
    landscapeFilter: $("#landscapeFilter").checked, preferGpu: $("#preferGpu").checked,
    coreSigma: numberValue("coreSigma"), surroundSigma: numberValue("surroundSigma"), backgroundSigma: numberValue("backgroundSigma"),
    minArea: numberValue("minArea"), maxArea: numberValue("maxArea"), maxSize: numberValue("maxSize"), chromaLimit: numberValue("chromaLimit"),
    haloFloor: numberValue("haloFloor"), skyRatio: numberValue("skyRatio"), landscapeScale: numberValue("landscapeScale"), landscapeBlur: numberValue("landscapeBlur"),
  };
  if (value.surroundSigma <= value.coreSigma) throw new Error(t("error.surround"));
  if (value.maxArea < value.minArea) throw new Error(t("error.area"));
  return value;
}

function transferableView(view) {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) return view.buffer;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

async function decodeRaw(file) {
  setProgress(3, t("raw.read"), t("raw.load"));
  const runtimeUrl = new URL(`${import.meta.env.BASE_URL}luma/index.js`, window.location.origin).href;
  const module = await import(/* @vite-ignore */ runtimeUrl);
  if (cancelled) throw new DOMException(t("common.cancelled"), "AbortError");
  const isolated = globalThis.crossOriginIsolated === true;
  activeAbort = new AbortController();
  activeRaw = module.createLumaRawRuntime({
    memoryProfile: isolated ? "desktop" : "low-memory",
    requireCrossOriginIsolation: isolated,
  });
  const info = await activeRaw.init();
  setProgress(7, t("raw.decode"), t(info.pthreads ? "raw.fullParallel" : "raw.fullLow"));
  const session = await activeRaw.openSession(file, {}, activeAbort.signal);
  const fullPixels = (session.probe.width || 0) * (session.probe.height || 0);
  if (!fullPixels) throw new Error(t("error.rawSize"));
  const decoded = await session.decodeBoundedHq({ maxOutputPixels: fullPixels }, activeAbort.signal);
  session.dispose();
  activeRaw.dispose();
  activeRaw = null;
  activeAbort = null;
  if (!decoded?.data || !decoded.width || !decoded.height) throw new Error(t("error.rawDecode"));
  return {
    width: decoded.width, height: decoded.height, colors: 3, bits: decoded.bitDepth || 16,
    sourceKind: "raw", buffer: transferableView(decoded.data),
  };
}

async function decodeStandard(file) {
  setProgress(4, t("image.read"), t("image.decode"));
  const bitmap = await createImageBitmap(file, { colorSpaceConversion: "default", premultiplyAlpha: "none" });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, colors: 4, bits: 8, sourceKind: "rgba8", buffer: imageData.data.buffer };
}

function memoryEstimate(decoded) {
  const pixels = decoded.width * decoded.height;
  return pixels * 43 + (decoded.bits > 8 ? pixels * decoded.colors * 2 : pixels * 4);
}

async function processFile() {
  if (!selectedFile || activeWorker || activeRaw) return;
  cancelled = false;
  clearResult();
  setBusy(true);
  setStatus(t("status.localProcessing"), false);
  let decoded;
  try {
    const config = options();
    decoded = isRaw(selectedFile) ? await decodeRaw(selectedFile) : await decodeStandard(selectedFile);
    if (cancelled) throw new DOMException(t("common.cancelled"), "AbortError");
    const estimate = memoryEstimate(decoded);
    setProgress(20, t("decode.complete"), t("decode.memory", { width: decoded.width, height: decoded.height, memory: formatBytes(estimate) }));
    if (estimate > 1_600_000_000) throw new Error(t("error.memory", { memory: formatBytes(estimate) }));

    activeWorker = new Worker(new URL("./processor.worker.js", import.meta.url), { type: "module" });
    activeWorker.onmessage = ({ data: message }) => {
      if (message.type === "progress") setProgress(message.value, message.stage, message.detail);
      else if (message.type === "pulse") elements.progressDetail.textContent = message.detail;
      else if (message.type === "engine") setEngineBadge(message.engine, message.warning);
      else if (message.type === "result") finishResult(message);
      else if (message.type === "error") fail(new Error(message.message));
    };
    activeWorker.onerror = (event) => fail(new Error(event.message || t("error.worker")));
    activeWorker.postMessage({ type: "process", ...decoded, options: config, locale }, [decoded.buffer]);
  } catch (error) {
    fail(error);
  }
}

function finishResult(message) {
  lastResult = message;
  resultUrl = URL.createObjectURL(message.blob);
  elements.resultImage.src = resultUrl;
  elements.resultImage.classList.remove("hidden");
  elements.emptyPreview.classList.add("hidden");
  elements.download.disabled = false;
  updateResultCopy(message);
  activeWorker?.terminate();
  activeWorker = null;
  setBusy(false);
}

function updateResultCopy(message) {
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  const stars = message.stars.toLocaleString(numberLocale);
  const pixels = message.pixels.toLocaleString(numberLocale);
  elements.resultMeta.textContent = t("result.meta", { width: message.width, height: message.height, stars });
  setStatus(t("result.done", { stars, pixels }));
}

function fail(error) {
  activeRaw?.dispose();
  activeRaw = null;
  activeAbort = null;
  activeWorker?.terminate();
  activeWorker = null;
  setBusy(false);
  if (cancelled || error?.name === "AbortError" || /disposed|cancelled|已取消/i.test(error?.message || "")) {
    setStatus(t("status.cancelled"), false);
    elements.progressDetail.textContent = t("common.cancelled");
    return;
  }
  console.error(error);
  setStatus(t("status.failed", { error: error?.message || error }), true);
  elements.progressDetail.textContent = t("status.noOutput");
}

function cancelProcessing(showMessage = true) {
  cancelled = true;
  activeAbort?.abort();
  activeAbort = null;
  activeRaw?.dispose();
  activeRaw = null;
  activeWorker?.terminate();
  activeWorker = null;
  setBusy(false);
  if (showMessage) {
    setStatus(t("status.cancelled"), false);
    elements.progressDetail.textContent = t("common.cancelled");
  }
}

function downloadResult() {
  if (!resultUrl || !selectedFile) return;
  const stem = selectedFile.name.replace(/\.[^.]+$/, "");
  const background = document.querySelector('input[name="background"]:checked').value;
  const anchor = document.createElement("a");
  anchor.href = resultUrl;
  anchor.download = background === "preserve" ? `${stem}_enhanced_stars_background.png` : `${stem}_color_stars.png`;
  anchor.click();
}

function resetDefaults() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (key === "background") document.querySelector(`input[name="background"][value="${value}"]`).checked = true;
    else {
      const input = document.getElementById(key);
      if (input) input.type === "checkbox" ? input.checked = value : input.value = value;
    }
  }
  updateRangeLabels();
  setStatus(t("status.defaults"), false);
}

function updateRangeLabels() {
  $("#thresholdValue").textContent = Number($("#threshold").value).toFixed(1);
  $("#radiusValue").textContent = `${$("#radius").value} px`;
  $("#gainValue").textContent = `${Number($("#gain").value).toFixed(2)}×`;
}

elements.fileInput.addEventListener("change", () => setFile(elements.fileInput.files[0]));
elements.removeFile.addEventListener("click", removeFile);
elements.extract.addEventListener("click", processFile);
elements.download.addEventListener("click", downloadResult);
elements.reset.addEventListener("click", resetDefaults);
elements.language.addEventListener("click", toggleLocale);
for (const id of ["threshold", "radius", "gain"]) document.getElementById(id).addEventListener("input", updateRangeLabels);
for (const eventName of ["dragenter", "dragover"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.add("dragging"); });
for (const eventName of ["dragleave", "drop"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.remove("dragging"); });
elements.dropZone.addEventListener("drop", (event) => setFile(event.dataTransfer.files[0]));
window.addEventListener("beforeunload", () => { activeAbort?.abort(); activeRaw?.dispose(); activeWorker?.terminate(); if (resultUrl) URL.revokeObjectURL(resultUrl); });
