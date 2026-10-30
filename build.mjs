import { build } from 'esbuild';
import { mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const vendor = path.join(root, 'extension', 'vendor');
const ortDest = path.join(vendor, 'ort');
await mkdir(ortDest, { recursive: true });

const sources = [
  'node_modules/onnxruntime-web/dist',
  'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist',
];
let source;
for (const candidate of sources) {
  try { if ((await stat(candidate)).isDirectory()) { source = candidate; break; } } catch {}
}
if (!source) throw new Error('找不到 onnxruntime-web/dist。请检查依赖是否安装完整。');

const files = (await readdir(source)).filter(name => /^ort-wasm.*\.(?:wasm|mjs)$/.test(name));
if (!files.some(x => x.endsWith('.wasm')) || !files.some(x => x.endsWith('.mjs'))) {
  throw new Error(`ONNX Runtime 文件不完整：${files.join(', ')}`);
}
for (const name of files) await copyFile(path.join(source, name), path.join(ortDest, name));
console.log(`已复制 ${files.length} 个 ONNX Runtime WASM/JSEP 文件`);

await build({
  entryPoints: ['node_modules/@huggingface/transformers/dist/transformers.web.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  conditions: ['browser', 'import', 'default'],
  outfile: 'extension/vendor/transformers.js',
  logLevel: 'info',
});
console.log('构建完成：请在 edge://extensions 重新加载扩展');
