import { createStoredZip } from "./zip.js";

const RAW_EXTENSIONS = new Set(["dng", "nef", "nrw", "cr2", "cr3", "arw", "raf", "rw2", "orf", "pef", "raw"]);
const DEFAULTS = Object.freeze({
  threshold: 8,
  radius: 3,
  repairRadius: 3,
  gain: 5,
  hdrOutput: false,
  hdrGain: 1,
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
  parallelism: 2,
});

const TEXT = {
  en: {
    "meta.title": "Local Color Star Extractor", "meta.description": "A color star extractor that processes photos entirely in your browser",
    "hero.title": "Keep the stars.", "hero.subtitle": "Your photos stay on your device.", "hero.description": "RAW decoding, star detection, and PNG generation all run locally in your browser. Original star colors and relative brightness are preserved; the server only delivers static files.",
    "badge.privacy": "🔒 Zero upload · Local processing", "engine.detecting": "Detecting WebGPU…", "engine.enabled": "WebGPU enabled", "engine.cpu": "CPU Worker mode", "engine.inline": "Local main-thread compatibility mode", "engine.available": "WebGPU available; it will be enabled during processing", "engine.unavailable": "WebGPU unavailable; CPU Worker will be used",
    "upload.drop": "Drop photos here", "upload.choose": "or click to choose local files", "upload.formats": "DNG / common camera RAW / JPG / PNG / WebP", "file.batch": "BATCH", "file.remove": "Remove file", "file.clear": "Clear all", "file.selected": "{count} files selected", "file.total": "{size} total · files stay in this tab and are never uploaded", "file.queued": "Queued", "file.decoding": "Decoding", "file.processing": "Processing", "file.done": "Done", "file.failed": "Failed", "file.cancelled": "Cancelled",
    "control.threshold": "Detection strictness", "control.thresholdHint": "Higher values reduce false positives but may miss faint stars", "control.radius": "Star expansion", "control.radiusHint": "Keep color and glow around each detected star", "control.repairRadius": "Background repair expansion", "control.repairRadiusHint": "Exclude this many extra pixels beyond the detected star footprint when sampling a starless background", "control.gain": "Uniform brightness gain", "control.gainSlider": "Brightness gain slider", "control.gainHint": "Stars are never normalized individually.",
    "background.legend": "Export background", "background.black": "Black", "background.transparent": "Transparent", "background.preserve": "Preserve background", "background.hint": "Preserve background removes detected stars, interpolates a starless background from nearby pixels, then adds the enhanced color stars back.",
    "hdr.title": "HDR star output", "hdr.hint": "Export a 16-bit Rec.2100 PQ PNG; only detected starlight receives the extra HDR gain", "hdr.gain": "HDR starlight gain",
    "landscape.title": "Exclude warm landscapes", "landscape.hint": "Reduce trees and building lights detected as stars", "gpu.title": "Prefer WebGPU", "gpu.hint": "Automatically fall back to a CPU Worker when unavailable or unsuccessful", "parallel.title": "Parallel jobs", "parallel.hint": "Memory-aware scheduling may temporarily use fewer jobs",
    "range.threshold": "Range: 4–14 · Default: 8", "range.radius": "Range: 0–6 px · Default: 3 px", "range.repairRadius": "Range: 0–64 px · Default: 3 px", "range.gain": "Slider: 0×–10× · Manual: 0×–1000× · Default: 5×", "range.background": "Options: Black / Transparent / Preserve · Default: Preserve", "range.hdr": "Options: Off / On · Default: Off", "range.hdrGain": "Range: 1×–1000× · Default: 1×", "range.landscape": "Options: Off / On · Default: On", "range.gpu": "Options: Off / On · Default: On", "range.parallel": "Range: 1–4 · Default: 2",
    "range.core": "Range: 0.25–2 · Default: 0.65", "range.surround": "Range: 1–10 · Default: 3", "range.backgroundSigma": "Range: 4–40 · Default: 12", "range.minArea": "Range: 1–20 px² · Default: 1 px²", "range.maxArea": "Range: 1–400 px² · Default: 60 px²", "range.maxSize": "Range: 3–60 px · Default: 14 px", "range.chroma": "Range: 0.34–1 · Default: 0.72", "range.halo": "Range: -1–3 · Default: 0.2", "range.sky": "Range: 0.5–1.2 · Default: 0.9", "range.landscapeScale": "Range: 4–64 px · Default: 16 px", "range.landscapeBlur": "Range: 0–12 · Default: 4",
    "advanced.title": "Advanced detection settings", "advanced.hint": "Every option has a default value", "advanced.core": "Star core scale", "advanced.surround": "Surround scale", "advanced.background": "Background scale", "advanced.minArea": "Minimum star area", "advanced.maxArea": "Maximum star area", "advanced.maxSize": "Maximum star size", "advanced.chroma": "Monochrome spike limit", "advanced.halo": "Halo retention floor", "advanced.sky": "Cool-sky ratio", "advanced.landscapeScale": "Landscape sample spacing", "advanced.landscapeBlur": "Landscape smoothing scale", "advanced.reset": "Restore all defaults",
    "action.extract": "Extract color stars locally", "action.extractBatch": "Process {count} files locally", "action.processing": "Processing locally…", "action.processingBatch": "Processing {count} files…", "action.download": "Download color PNG", "action.downloadSelected": "Download selected PNG", "action.downloadAll": "Download all as ZIP", "action.zipping": "Building ZIP {percent}%", "progress.readFile": "Read file", "progress.notStarted": "Not started",
    "preview.title": "Color stars", "preview.waiting": "Waiting", "preview.empty": "Your local result will appear here", "preview.alt": "Extracted color stars", "preview.processing": "Analyzing starlight locally…", "privacy.footer": "Photo data is never sent over the network. Closing or refreshing this tab releases the temporary processing data.",
    "file.raw": "Camera RAW (16-bit linear decode)", "file.standard": "Standard image (converted to linear light)", "status.fileLocal": "The file remains in this tab's memory and is never uploaded.", "error.outOfRange": "{field} is outside the valid range", "error.surround": "Surround scale must be greater than star core scale", "error.area": "Maximum star area cannot be smaller than minimum star area",
    "raw.read": "Read RAW", "raw.load": "Loading the local 16-bit RAW decoder", "common.cancelled": "Cancelled", "raw.decode": "Decode RAW", "raw.fullParallel": "16-bit linear full resolution · browser parallel", "raw.fullLow": "16-bit linear full resolution · low-memory single thread", "error.rawSize": "The RAW file does not contain valid full-resolution dimensions", "error.rawDecode": "The RAW decoder returned no valid image; this camera compression format may not be supported yet", "image.read": "Read image", "image.decode": "Decoding the local image in your browser",
    "status.localProcessing": "All computation stays in this browser tab. Keep the page open while processing large RAW files.", "decode.complete": "Decode complete", "decode.memory": "{width} × {height} · estimated peak memory {memory}", "error.memory": "This image is estimated to require about {memory}, above the browser safety limit. Close other tabs and try again; resolution will not be reduced.", "error.worker": "The processing Worker stopped unexpectedly",
    "result.meta": "{width} × {height} · {stars} stars", "result.done": "Done: retained {stars} stars and {pixels} color pixels. The original image was not uploaded.", "status.cancelled": "Processing cancelled; temporary local data was released.", "status.failed": "Processing failed: {error}", "status.noOutput": "An error occurred; no output file was created", "status.defaults": "All parameters were restored to their defaults.", "batch.overall": "Overall progress", "batch.running": "{completed}/{total} finished · {running} active · up to {parallel} parallel", "batch.complete": "Batch complete: {completed} files processed.", "batch.completeErrors": "Batch complete: {completed} succeeded, {failed} failed.", "batch.result": "{stars} stars · {size}", "zip.progress": "Packaging {completed}/{total} files · {percent}%", "zip.complete": "ZIP ready: {count} files · {size}",
  },
  zh: {
    "meta.title": "本地彩色星点提取器", "meta.description": "照片完全在浏览器本地处理的彩色星点提取器",
    "hero.title": "留下星光。", "hero.subtitle": "照片不离开你的电脑。", "hero.description": "RAW 解码、星点检测与 PNG 生成全部在浏览器本地完成。保留每颗星的原始颜色和明暗层次，服务器只提供网页文件。",
    "badge.privacy": "🔒 零上传 · 本地处理", "engine.detecting": "正在检测 WebGPU…", "engine.enabled": "WebGPU 已启用", "engine.cpu": "CPU Worker 模式", "engine.inline": "本地主线程兼容模式", "engine.available": "WebGPU 可用，处理时尝试启用", "engine.unavailable": "WebGPU 不可用，将使用 CPU Worker",
    "upload.drop": "把照片拖到这里", "upload.choose": "或点击选择多个本地文件", "upload.formats": "DNG / 常见相机 RAW / JPG / PNG / WebP", "file.batch": "批量", "file.remove": "移除文件", "file.clear": "全部清除", "file.selected": "已选择 {count} 个文件", "file.total": "共 {size} · 文件仅保存在当前标签页且不会上传", "file.queued": "等待中", "file.decoding": "解码中", "file.processing": "处理中", "file.done": "完成", "file.failed": "失败", "file.cancelled": "已取消",
    "control.threshold": "检测严格度", "control.thresholdHint": "越高越少误检，暗星也可能减少", "control.radius": "星点外扩", "control.radiusHint": "保留星点周围的颜色与光晕", "control.repairRadius": "背景修复扩展", "control.repairRadiusHint": "生成无星背景时，在已识别星点范围之外额外排除的采样距离", "control.gain": "统一亮度倍率", "control.gainSlider": "亮度倍率滑块", "control.gainHint": "不会对单颗星自动归一化。",
    "background.legend": "导出背景", "background.black": "黑色", "background.transparent": "透明", "background.preserve": "保留背景", "background.hint": "“保留背景”会先移除星点并从周围像素插值得到无星背景，再叠回增强后的彩色星光。",
    "hdr.title": "HDR 星光输出", "hdr.hint": "导出 16 位 Rec.2100 PQ PNG；仅对已识别的星光应用额外 HDR 增益", "hdr.gain": "HDR 星光增益",
    "landscape.title": "排除暖色地景", "landscape.hint": "减少树木、建筑灯光被识别为星点", "gpu.title": "优先使用 WebGPU", "gpu.hint": "不可用或失败时自动回退 CPU Worker", "parallel.title": "并行任务数", "parallel.hint": "内存感知调度可能临时减少实际并发数",
    "range.threshold": "范围：4–14 · 默认：8", "range.radius": "范围：0–6 px · 默认：3 px", "range.repairRadius": "范围：0–64 px · 默认：3 px", "range.gain": "滑块：0×–10× · 手动输入：0×–1000× · 默认：5×", "range.background": "选项：黑色 / 透明 / 保留背景 · 默认：保留背景", "range.hdr": "选项：关 / 开 · 默认：关", "range.hdrGain": "范围：1×–1000× · 默认：1×", "range.landscape": "选项：关 / 开 · 默认：开", "range.gpu": "选项：关 / 开 · 默认：开", "range.parallel": "范围：1–4 · 默认：2",
    "range.core": "范围：0.25–2 · 默认：0.65", "range.surround": "范围：1–10 · 默认：3", "range.backgroundSigma": "范围：4–40 · 默认：12", "range.minArea": "范围：1–20 px² · 默认：1 px²", "range.maxArea": "范围：1–400 px² · 默认：60 px²", "range.maxSize": "范围：3–60 px · 默认：14 px", "range.chroma": "范围：0.34–1 · 默认：0.72", "range.halo": "范围：-1–3 · 默认：0.2", "range.sky": "范围：0.5–1.2 · 默认：0.9", "range.landscapeScale": "范围：4–64 px · 默认：16 px", "range.landscapeBlur": "范围：0–12 · 默认：4",
    "advanced.title": "高级检测参数", "advanced.hint": "全部参数均有默认值", "advanced.core": "星核尺度", "advanced.surround": "周边尺度", "advanced.background": "背景尺度", "advanced.minArea": "最小星点面积", "advanced.maxArea": "最大星点面积", "advanced.maxSize": "最大星点边长", "advanced.chroma": "单色尖峰上限", "advanced.halo": "光晕保留阈值", "advanced.sky": "天空冷色比例", "advanced.landscapeScale": "地景采样间隔", "advanced.landscapeBlur": "地景平滑尺度", "advanced.reset": "恢复全部默认值",
    "action.extract": "在本机提取彩色星点", "action.extractBatch": "在本机处理 {count} 个文件", "action.processing": "正在本机处理…", "action.processingBatch": "正在处理 {count} 个文件…", "action.download": "下载彩色 PNG", "action.downloadSelected": "下载当前 PNG", "action.downloadAll": "打包全部为 ZIP", "action.zipping": "正在生成 ZIP {percent}%", "progress.readFile": "读取文件", "progress.notStarted": "尚未开始",
    "preview.title": "彩色星点", "preview.waiting": "等待处理", "preview.empty": "本地处理结果将在这里显示", "preview.alt": "彩色星点提取结果", "preview.processing": "正在本机分析星光…", "privacy.footer": "照片内容不会通过网络发送。关闭或刷新页面后，本次处理数据即从页面内存中释放。",
    "file.raw": "相机 RAW（16 位线性解码）", "file.standard": "标准图片（转为线性光）", "status.fileLocal": "文件仅保存在当前页面内存中，不会上传。", "error.outOfRange": "{field} 超出有效范围", "error.surround": "周边尺度必须大于星核尺度", "error.area": "最大星点面积不能小于最小面积",
    "raw.read": "读取 RAW", "raw.load": "加载本地 16 位 RAW 解码器", "common.cancelled": "已取消", "raw.decode": "解码 RAW", "raw.fullParallel": "16 位线性全分辨率 · 浏览器并行", "raw.fullLow": "16 位线性全分辨率 · 低内存单线程", "error.rawSize": "RAW 文件缺少有效的全分辨率尺寸信息", "error.rawDecode": "RAW 解码器没有返回有效图像；该相机压缩格式可能暂不受支持", "image.read": "读取图片", "image.decode": "浏览器正在解码本地文件",
    "status.localProcessing": "所有计算都在这个浏览器标签页内进行。处理大 RAW 时请保持页面开启。", "decode.complete": "解码完成", "decode.memory": "{width} × {height} · 预计峰值内存约 {memory}", "error.memory": "该图片预计需要约 {memory} 内存，超过浏览器安全上限。可关闭其他标签页后再试；不会自动降分辨率。", "error.worker": "处理 Worker 意外终止",
    "result.meta": "{width} × {height} · {stars} 颗星", "result.done": "完成：保留 {stars} 颗星、{pixels} 个彩色像素。原图没有上传。", "status.cancelled": "处理已取消；本地临时数据已释放。", "status.failed": "处理失败：{error}", "status.noOutput": "发生错误，未生成输出文件", "status.defaults": "参数已恢复默认值。", "batch.overall": "总体进度", "batch.running": "已完成 {completed}/{total} · {running} 个运行中 · 最多并行 {parallel} 个", "batch.complete": "批量处理完成：已处理 {completed} 个文件。", "batch.completeErrors": "批量处理完成：{completed} 个成功，{failed} 个失败。", "batch.result": "{stars} 颗星 · {size}", "zip.progress": "正在打包 {completed}/{total} 个文件 · {percent}%", "zip.complete": "ZIP 已生成：{count} 个文件 · {size}",
  },
};

