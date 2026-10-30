import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline as streamPipeline } from 'node:stream/promises';

const repo = 'onnx-community/whisper-tiny.en';
const root = path.resolve('extension/models', repo);
await mkdir(root, { recursive: true });

console.log(`读取 Hugging Face 模型文件清单：${repo}`);
const metaResponse = await fetch(`https://huggingface.co/api/models/${repo}?blobs=true`);
if (!metaResponse.ok) throw new Error(`读取模型清单失败：HTTP ${metaResponse.status}`);
const meta = await metaResponse.json();
const siblings = (meta.siblings || []).map(x => x.rfilename).filter(Boolean);

// Keep tokenizer/config assets, but only the quantized encoder + merged decoder.
// This keeps the built-in model compact and avoids shipping unused ONNX variants.
const requiredOnnx = [
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];
const files = siblings.filter(name =>
  !name.startsWith('.') &&
  !/^README(?:\.|$)/i.test(name) &&
  (!name.startsWith('onnx/') || requiredOnnx.includes(name))
);
for (const required of requiredOnnx) {
  if (!files.includes(required)) {
    throw new Error(`模型仓库缺少必需量化文件 ${required}。请检查仓库版本/模型文件布局，不要改用未量化大模型自动替代。`);
  }
}
if (!files.some(x => x === 'config.json') || !files.some(x => x === 'tokenizer.json')) {
  throw new Error('模型仓库缺少 config.json 或 tokenizer.json。');
}

for (const [i, name] of files.entries()) {
  const dest = path.join(root, name);
  await mkdir(path.dirname(dest), { recursive: true });
  const url = `https://huggingface.co/${repo}/resolve/main/${name}`;
  console.log(`[${i + 1}/${files.length}] 下载 ${name}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`下载失败 ${name}: HTTP ${response.status}`);
  await streamPipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}
await writeFile(path.join(root, 'MODEL_SOURCE.txt'),
  `Model: ${repo}\nSource: https://huggingface.co/${repo}\nDownloaded at: ${new Date().toISOString()}\nOnly quantized ONNX encoder/merged decoder and required config/tokenizer assets are included.\n`);
console.log(`完成。Tiny English 模型已放入 ${root}`);
console.log('请确认该目录随最终 extension 文件夹一起打包分发。');
