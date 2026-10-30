# 第三方组件与模型

项目自身尚未指定许可证；以下许可仅适用于对应第三方资源。

| 组件 | 来源 | 许可 |
| --- | --- | --- |
| Transformers.js 3.8.1 | https://github.com/huggingface/transformers.js | Apache-2.0；见 licenses/Transformers.js-LICENSE |
| ONNX Runtime Web | https://github.com/microsoft/onnxruntime | MIT；见 licenses/ONNX-Runtime-LICENSE 和 ThirdPartyNotices |
| Whisper | https://github.com/openai/whisper | MIT；见 licenses/Whisper-LICENSE |
| Tiny English ONNX 权重 | https://huggingface.co/onnx-community/whisper-tiny.en | 上游 Whisper 为 MIT；转换仓库模型卡未单独声明许可，见保存的模型卡与 Whisper 许可 |

其他可选模型由用户首次使用时下载：
- https://huggingface.co/onnx-community/whisper-base.en
- https://huggingface.co/onnx-community/whisper-tiny

源码依赖的准确版本见 package-lock.json。vendor 与模型二进制不提交至 Git，完整资源见 Release 扩展包。Release 同时提供第三方许可补充包，分发扩展时请保留这些许可说明。