let locale = "en";
const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), TEXT[locale][key] || TEXT.en[key] || key);

const $ = (selector) => document.querySelector(selector);
const elements = {
  fileInput: $("#fileInput"), dropZone: $("#dropZone"), fileCard: $("#fileCard"), fileName: $("#fileName"), fileSize: $("#fileSize"),
  fileList: $("#fileList"), removeFile: $("#removeFile"), extract: $("#extractButton"), buttonLabel: $("#buttonLabel"), engine: $("#engineBadge"), parallelism: $("#parallelism"), gainInput: $("#gainInput"),
  progressBox: $("#progressBox"), progressStage: $("#progressStage"), progressValue: $("#progressValue"), progressBar: $("#progressBar"), progressDetail: $("#progressDetail"),
  status: $("#status"), processing: $("#processing"), emptyPreview: $("#emptyPreview"), resultImage: $("#resultImage"),
  resultMeta: $("#resultMeta"), resultList: $("#resultList"), download: $("#downloadButton"), downloadAll: $("#downloadAllButton"), reset: $("#resetDefaults"), language: $("#languageToggle"),
};

let jobs = [];
let nextJobId = 1;
let currentPreviewId = null;
let batchToken = 0;
let engineState = "detect";
let busyState = false;
let archiveState = null;
let statusState = null;

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
  renderFileList();
  renderResults();
  updateOverallProgress();
  updatePreview();
  if (statusState) setStatus(t(statusState.key, statusState.values), statusState.error, statusState);
}

