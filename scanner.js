// Lettura del codice a barre: BarcodeDetector nativo se c'è, altrimenti ZXing.
import { loadScript } from './util.js';

const FORMATS = ['ean_13', 'upc_a', 'ean_8'];

export function validEAN(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;
  const d = code.split('').map(Number);
  const check = d.pop();
  let sum = 0;
  d.reverse().forEach((n, i) => (sum += n * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}

let decoder;
async function getDecoder() {
  if (decoder) return decoder;
  if ('BarcodeDetector' in window) {
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) {
        const det = new BarcodeDetector({ formats });
        decoder = async (src) => {
          const hits = await det.detect(src);
          return hits.map((h) => h.rawValue).find(validEAN) ?? null;
        };
        return decoder;
      }
    } catch {
      /* si passa a ZXing */
    }
  }
  await loadScript(['vendor/zxing.min.js', 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js']);
  const Z = globalThis.ZXing;
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.EAN_8]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  decoder = async (src) => {
    const w = src.videoWidth || src.width;
    const h = src.videoHeight || src.height;
    if (!w || !h) return null;
    const scale = Math.min(1, 1280 / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    try {
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
      const text = reader.decode(bitmap).getText();
      return validEAN(text) ? text : null;
    } catch {
      return null;
    }
  };
  return decoder;
}

let stream = null;
let timer = null;
let running = false;

export async function start(video, onCode) {
  stop();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('La fotocamera richiede una connessione sicura (HTTPS). Usa "Foto del codice" oppure digita il codice.');
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new Error('Accesso alla fotocamera negato. Consentilo dalle impostazioni del browser, oppure usa "Foto del codice".');
    if (e.name === 'NotFoundError') throw new Error('Nessuna fotocamera trovata. Usa "Foto del codice" oppure digita il codice.');
    throw new Error('Non riesco ad avviare la fotocamera.');
  }
  const track = stream.getVideoTracks()[0];
  try {
    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
  } catch {
    /* non supportato: pazienza */
  }
  video.srcObject = stream;
  await video.play();
  const decode = await getDecoder();
  running = true;
  const tick = async () => {
    if (!running) return;
    if (video.readyState >= 2) {
      try {
        const code = await decode(video);
        if (code && running) {
          running = false;
          onCode(code);
          return;
        }
      } catch {
        /* frame non leggibile */
      }
    }
    timer = setTimeout(tick, 140);
  };
  tick();
}

export function stop() {
  running = false;
  clearTimeout(timer);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

export function torchSupported() {
  const caps = stream?.getVideoTracks()[0]?.getCapabilities?.();
  return !!caps?.torch;
}

export async function setTorch(on) {
  await stream?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: on }] });
}

export async function decodeFile(file) {
  const decode = await getDecoder();
  const bmp = await createImageBitmap(file);
  try {
    return await decode(bmp);
  } finally {
    bmp.close?.();
  }
}
