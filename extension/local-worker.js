import { env, pipeline } from './vendor/transformers.js';

// ONNX Runtime assets must remain bundled in the extension.
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/ort/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;

// Tiny English is bundled under extension/models by download-default-model.mjs.
// The two optional models are downloaded on demand and cached by Transformers.js.
env.localModelPath = new URL('./models/', import.meta.url).href;
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.useFS = false;

const MODELS = {
  tiny_en: { id: 'onnx-community/whisper-tiny.en', local: true, label: 'Whisper Tiny English' },
  base_en: { id: 'onnx-community/whisper-base.en', local: false, label: 'Whisper Base English' },
  tiny_multi: { id: 'onnx-community/whisper-tiny', local: false, label: 'Whisper Tiny Multilingual' },
};
let activePipeline = null;
let activeModelKey = null;

self.onmessage = async ({ data }) => {
  try {
    const key = MODELS[data?.modelKey] ? data.modelKey : 'tiny_en';
    const model = MODELS[key];
    if (!activePipeline || activeModelKey !== key) {
      activePipeline = null;
      activeModelKey = null;
      self.postMessage({ progress: `正在准备${model.label}…` });
      const options = {
        device: 'webgpu',
        progress_callback: (p) => {
          if (p.status === 'progress') {
            const pct = Number.isFinite(p.progress) ? ` ${Math.round(p.progress)}%` : '';
            self.postMessage({ progress: `下载/加载模型文件：${p.file || p.name || ''}${pct}` });
          } else if (p.status) {
            self.postMessage({ progress: `模型状态：${p.status}` });
          }
        },
      };
      // Bundled Tiny English is loaded only from extension package.
      if (model.local) {
        options.local_files_only = true;
      }
      activePipeline = await pipeline('automatic-speech-recognition', model.id, options);
      activeModelKey = key;
    }
    self.postMessage({ progress: '模型就绪，正在识别音频…' });
    const audio = data.audio instanceof Float32Array ? data.audio : new Float32Array(data.audio);
    const result = await activePipeline(audio, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const segments = (result.chunks || []).map(s => ({
      start: s.timestamp?.[0] || 0,
      end: s.timestamp?.[1] || 0,
      text: s.text || '',
      translation: '',
    }));
    self.postMessage({
      segments: segments.length ? segments : [{ start: 0, end: 0, text: result.text || '', translation: '' }],
      modelKey: key,
    });
  } catch (error) {
    activePipeline = null;
    activeModelKey = null;
    self.postMessage({ error: String(error?.stack || error?.message || error) });
  }
};