function toggleLocale() {
  locale = locale === "en" ? "zh" : "en";
  applyLocale();
  for (const job of jobs) job.worker?.postMessage({ type: "locale", locale });
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

function addFiles(files) {
  if (busyState || archiveState) return;
  const known = new Set(jobs.map((job) => `${job.file.name}\0${job.file.size}\0${job.file.lastModified}`));
  for (const file of files) {
    const key = `${file.name}\0${file.size}\0${file.lastModified}`;
    if (known.has(key)) continue;
    known.add(key);
    jobs.push({ id: nextJobId++, file, status: "queued", progress: 0, stage: "", detail: "", worker: null, raw: null, abort: null, result: null, resultUrl: null, error: "", reservation: reservationEstimate(file) });
  }
  elements.fileInput.value = "";
  renderFileList();
  renderResults();
  updateOverallProgress();
  setBusy(false);
  setStatusKey("status.fileLocal");
}

function reservationEstimate(file) {
  return isRaw(file) ? Math.max(420_000_000, file.size * 24) : Math.max(160_000_000, file.size * 12);
}

function jobStateText(job) {
  return t(`file.${job.status}`);
}

function jobDetailText(job) {
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  if (job.status === "done" && job.result) return t("batch.result", { stars: job.result.stars.toLocaleString(numberLocale), size: formatBytes(job.result.blob.size) });
  return job.detail || job.stage || `${formatBytes(job.file.size)} · ${t(isRaw(job.file) ? "file.raw" : "file.standard")}`;
}

function renderFileList() {
  elements.fileCard.classList.toggle("hidden", jobs.length === 0);
  if (!jobs.length) {
    elements.fileList.replaceChildren();
    return;
  }
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  const totalBytes = jobs.reduce((sum, job) => sum + job.file.size, 0);
  elements.fileName.textContent = t("file.selected", { count: jobs.length.toLocaleString(numberLocale) });
  elements.fileSize.textContent = t("file.total", { size: formatBytes(totalBytes) });
  const fragment = document.createDocumentFragment();
  for (const job of jobs) {
    const row = document.createElement("div");
    row.className = `file-item ${job.status === "failed" ? "error" : ""}`;
    row.dataset.jobId = job.id;
    const head = document.createElement("div");
    head.className = "file-item-head";
    const type = document.createElement("span");
    type.className = "file-item-type";
    type.textContent = isRaw(job.file) ? extension(job.file).toUpperCase() : "IMG";
    const name = document.createElement("strong");
    name.className = "file-item-name";
    name.textContent = job.file.name;
    const state = document.createElement("span");
    state.className = `file-item-state ${job.status === "done" ? "done" : job.status === "failed" ? "error" : ""}`;
    state.textContent = jobStateText(job);
    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.type = "button";
    remove.disabled = busyState || Boolean(archiveState);
    remove.setAttribute("aria-label", t("file.remove"));
    remove.textContent = "×";
    remove.addEventListener("click", () => removeJob(job.id));
    head.append(type, name, state, remove);
    const detail = document.createElement("small");
    detail.className = "file-item-detail";
    detail.textContent = jobDetailText(job);
    const track = document.createElement("div");
    track.className = "file-progress";
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(0, Math.min(100, job.progress))}%`;
    track.append(fill);
    row.append(head, detail, track);
    fragment.append(row);
  }
  elements.fileList.replaceChildren(fragment);
}

function updateJobRow(job) {
  const row = elements.fileList.querySelector(`[data-job-id="${job.id}"]`);
  if (!row) { renderFileList(); return; }
  row.classList.toggle("error", job.status === "failed");
  const state = row.querySelector(".file-item-state");
  state.className = `file-item-state ${job.status === "done" ? "done" : job.status === "failed" ? "error" : ""}`;
  state.textContent = jobStateText(job);
  row.querySelector(".file-item-detail").textContent = jobDetailText(job);
  row.querySelector(".file-progress i").style.width = `${Math.max(0, Math.min(100, job.progress))}%`;
}

function removeJob(id) {
  if (busyState || archiveState) return;
  const index = jobs.findIndex((job) => job.id === id);
  if (index < 0) return;
  if (jobs[index].resultUrl) URL.revokeObjectURL(jobs[index].resultUrl);
  jobs.splice(index, 1);
  if (currentPreviewId === id) currentPreviewId = jobs.find((job) => job.result)?.id ?? null;
  renderFileList();
  renderResults();
  updatePreview();
  updateOverallProgress();
  setBusy(false);
}

function clearFiles() {
  if (busyState || archiveState) return;
  for (const job of jobs) if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
  jobs = [];
  currentPreviewId = null;
  elements.fileInput.value = "";
  elements.progressBox.classList.add("hidden");
  renderFileList();
  renderResults();
  updatePreview();
  setBusy(false);
  setStatus("");
}

function clearResults() {
  for (const job of jobs) {
    if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
    Object.assign(job, { status: "queued", progress: 0, stage: "", detail: "", result: null, resultUrl: null, error: "" });
  }
  currentPreviewId = null;
  renderFileList();
  renderResults();
  updatePreview();
}

function setStatus(text, error = false, descriptor = null) {
  statusState = descriptor;
  elements.status.textContent = text;
  elements.status.classList.toggle("error", error);
}

function setStatusKey(key, values = {}, error = false) {
  setStatus(t(key, values), error, { key, values, error });
}

function setOverallProgress(value, stage, detail) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  elements.progressBox.classList.remove("hidden");
  elements.progressValue.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  if (stage) elements.progressStage.textContent = stage;
  if (detail) elements.progressDetail.textContent = detail;
}

function setJobProgress(job, value, stage, detail) {
  job.progress = Math.max(0, Math.min(100, Math.round(value)));
  if (stage) job.stage = stage;
  if (detail) job.detail = detail;
  updateJobRow(job);
  updateOverallProgress();
}

function updateOverallProgress() {
  if (!jobs.length) return;
  if (jobs.length === 1) {
    const job = jobs[0];
    setOverallProgress(job.progress, job.stage || t("progress.readFile"), job.detail || t("progress.notStarted"));
    return;
  }
  const percent = jobs.reduce((sum, job) => sum + job.progress, 0) / jobs.length;
  const completed = jobs.filter((job) => job.status === "done" || job.status === "failed" || job.status === "cancelled").length;
  const running = jobs.filter((job) => job.status === "decoding" || job.status === "processing").length;
  setOverallProgress(percent, t("batch.overall"), t("batch.running", { completed, total: jobs.length, running, parallel: elements.parallelism.value }));
}

function setBusy(busy) {
  busyState = busy;
  const locked = busy || Boolean(archiveState);
  elements.extract.disabled = locked || jobs.length === 0;
  elements.removeFile.disabled = locked;
  elements.fileInput.disabled = locked;
  for (const control of document.querySelectorAll(".controls input, .controls select, .controls button")) control.disabled = locked;
  elements.processing.classList.toggle("hidden", !busy || Boolean(currentPreviewId));
  const count = jobs.length;
  elements.buttonLabel.textContent = count > 1 ? t(busy ? "action.processingBatch" : "action.extractBatch", { count }) : t(busy ? "action.processing" : "action.extract");
  renderFileList();
}

function numberValue(id) {
  const input = document.getElementById(id);
  const raw = input.value.trim();
  const value = Number(raw);
  const min = Number(input.min);
  const max = Number(input.max);
  if (raw === "" || !Number.isFinite(value) || value < min || value > max) throw new Error(t("error.outOfRange", { field: input.closest("label")?.innerText?.split("\n")[0] || id }));
  return value;
}

function options() {
  const value = {
    threshold: numberValue("threshold"), radius: numberValue("radius"), repairRadius: numberValue("repairRadius"), gain: numberValue("gainInput"),
    background: document.querySelector('input[name="background"]:checked').value,
    hdrOutput: $("#hdrOutput").checked, hdrGain: numberValue("hdrGain"),
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

async function decodeRaw(job, token) {
  setJobProgress(job, 3, t("raw.read"), t("raw.load"));
  const runtimeUrl = new URL(`${import.meta.env.BASE_URL}luma/index.js`, window.location.origin).href;
  const module = await import(/* @vite-ignore */ runtimeUrl);
  if (token !== batchToken) throw new DOMException(t("common.cancelled"), "AbortError");
  const isolated = globalThis.crossOriginIsolated === true;
  job.abort = new AbortController();
  job.raw = module.createLumaRawRuntime({
    memoryProfile: isolated ? "desktop" : "low-memory",
    requireCrossOriginIsolation: isolated,
  });
  let session = null;
  try {
    const info = await job.raw.init();
    setJobProgress(job, 7, t("raw.decode"), t(info.pthreads ? "raw.fullParallel" : "raw.fullLow"));
    session = await job.raw.openSession(job.file, {}, job.abort.signal);
    const fullPixels = (session.probe.width || 0) * (session.probe.height || 0);
    if (!fullPixels) throw new Error(t("error.rawSize"));
    const decoded = await session.decodeBoundedHq({ maxOutputPixels: fullPixels }, job.abort.signal);
    if (!decoded?.data || !decoded.width || !decoded.height) throw new Error(t("error.rawDecode"));
    return {
      width: decoded.width, height: decoded.height, colors: 3, bits: decoded.bitDepth || 16,
      sourceKind: "raw", buffer: transferableView(decoded.data),
    };
  } finally {
    try { session?.dispose(); } catch {}
    try { job.raw?.dispose(); } catch {}
    job.raw = null;
    job.abort = null;
  }
}

async function decodeStandard(job) {
  setJobProgress(job, 4, t("image.read"), t("image.decode"));
  const bitmap = await createImageBitmap(job.file, { colorSpaceConversion: "default", premultiplyAlpha: "none" });
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

function createProcessorWorker() {
  return new Worker(new URL("./processor.worker.js", import.meta.url), { type: "module" });
}

function memoryBudget() {
  const deviceGiB = Number(navigator.deviceMemory) || 8;
  return Math.min(1_400_000_000, Math.max(520_000_000, deviceGiB * 1024 ** 3 * 0.22));
}

async function processFiles() {
  if (!jobs.length || busyState || archiveState) return;
  let config;
  try {
    config = options();
  } catch (error) {
    setStatusKey("status.failed", { error: error?.message || error }, true);
    return;
  }
  const token = ++batchToken;
  clearResults();
  setBusy(true);
  setStatusKey("status.localProcessing");
  updateOverallProgress();
  const pending = [...jobs];
  const active = new Set();
  const parallel = Math.max(1, Math.min(4, Number(elements.parallelism.value) || 2));
  const budget = memoryBudget();
  let reserved = 0;

  await new Promise((resolve) => {
    const launch = () => {
      if (token !== batchToken) { resolve(); return; }
      while (pending.length && active.size < parallel) {
        let index = pending.findIndex((job) => active.size === 0 || reserved + job.reservation <= budget);
        if (index < 0) break;
        const job = pending.splice(index, 1)[0];
        active.add(job);
        reserved += job.reservation;
        runJob(job, config, token).finally(() => {
          reserved -= job.reservation;
          active.delete(job);
          if (!pending.length && !active.size) resolve();
          else launch();
        });
      }
      if (!pending.length && !active.size) resolve();
    };
    launch();
  });

  if (token !== batchToken) return;
  setBusy(false);
  updateOverallProgress();
  const completed = jobs.filter((job) => job.status === "done").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  if (jobs.length === 1 && completed === 1) {
    const result = jobs[0].result;
    const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
    setStatusKey("result.done", { stars: result.stars.toLocaleString(numberLocale), pixels: result.pixels.toLocaleString(numberLocale) });
  } else setStatusKey(failed ? "batch.completeErrors" : "batch.complete", failed ? { completed, failed } : { completed }, failed > 0);
}

async function runJob(job, config, token) {
  try {
    job.status = "decoding";
    updateJobRow(job);
    const decoded = isRaw(job.file) ? await decodeRaw(job, token) : await decodeStandard(job);
    if (token !== batchToken) throw new DOMException(t("common.cancelled"), "AbortError");
    const estimate = memoryEstimate(decoded);
    setJobProgress(job, 20, t("decode.complete"), t("decode.memory", { width: decoded.width, height: decoded.height, memory: formatBytes(estimate) }));
    if (estimate > 1_600_000_000) throw new Error(t("error.memory", { memory: formatBytes(estimate) }));
    job.status = "processing";
    job.background = config.background;
    job.hdrOutput = config.hdrOutput;
    updateJobRow(job);
    updateOverallProgress();
    await processDecoded(job, decoded, config, token);
  } catch (error) {
    failJob(job, error, token);
  } finally {
    disposeJobRuntime(job);
    updateJobRow(job);
    renderResults();
    updatePreview();
    updateOverallProgress();
  }
}

function processDecoded(job, decoded, config, token) {
  return new Promise((resolve, reject) => {
    if (token !== batchToken) { reject(new DOMException(t("common.cancelled"), "AbortError")); return; }
    job.worker = createProcessorWorker();
    job.reject = reject;
    job.worker.onmessage = ({ data: message }) => {
      if (message.type === "progress") setJobProgress(job, message.value, message.stage, message.detail);
      else if (message.type === "pulse") setJobProgress(job, job.progress, job.stage, message.detail);
      else if (message.type === "engine") {
        setEngineBadge(message.engine);
        if (message.warning) setJobProgress(job, job.progress, job.stage, message.warning);
      } else if (message.type === "result") {
        finishJob(job, message);
        resolve();
      } else if (message.type === "error") reject(new Error(message.message));
    };
    job.worker.onerror = (event) => reject(new Error(event.message || t("error.worker")));
    job.worker.postMessage({ type: "process", ...decoded, options: config, locale }, [decoded.buffer]);
  });
}

function finishJob(job, message) {
  job.result = message;
  job.resultUrl = URL.createObjectURL(message.blob);
  job.status = "done";
  job.progress = 100;
  job.stage = jobStateText(job);
  job.detail = t("batch.result", { stars: message.stars.toLocaleString(locale === "zh" ? "zh-CN" : "en-US"), size: formatBytes(message.blob.size) });
  if (currentPreviewId == null) currentPreviewId = job.id;
}

function failJob(job, error, token) {
  const cancelled = token !== batchToken || error?.name === "AbortError" || /disposed|cancelled|已取消/i.test(error?.message || "");
  job.status = cancelled ? "cancelled" : "failed";
  job.progress = 100;
  job.stage = jobStateText(job);
  job.error = cancelled ? t("common.cancelled") : String(error?.message || error).split("\n")[0];
  job.detail = job.error;
  if (!cancelled) console.error(error);
}

function disposeJobRuntime(job) {
  try { job.abort?.abort(); } catch {}
  job.abort = null;
  try { job.raw?.dispose(); } catch {}
  job.raw = null;
  try { job.worker?.terminate(); } catch {}
  job.worker = null;
  job.reject = null;
}

function cancelProcessing() {
  batchToken++;
  for (const job of jobs) {
    job.reject?.(new DOMException(t("common.cancelled"), "AbortError"));
    disposeJobRuntime(job);
  }
  setBusy(false);
}

function renderResults() {
  const completed = jobs.filter((job) => job.status === "done");
  elements.resultList.classList.toggle("hidden", completed.length < 2);
  elements.downloadAll.classList.toggle("hidden", completed.length < 2);
  elements.downloadAll.disabled = completed.length < 2 || Boolean(archiveState);
  elements.downloadAll.textContent = archiveState ? t("action.zipping", { percent: archiveState.percent }) : t("action.downloadAll");
  const fragment = document.createDocumentFragment();
  for (const job of completed) {
    const button = document.createElement("button");
    button.className = `result-item ${job.id === currentPreviewId ? "selected" : ""}`;
    button.type = "button";
    const name = document.createElement("strong");
    name.textContent = job.file.name;
    const meta = document.createElement("small");
    meta.textContent = t("batch.result", { stars: job.result.stars.toLocaleString(locale === "zh" ? "zh-CN" : "en-US"), size: formatBytes(job.result.blob.size) });
    button.append(name, meta);
    button.addEventListener("click", () => { currentPreviewId = job.id; renderResults(); updatePreview(); });
    fragment.append(button);
  }
  elements.resultList.replaceChildren(fragment);
}

function updatePreview() {
  let job = jobs.find((item) => item.id === currentPreviewId && item.result);
  if (!job) job = jobs.find((item) => item.result);
  currentPreviewId = job?.id ?? null;
  if (!job) {
    elements.resultImage.removeAttribute("src");
    elements.resultImage.classList.add("hidden");
    elements.emptyPreview.classList.remove("hidden");
    elements.resultMeta.textContent = t("preview.waiting");
    elements.download.disabled = true;
  } else {
    elements.resultImage.src = job.resultUrl;
    elements.resultImage.classList.remove("hidden");
    elements.emptyPreview.classList.add("hidden");
    const stars = job.result.stars.toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
    elements.resultMeta.textContent = t("result.meta", { width: job.result.width, height: job.result.height, stars });
    elements.download.disabled = Boolean(archiveState);
  }
  elements.processing.classList.toggle("hidden", !busyState || Boolean(job));
}

function outputFilename(job) {
  const stem = job.file.name.replace(/\.[^.]+$/, "");
  const base = job.background === "preserve" ? `${stem}_enhanced_stars_background` : `${stem}_color_stars`;
  return `${base}${job.hdrOutput ? "_hdr" : ""}.png`;
}

function downloadJob(job) {
  if (!job?.resultUrl) return;
  const anchor = document.createElement("a");
  anchor.href = job.resultUrl;
  anchor.download = outputFilename(job);
  anchor.click();
}

function downloadResult() { downloadJob(jobs.find((job) => job.id === currentPreviewId)); }

function archiveEntries(completed) {
  const used = new Set();
  return completed.map((job) => {
    const original = outputFilename(job).replaceAll("/", "_").replaceAll("\\", "_");
    const dot = original.lastIndexOf(".");
    const stem = dot > 0 ? original.slice(0, dot) : original;
    const extension = dot > 0 ? original.slice(dot) : "";
    let name = original;
    let copy = 2;
    while (used.has(name.toLocaleLowerCase())) name = `${stem}_${copy++}${extension}`;
    used.add(name.toLocaleLowerCase());
    return { name, blob: job.result.blob, date: new Date(job.file.lastModified || Date.now()) };
  });
}

async function downloadAllResults() {
  const completed = jobs.filter((job) => job.status === "done");
  if (completed.length < 2 || archiveState || busyState) return;
  archiveState = { percent: 0, completed: 0 };
  setBusy(false);
  renderResults();
  updatePreview();
  try {
    const entries = archiveEntries(completed);
    const zip = await createStoredZip(entries, (progress) => {
      const percent = progress.totalBytes ? Math.min(100, Math.round(progress.processedBytes / progress.totalBytes * 100)) : Math.round(progress.completed / progress.total * 100);
      if (archiveState.percent === percent && archiveState.completed === progress.completed) return;
      archiveState = { percent, completed: progress.completed };
      elements.downloadAll.textContent = t("action.zipping", { percent });
      setStatusKey("zip.progress", { completed: progress.completed, total: progress.total, percent });
    });
    const url = URL.createObjectURL(zip);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `star-color-results-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatusKey("zip.complete", { count: entries.length, size: formatBytes(zip.size) });
  } catch (error) {
    setStatusKey("status.failed", { error: error?.message || String(error) }, true);
  } finally {
    archiveState = null;
    setBusy(false);
    renderResults();
    updatePreview();
  }
}

