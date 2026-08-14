import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const output = resolve(root, "single", "star-color-local.html");
const text = (path) => readFileSync(resolve(root, path), "utf8");
const distText = (path) => readFileSync(resolve(dist, path), "utf8");
const b64 = (path) => readFileSync(resolve(dist, path)).toString("base64");
const jsString = (value) => JSON.stringify(value).replaceAll("</script", "<\\/script");

const processorName = readdirSync(resolve(dist, "assets")).find((name) => /^processor\.worker-.*\.js$/.test(name));
if (!processorName) throw new Error("Processor Worker was not found in the production build");
const processorWorker = distText(`assets/${processorName}`);
let runtimeWorker = distText("luma/assets/runtime.worker-D7iSnpaW.js");
let desktopNative = distText("luma/native/desktop/luma_raw.js");
const lowNative = distText("luma/native/low-memory/luma_raw.js");

desktopNative = desktopNative.replace(
  'new Worker(new URL("luma_raw.js",import.meta.url),{type:"module",name:"em-pthread"})',
  'new Worker(globalThis.__LUMA_NATIVE_JS_URL__,{type:"module",name:"em-pthread"})',
);
if (!desktopNative.includes("globalThis.__LUMA_NATIVE_JS_URL__")) throw new Error("Could not patch pthread worker URL");

