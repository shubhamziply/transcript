import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const VENDOR_ASSETS: Record<string, { dir: string; type: string }> = {
  "/ort-wasm-simd-threaded.mjs": {
    dir: "node_modules/onnxruntime-web/dist",
    type: "text/javascript",
  },
  "/ort-wasm-simd-threaded.wasm": {
    dir: "node_modules/onnxruntime-web/dist",
    type: "application/wasm",
  },
  "/ort-wasm-simd-threaded.jsep.mjs": {
    dir: "node_modules/onnxruntime-web/dist",
    type: "text/javascript",
  },
  "/ort-wasm-simd-threaded.jsep.wasm": {
    dir: "node_modules/onnxruntime-web/dist",
    type: "application/wasm",
  },
  "/ort-wasm-simd-threaded.asyncify.mjs": {
    dir: "node_modules/onnxruntime-web/dist",
    type: "text/javascript",
  },
  "/ort-wasm-simd-threaded.asyncify.wasm": {
    dir: "node_modules/onnxruntime-web/dist",
    type: "application/wasm",
  },
  "/vad.worklet.bundle.min.js": {
    dir: "node_modules/@ricky0123/vad-web/dist",
    type: "text/javascript",
  },
  "/silero_vad_v5.onnx": {
    dir: "node_modules/@ricky0123/vad-web/dist",
    type: "application/octet-stream",
  },
  "/silero_vad_legacy.onnx": {
    dir: "node_modules/@ricky0123/vad-web/dist",
    type: "application/octet-stream",
  },
};

function serveVendorAssets(): Plugin {
  return {
    name: "serve-vendor-assets",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        const asset = VENDOR_ASSETS[url];
        if (!asset) return next();
        const filePath = path.resolve(__dirname, asset.dir, url.slice(1));
        try {
          await stat(filePath);
          res.setHeader("Content-Type", asset.type);
          res.setHeader("Cache-Control", "no-cache");
          createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    serveVendorAssets(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/onnxruntime-web/dist/*.mjs",
          dest: "",
        },
        {
          src: "node_modules/onnxruntime-web/dist/*.wasm",
          dest: "",
        },
        {
          src: "node_modules/@ricky0123/vad-web/dist/*.onnx",
          dest: "",
        },
        {
          src: "node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js",
          dest: "",
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