function resetDefaults() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (key === "background") document.querySelector(`input[name="background"][value="${value}"]`).checked = true;
    else {
      const input = document.getElementById(key);
      if (input) input.type === "checkbox" ? input.checked = value : input.value = value;
      if (key === "gain") elements.gainInput.value = value;
    }
  }
  updateRangeLabels();
  setStatusKey("status.defaults");
}

function updateRangeLabels() {
  $("#thresholdValue").textContent = Number($("#threshold").value).toFixed(1);
  $("#radiusValue").textContent = `${$("#radius").value} px`;
  $("#repairRadiusValue").textContent = `${$("#repairRadius").value} px`;
}

function syncGainFromSlider() {
  elements.gainInput.value = Number($("#gain").value).toFixed(2).replace(/\.00$/, "");
}

function syncSliderFromGain() {
  const value = Number(elements.gainInput.value);
  if (!Number.isFinite(value)) return;
  $("#gain").value = Math.max(0, Math.min(10, value));
}

elements.fileInput.addEventListener("change", () => addFiles(elements.fileInput.files));
elements.removeFile.addEventListener("click", clearFiles);
elements.extract.addEventListener("click", processFiles);
elements.download.addEventListener("click", downloadResult);
elements.downloadAll.addEventListener("click", downloadAllResults);
elements.reset.addEventListener("click", resetDefaults);
elements.language.addEventListener("click", toggleLocale);
for (const id of ["threshold", "radius", "repairRadius"]) document.getElementById(id).addEventListener("input", updateRangeLabels);
$("#gain").addEventListener("input", syncGainFromSlider);
elements.gainInput.addEventListener("input", syncSliderFromGain);
for (const eventName of ["dragenter", "dragover"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.add("dragging"); });
for (const eventName of ["dragleave", "drop"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.remove("dragging"); });
elements.dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
window.addEventListener("beforeunload", () => {
  cancelProcessing();
  for (const job of jobs) if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
});