const embeddedAssets = {
  desktop: { js: Buffer.from(desktopNative).toString("base64"), wasm: b64("luma/native/desktop/luma_raw.wasm") },
  "low-memory": { js: Buffer.from(lowNative).toString("base64"), wasm: b64("luma/native/low-memory/luma_raw.wasm") },
};
const workerPrelude = `
const __singleNativeAssets=${JSON.stringify(embeddedAssets)};
const __singleNativeUrls=new Map();
function __singleDecodeBase64(value){const raw=atob(value);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
function __singleNativeUrl(file,profile){const key=profile+":"+file;if(__singleNativeUrls.has(key))return __singleNativeUrls.get(key);const kind=file.endsWith(".wasm")?"wasm":"js";const type=kind==="wasm"?"application/wasm":"text/javascript";const url=URL.createObjectURL(new Blob([__singleDecodeBase64(__singleNativeAssets[profile][kind])],{type}));__singleNativeUrls.set(key,url);return url}
`;
runtimeWorker = workerPrelude + runtimeWorker;
runtimeWorker = runtimeWorker.replace(/function j\(e,t\)\{.*?\}function M\(/s, "function j(e,t){return __singleNativeUrl(e,t)}function M(");
runtimeWorker = runtimeWorker.replace(
  "let t=j(`luma_raw.js`,e),n=j(`luma_raw.wasm`,e),r;try{r=await import(t)}",
  "let t=j(`luma_raw.js`,e),n=j(`luma_raw.wasm`,e),r;globalThis.__LUMA_NATIVE_JS_URL__=t;try{r=globalThis.__LUMA_INLINE_NATIVE_FACTORY__?{default:globalThis.__LUMA_INLINE_NATIVE_FACTORY__(e)}:await import(t)}",
);
if (!runtimeWorker.includes("function j(e,t){return __singleNativeUrl(e,t)}")) throw new Error("Could not patch native resolver");
if (!runtimeWorker.includes("globalThis.__LUMA_NATIVE_JS_URL__=t")) throw new Error("Could not patch native pthread binding");

let main = text("src/main.js");
main = main.replace(
  /  const runtimeUrl = .*?\n  const module = await import\(\/\* @vite-ignore \*\/ runtimeUrl\);/s,
  "  const module = globalThis.__singleRawRuntime;",
);
main = main.replace("    requireCrossOriginIsolation: isolated,", "    requireCrossOriginIsolation: isolated,\n    workerFactory: globalThis.__singleRawWorkerFactory,");
main = main.replace(
  'new Worker(new URL("./processor.worker.js", import.meta.url), { type: "module" })',
  'globalThis.__singleProcessorWorkerFactory()',
);
if (main.includes("import.meta.env") || main.includes("processor.worker.js")) throw new Error("Could not patch application asset URLs");

const bootstrap = `
const __moduleUrl=(source)=>URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
const __singleInlineMode=globalThis.__singleInlineMode=location.protocol==="file:"||new URLSearchParams(location.search).has("single-inline-test");
const __inlineWorker=(source,name)=>{const host={onmessage:null,onerror:null};let stopped=false;const scope={onmessage:null,postMessage(data){if(!stopped)queueMicrotask(()=>host.onmessage?.({data}))}};try{new Function("self","postMessage",source+"\\n//# sourceURL="+name)(scope,scope.postMessage)}catch(error){queueMicrotask(()=>host.onerror?.({message:error?.message||String(error)}))}host.postMessage=(data)=>{if(stopped)return;queueMicrotask(async()=>{try{await scope.onmessage?.({data})}catch(error){host.onerror?.({message:error?.message||String(error)})}})};host.terminate=()=>{stopped=true;scope.onmessage=null};return host};
globalThis.__singleProcessorWorkerUrl=__moduleUrl(${jsString(processorWorker)});
globalThis.__singleProcessorWorkerFactory=()=>__singleInlineMode?__inlineWorker(${jsString(processorWorker)},"star-color-processor.inline.js"):new Worker(__singleProcessorWorkerUrl,{type:"module"});
const __rawWorkerUrl=__moduleUrl(${jsString(runtimeWorker)});
const __embeddedNativeAssets=${JSON.stringify(embeddedAssets)};
globalThis.__LUMA_INLINE_NATIVE_FACTORY__=__singleInlineMode?(profile)=>{let nativeSource=atob(__embeddedNativeAssets[profile].js);nativeSource=nativeSource.replaceAll("import.meta.url","globalThis.__LUMA_NATIVE_JS_URL__").replace(/export\\s+default\\s+Module\\s*;?/,"").replace(/export\\s*\\{\\s*Module\\s+as\\s+default\\s*\\}\\s*;?/,"");if(/\\bexport\\s/.test(nativeSource))throw new Error("Unsupported embedded Luma RAW module export syntax");return new Function(nativeSource+"\\nreturn Module")()}:null;
globalThis.__singleRawWorkerFactory=()=>__singleInlineMode?__inlineWorker(${jsString(runtimeWorker)},"luma-raw-runtime.inline.js"):new Worker(__rawWorkerUrl,{type:"module"});
const __rawRuntimeUrl=__moduleUrl(${jsString(distText("luma/index.js"))});
globalThis.__singleRawRuntime=await import(__rawRuntimeUrl);
${main}
`;
const licenses = [
  "@lumaforge/luma-raw-runtime LICENSE\n" + distText("luma/LICENSE"),
  distText("luma/THIRD_PARTY_NOTICES.md"),
  distText("luma/THIRD_PARTY_LICENSES/LibRaw-COPYRIGHT.txt"),
  distText("luma/THIRD_PARTY_LICENSES/LibRaw-LICENSE.CDDL.txt"),
  distText("luma/THIRD_PARTY_LICENSES/LibRaw-LICENSE.LGPL.txt"),
  distText("luma/THIRD_PARTY_LICENSES/LittleCMS-LICENSE.txt"),
].join("\n\n====\n\n");

let html = text("index.html");
html = html.replace(/\s*<link rel="stylesheet" href="\/src\/styles\.css"\s*\/?>/, `\n<style>\n${text("src/styles.css")}\n</style>`);
html = html.replace(/\s*<script type="module" src="\/src\/main\.js"><\/script>/, "");
html = html.replace("</body>", `<script type="module">\n${bootstrap.replaceAll("</script", "<\\/script")}\n</script>\n<script id="open-source-licenses" type="text/plain">${licenses.replaceAll("</script", "<\\/script")}</script>\n</body>`);
html = html.replace("<title>", '<meta name="star-color-build" content="single-file-v2.3.0" />\n    <title>');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`${output}\n${Buffer.byteLength(html)} bytes`);
