# Single-file build

Run `npm run build:single`. The result is `single/star-color-local.html`.

The HTML embeds the interface, processing Worker, RAW decoding Worker, desktop
and low-memory WebAssembly runtimes, and third-party license text. Production
deployment therefore serves only this HTML file.

Keep the COOP, COEP, and CORP response headers from `nginx/default.conf` so
desktop browsers can use parallel RAW decoding. Without cross-origin isolation,
the page automatically selects the embedded low-memory single-thread decoder.
