import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dest = resolve(root, "public");

mkdirSync(dest, { recursive: true });

const files = [
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.mjs"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.wasm"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.mjs"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.jsep.wasm"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.mjs"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm", "ort-wasm-simd-threaded.asyncify.wasm"],
  ["@ricky0123/vad-web/dist/vad.worklet.bundle.min.js", "vad.worklet.bundle.min.js"],
  ["@ricky0123/vad-web/dist/silero_vad_v5.onnx", "silero_vad_v5.onnx"],
  ["@ricky0123/vad-web/dist/silero_vad_legacy.onnx", "silero_vad_legacy.onnx"],
];

for (const [src, out] of files) {
  const srcPath = resolve(root, "node_modules", src);
  const destPath = resolve(dest, out);
  copyFileSync(srcPath, destPath);
  console.log(`copied ${out}`);
}
