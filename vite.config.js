import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function stageRawRuntime() {
  const target = resolve("public/luma");
  mkdirSync(target, { recursive: true });
  cpSync(resolve("node_modules/@lumaforge/luma-raw-runtime/dist"), target, { recursive: true });
  cpSync(resolve("node_modules/@lumaforge/luma-raw-runtime/LICENSE"), resolve(target, "LICENSE"));
  cpSync(resolve("node_modules/@lumaforge/luma-raw-runtime/THIRD_PARTY_NOTICES.md"), resolve(target, "THIRD_PARTY_NOTICES.md"));
  cpSync(resolve("node_modules/@lumaforge/luma-raw-runtime/THIRD_PARTY_LICENSES"), resolve(target, "THIRD_PARTY_LICENSES"), { recursive: true });
}

export default defineConfig({
  base: "/star-color/",
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
  plugins: [{
    name: "stage-browser-raw-runtime",
    buildStart: stageRawRuntime,
    configureServer: stageRawRuntime,
  }],
  publicDir: "public",
  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  worker: {
    format: "es",
  },
});
