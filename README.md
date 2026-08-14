# 浏览器本地彩色星点提取器

照片不会上传。RAW 解码、星点检测、背景光污染分离和 PNG 生成全部在访问者自己的浏览器内完成；Linux 服务器只发送静态网页文件。默认部署地址为 `https://你的域名/star-color/`。

## 功能

- 支持 DNG、NEF、CR2、CR3、ARW、RAF、RW2、ORF、PEF，以及 JPG、PNG、WebP。
- RAW 使用相机白平衡、16 位线性、全分辨率解码，不使用嵌入式预览，也不自动降采样。
- 保留星星原本的颜色与相对明暗，不把暗星和亮星归一化成同样亮度。
- 可调整检测严格度、外扩圈数、亮度倍率、背景、星核/周边/背景尺度、面积、边长、色度和地景过滤参数；所有参数都有默认值。
- 背景支持黑色、透明和“保留背景”。保留背景模式先移除检测到的星点，以多个方向的非星边界像素做局部插值，再把按统一倍率增强的线性星光叠回去。
- 优先尝试 WebGPU，并先做正确性自检；不可用、自检失败、显存不足或执行失败时自动切到 CPU Worker。
- 有分阶段进度、预览和 PNG 下载。

## 单 HTML 版本

运行 `npm run build:single`，输出文件为 `single/star-color-local.html`。该文件会内嵌界面、处理 Worker、RAW 解码 Worker、WebAssembly 运行时和第三方许可证文本；`single/` 属于构建产物，不提交到 GitHub。

## Linux 服务器部署

服务器只需 Docker 和宿主机 Nginx。2 核 2 GB 足够，因为图片不进入服务器，容器限制为 96 MB 内存和 0.25 CPU。

```bash
unzip star-color-browser-web.zip
cd star-color-web
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

把 `deploy/domain-nginx.conf` 中的两个 `location` 块加入现有域名的 HTTPS `server {}` 中，然后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

访问地址为 `https://你的域名/star-color/`。公网域名必须使用 HTTPS 才能启用 WebGPU。若该域名尚未配置 HTTPS，可使用 Certbot：

```bash
sudo certbot --nginx -d 你的域名
```

不要删除 Nginx 配置里的 COOP、COEP 和 CORP 响应头；浏览器 RAW 并行解码需要这些头。检查：

```bash
curl -I https://你的域名/star-color/
```

响应中应包含：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

## 本地开发

需要 Node.js 22：

```bash
npm ci
npm run dev
```

生产构建：

```bash
npm run build
```

静态文件会输出到 `dist/`。`npm run build` 会把 RAW WebAssembly 运行时及其许可证自动复制进去，因此生产环境不依赖 CDN。

## 性能和内存

- WebGPU 高斯计算按带重叠光晕的分块执行，保持全分辨率，同时控制单次显存占用。
- CPU 回退运行在独立 Worker，不会锁死网页界面。
- 一张 4000×2250 的 16 位 RAW，在客户端浏览器中通常需要数百 MB 临时内存；这与服务器的 2 GB 内存无关。
- 页面会显示估算内存，并在预计超过浏览器安全上限时停止，不会偷偷降低分辨率。
- 浏览器不能把临时像素数组映射到服务器硬盘，因为文件从未上传；内存不足时会明确报错，而不是让服务器崩溃。

桌面版最新版 Chrome 或 Edge 的兼容性最好。WebGPU 不可用时仍能处理，只是 CPU 模式会更慢。

## 隐私说明

网页没有上传接口，处理流程也不发送图片请求。服务端访问日志只能看到网页、脚本和 WASM 静态资源请求，看不到用户选择的照片内容。

## 开源组件

RAW 解码使用 `@lumaforge/luma-raw-runtime`（LibRaw 0.22.1）。构建产物中的 `dist/luma/LICENSE`、`THIRD_PARTY_NOTICES.md` 和 `THIRD_PARTY_LICENSES/` 必须随站点一起发布。

## 作者

ZephyrFBD
