importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
const say = text => postMessage({type: 'status', text});

// magika 依賴 onnxruntime（Pyodide 不支援），以 stub 取代；格式改由副檔名判斷。
const STUB = `
import sys, types
m = types.ModuleType("magika")
class Magika:
    def identify_stream(self, s):
        return types.SimpleNamespace(status="error")
m.Magika = Magika
sys.modules["magika"] = m
`;

const INSTALL = `
import micropip
await micropip.install(["markdownify", "defusedxml", "mammoth", "olefile", "pdfminer.six", "python-pptx", "XlsxWriter", "openpyxl", "xlrd"])
await micropip.install("pdfplumber", deps=False)
await micropip.install("markitdown", deps=False)
from markitdown import MarkItDown
md = MarkItDown(enable_plugins=False)
`;

const CONVERT = `
import io, os
from markitdown import StreamInfo
data = bytes(fbytes.to_py())
r = md.convert_stream(io.BytesIO(data), stream_info=StreamInfo(extension=os.path.splitext(fname)[1].lower(), filename=fname))
r.markdown
`;

async function init() {
  say('載入 Pyodide…');
  const py = await loadPyodide();
  say('安裝相依套件…');
  await py.loadPackage(['micropip', 'beautifulsoup4', 'lxml', 'pandas', 'pillow',
    'cryptography', 'charset-normalizer', 'requests', 'certifi']);
  await py.runPythonAsync(STUB);
  say('安裝 MarkItDown…');
  await py.runPythonAsync(INSTALL);
  return py;
}

const pyP = init()
  .then(p => { postMessage({type: 'ready'}); return p; })
  .catch(e => { postMessage({type: 'error', text: '初始化失敗：' + e}); });

onmessage = async e => {
  if (e.data.type !== 'convert') return;
  const py = await pyP;
  if (!py) return;
  try {
    py.globals.set('fname', e.data.name);
    py.globals.set('fbytes', new Uint8Array(e.data.buf));
    const out = await py.runPythonAsync(CONVERT);
    postMessage({type: 'result', text: out});
  } catch (err) {
    postMessage({type: 'error', text: String(err)});
  }
};
