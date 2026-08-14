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

const $ = (selector) => document.querySelector(selector);
const elements = {
  fileInput: $("#fileInput"), dropZone: $("#dropZone"), fileCard: $("#fileCard"), fileName: $("#fileName"), fileSize: $("#fileSize"),
  removeFile: $("#removeFile"), extract: $("#extractButton"), buttonLabel: $("#buttonLabel"), engine: $("#engineBadge"),
  progressBox: $("#progressBox"), progressStage: $("#progressStage"), progressValue: $("#progressValue"), progressBar: $("#progressBar"), progressDetail: $("#progressDetail"),
  status: $("#status"), processing: $("#processing"), emptyPreview: $("#emptyPreview"), resultImage: $("#resultImage"),
  resultMeta: $("#resultMeta"), download: $("#downloadButton"), reset: $("#resetDefaults"),
};

let selectedFile = null;
let activeRaw = null;
let activeAbort = null;
let activeWorker = null;
let resultUrl = null;
let cancelled = false;

function setEngineBadge(engine, warning = "") {
  elements.engine.classList.remove("gpu", "cpu");
  if (engine === "webgpu") {
    elements.engine.classList.add("gpu");
    elements.engine.textContent = "WebGPU 已启用";
  } else if (engine === "cpu") {
    elements.engine.classList.add("cpu");
    elements.engine.textContent = "CPU Worker 模式";
  } else elements.engine.textContent = navigator.gpu ? "WebGPU 可用，处理时尝试启用" : "WebGPU 不可用，将使用 CPU Worker";
  if (warning) setStatus(warning);
}

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
  elements.fileSize.textContent = `${formatBytes(file.size)} · ${isRaw(file) ? "相机 RAW（16 位线性解码）" : "标准图片（转为线性光）"}`;
  $(".file-mark").textContent = isRaw(file) ? extension(file).toUpperCase() : "IMG";
  elements.dropZone.classList.add("hidden");
  elements.fileCard.classList.remove("hidden");
  elements.extract.disabled = false;
  clearResult();
  setStatus("文件仅保存在当前页面内存中，不会上传。", false);
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
  elements.resultMeta.textContent = "等待处理";
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
  elements.extract.disabled = busy || !selectedFile;
  elements.removeFile.disabled = busy;
  elements.processing.classList.toggle("hidden", !busy);
  elements.buttonLabel.textContent = busy ? "正在本机处理…" : "在本机提取彩色星点";
}

