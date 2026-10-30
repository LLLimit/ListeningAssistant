$ErrorActionPreference = "Stop"
$extension = Join-Path $PSScriptRoot "extension"
$model = Join-Path $extension "models\onnx-community\whisper-tiny.en"
$vendor = Join-Path $extension "vendor"
if (!(Test-Path (Join-Path $model "config.json"))) { throw "缺少内置 Tiny English 模型。先运行 npm run prepare-model" }
if (!(Test-Path (Join-Path $vendor "transformers.js"))) { throw "缺少 vendor/transformers.js。先运行 npm run build" }
if (!(Test-Path (Join-Path $vendor "ort\ort-wasm-simd-threaded.jsep.mjs"))) { throw "缺少 ONNX Runtime WASM 文件。先运行 npm run build" }
$out = Join-Path $PSScriptRoot "ListeningAssistant-3.1.0-EdgeChrome.zip"
if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $extension "*") -DestinationPath $out -CompressionLevel Optimal
Write-Host "发行包已生成：$out"
