# Local Color Star Extractor

A privacy-first, browser-only tool for extracting and enhancing colored stars. RAW decoding, star detection, light-pollution separation, background reconstruction, and PNG generation all run on the visitor's device. The server only delivers static files.

The interface defaults to English and can be switched to Chinese at any time.

## Features

- Supports DNG, NEF, NRW, CR2, CR3, ARW, RAF, RW2, ORF, PEF, common RAW files, JPG, PNG, and WebP.
- Decodes supported RAW files at full resolution with 16-bit linear data and camera white balance. It does not use embedded previews or silently downsample images.
- Preserves each star's original color and relative brightness instead of normalizing faint and bright stars to the same level.
- Provides adjustable detection strictness, star expansion, background-repair expansion, brightness gain, background mode, Gaussian scales, area and size limits, chroma filtering, halo retention, and landscape filtering. Every control shows its valid range or available choices and its default value.
- Keeps the common brightness-gain slider at 0×–10× while allowing precise manual values from 0× to 1000×; the default remains 5×.
- Adds an independent HDR star-output switch. When enabled, the browser exports a 16-bit Rec.2100 PQ PNG and applies a separate 1×–1000× HDR gain only to detected starlight; the reconstructed or selected background remains at its normal SDR-relative brightness. HDR output is off by default and HDR gain defaults to 1×.
- Offers black, transparent, and preserved-background output. Preserve-background mode removes detected stars, reconstructs a starless background from nearby non-star pixels, and adds the uniformly enhanced linear starlight back. Its independent repair expansion defaults to 3 px beyond the detected star footprint, without changing star detection or extracted-star brightness.
- Tries WebGPU after a correctness self-test and automatically falls back to a CPU Worker if WebGPU is unavailable or fails.
- Shows staged progress, a preview, and a downloadable PNG.
- Imports many files at once and processes up to four jobs concurrently. The default is two, with memory-aware scheduling that reduces active jobs when large RAW files would exceed a conservative client-side memory budget.
- Shows an aggregate batch percentage plus independent stage, progress, success, and failure states for every file. Completed outputs can be previewed and downloaded individually or together.
- Packages all completed batch outputs into one ZIP download with live packaging progress, avoiding browser multi-download limits. PNG files are stored without recompression and are read sequentially so ZIP creation does not duplicate every result in memory at once.

## Single-file build

Run:

```bash
npm run build:single
```

The output is `single/star-color-local.html`. It embeds the interface, processing Worker, RAW runtime Worker, native WebAssembly assets, and required third-party license text. The generated `single/` directory is intentionally excluded from Git.

The single HTML can be opened directly with `file://`. In that mode it uses a main-thread compatibility wrapper because browsers do not allow module Workers to load from local files. RAW decoding and image processing remain fully local.

The same generated file is written to `docs/index.html` and committed for GitHub Pages. It contains the complete app, Workers, RAW runtime, WebAssembly, and required license text without external runtime dependencies.

GitHub Pages: https://zephyrfbd.github.io/star-color-local-web/

## Linux deployment

The server only needs Docker and a host Nginx reverse proxy. A 2-core, 2 GB server is sufficient because user images are never uploaded; the provided container is limited to 96 MB RAM and 0.25 CPU.

The hosted container serves the Vite multi-file build from `dist/`. Its small HTML, CSS, and JavaScript files load independently and can be cached; the RAW decoder and WebAssembly are requested only when RAW processing needs them. The single-file build is intended for offline distribution, not as the hosted homepage.

```bash
unzip star-color-browser-web.zip
cd star-color-web
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

Add the two `location` blocks from `deploy/domain-nginx.conf` to the existing HTTPS `server {}` block, then validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The default subpath is `https://your-domain.example/star-color/`. A public deployment requires HTTPS for WebGPU. If needed, configure a certificate with Certbot:

```bash
sudo certbot --nginx -d your-domain.example
```

Keep the COOP, COEP, and CORP response headers in the Nginx configuration. Parallel browser-side RAW decoding requires cross-origin isolation. Verify the deployment with:

```bash
curl -I https://your-domain.example/star-color/
```

The response should include:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

## Local development

Node.js 22 is recommended:

```bash
npm ci
npm run dev
```

Create a production build with:

```bash
npm run build
```

Static files are written to `dist/`. The build copies the RAW WebAssembly runtime and its licenses into the output, so production does not depend on a CDN.

## Performance and memory

- WebGPU Gaussian processing uses overlapping tiles to preserve full resolution while controlling individual buffer sizes.
- CPU fallback runs in a dedicated Worker for hosted builds.
- A 4000×2250 16-bit RAW file can require several hundred megabytes of temporary client-side memory. This is unrelated to server memory.
- The page estimates peak memory and stops before the browser safety limit. It never silently lowers the resolution.
- Browser pixel buffers cannot spill into server storage because images never leave the device. If client memory is insufficient, the page reports an error instead of affecting the server.

Current desktop Chrome and Edge provide the best compatibility. Processing still works without WebGPU, but CPU mode is slower.

## Privacy

The application has no upload endpoint, and the processing path does not send image data over the network. Server access logs can contain requests for the HTML, JavaScript, and WASM assets, but not the photos selected by users.

## Open-source components

RAW decoding uses `@lumaforge/luma-raw-runtime` with LibRaw 0.22.1. Production builds must include `dist/luma/LICENSE`, `dist/luma/THIRD_PARTY_NOTICES.md`, and `dist/luma/THIRD_PARTY_LICENSES/`.

## Author

ZephyrFBD