function numberValue(id) {
  const input = document.getElementById(id);
  const value = Number(input.value);
  const min = Number(input.min);
  const max = Number(input.max);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${input.closest("label")?.innerText?.split("\n")[0] || id} 超出有效范围`);
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
  if (value.surroundSigma <= value.coreSigma) throw new Error("周边尺度必须大于星核尺度");
  if (value.maxArea < value.minArea) throw new Error("最大星点面积不能小于最小面积");
  return value;
}

function transferableView(view) {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) return view.buffer;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

async function decodeRaw(file) {
  setProgress(3, "读取 RAW", "加载本地 16 位 RAW 解码器");
  const runtimeUrl = new URL(`${import.meta.env.BASE_URL}luma/index.js`, window.location.origin).href;
  const module = await import(/* @vite-ignore */ runtimeUrl);
  if (cancelled) throw new DOMException("已取消", "AbortError");
  const isolated = globalThis.crossOriginIsolated === true;
  activeAbort = new AbortController();
  activeRaw = module.createLumaRawRuntime({
    memoryProfile: isolated ? "desktop" : "low-memory",
    requireCrossOriginIsolation: isolated,
  });
  const info = await activeRaw.init();
  setProgress(7, "解码 RAW", `16 位线性全分辨率 · ${info.pthreads ? "浏览器并行" : "低内存单线程"}`);
  const session = await activeRaw.openSession(file, {}, activeAbort.signal);
  const fullPixels = (session.probe.width || 0) * (session.probe.height || 0);
  if (!fullPixels) throw new Error("RAW 文件缺少有效的全分辨率尺寸信息");
  const decoded = await session.decodeBoundedHq({ maxOutputPixels: fullPixels }, activeAbort.signal);
  session.dispose();
  activeRaw.dispose();
  activeRaw = null;
  activeAbort = null;
  if (!decoded?.data || !decoded.width || !decoded.height) throw new Error("RAW 解码器没有返回有效图像；该相机压缩格式可能暂不受支持");
  return {
    width: decoded.width, height: decoded.height, colors: 3, bits: decoded.bitDepth || 16,
    sourceKind: "raw", buffer: transferableView(decoded.data),
  };
}

async function decodeStandard(file) {
  setProgress(4, "读取图片", "浏览器正在解码本地文件");
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
  setStatus("所有计算都在这个浏览器标签页内进行。处理大 RAW 时请保持页面开启。", false);
  let decoded;
  try {
    const config = options();
    decoded = isRaw(selectedFile) ? await decodeRaw(selectedFile) : await decodeStandard(selectedFile);
    if (cancelled) throw new DOMException("已取消", "AbortError");
    const estimate = memoryEstimate(decoded);
    setProgress(20, "解码完成", `${decoded.width} × ${decoded.height} · 预计峰值内存约 ${formatBytes(estimate)}`);
    if (estimate > 1_600_000_000) throw new Error(`该图片预计需要约 ${formatBytes(estimate)} 内存，超过浏览器安全上限。可关闭其他标签页后再试；不会自动降分辨率。`);

    activeWorker = new Worker(new URL("./processor.worker.js", import.meta.url), { type: "module" });
    activeWorker.onmessage = ({ data: message }) => {
      if (message.type === "progress") setProgress(message.value, message.stage, message.detail);
      else if (message.type === "pulse") elements.progressDetail.textContent = message.detail;
      else if (message.type === "engine") setEngineBadge(message.engine, message.warning);
      else if (message.type === "result") finishResult(message);
      else if (message.type === "error") fail(new Error(message.message));
    };
    activeWorker.onerror = (event) => fail(new Error(event.message || "处理 Worker 意外终止"));
    activeWorker.postMessage({ type: "process", ...decoded, options: config }, [decoded.buffer]);
  } catch (error) {
    fail(error);
  }
}

function finishResult(message) {
  resultUrl = URL.createObjectURL(message.blob);
  elements.resultImage.src = resultUrl;
  elements.resultImage.classList.remove("hidden");
  elements.emptyPreview.classList.add("hidden");
  elements.download.disabled = false;
  elements.resultMeta.textContent = `${message.width} × ${message.height} · ${message.stars.toLocaleString()} 颗星`;
  setStatus(`完成：保留 ${message.stars.toLocaleString()} 颗星、${message.pixels.toLocaleString()} 个彩色像素。原图没有上传。`);
  activeWorker?.terminate();
  activeWorker = null;
  setBusy(false);
}

function fail(error) {
  activeRaw?.dispose();
  activeRaw = null;
  activeAbort = null;
  activeWorker?.terminate();
  activeWorker = null;
  setBusy(false);
  if (cancelled || error?.name === "AbortError" || /disposed|已取消/i.test(error?.message || "")) {
    setStatus("处理已取消；本地临时数据已释放。", false);
    elements.progressDetail.textContent = "已取消";
    return;
  }
  console.error(error);
  setStatus(`处理失败：${error?.message || error}`, true);
  elements.progressDetail.textContent = "发生错误，未生成输出文件";
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
    setStatus("处理已取消；本地临时数据已释放。", false);
    elements.progressDetail.textContent = "已取消";
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
  setStatus("参数已恢复默认值。", false);
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
for (const id of ["threshold", "radius", "gain"]) document.getElementById(id).addEventListener("input", updateRangeLabels);
for (const eventName of ["dragenter", "dragover"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.add("dragging"); });
for (const eventName of ["dragleave", "drop"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.remove("dragging"); });
elements.dropZone.addEventListener("drop", (event) => setFile(event.dataTransfer.files[0]));
window.addEventListener("beforeunload", () => { activeAbort?.abort(); activeRaw?.dispose(); activeWorker?.terminate(); if (resultUrl) URL.revokeObjectURL(resultUrl); });
