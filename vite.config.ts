import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Maps public asset paths to their correct MIME types.
// Served via raw middleware so Vite never transforms them as modules.
const WASM_ASSETS: Record<string, string> = {
  "/ort-wasm-simd-threaded.mjs":          "application/javascript",
  "/ort-wasm-simd-threaded.wasm":         "application/wasm",
  "/ort-wasm-simd-threaded.jsep.mjs":     "application/javascript",
  "/ort-wasm-simd-threaded.jsep.wasm":    "application/wasm",
  "/ort-wasm-simd-threaded.asyncify.mjs": "application/javascript",
  "/ort-wasm-simd-threaded.asyncify.wasm":"application/wasm",
  "/vad.worklet.bundle.min.js":           "application/javascript",
  "/silero_vad_v5.onnx":                  "application/octet-stream",
  "/silero_vad_legacy.onnx":              "application/octet-stream",
};

function serveWasmAssets(): Plugin {
  return {
    name: "serve-wasm-assets",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Strip Vite's ?import (and any other query) before matching
        const url = req.url?.split("?")[0] ?? "";
        const contentType = WASM_ASSETS[url];
        if (!contentType) return next();
        const filePath = path.resolve(__dirname, "public", url.slice(1));
        try {
          await stat(filePath);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
          createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveWasmAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
