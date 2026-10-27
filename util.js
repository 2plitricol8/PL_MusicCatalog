// Funzioni di supporto condivise.
export const CATS = [
  { id: 'classica', name: 'Classica' },
  { id: 'lirica', name: 'Lirica' },
  { id: 'poprock', name: 'Pop/Rock' },
  { id: 'altro', name: 'Altro' },
];
export const APP_NAME = 'LibreriaMusicalePL';
export const APP_CREDIT = 'LibreriaMusicalePL by PL & IA';
export const appVersion = () => globalThis.APP_VERSION || '?';

// Formato fisico: lo decide il prefisso dell'indice (LPxxxx = vinile, CDxxxx = CD).
export const FORMATS = ['LP', 'CD'];
export const fmtOf = (id) => (/^cd/i.test(String(id ?? '')) ? 'CD' : 'LP');

export const catName = (id) => CATS.find((c) => c.id === id)?.name ?? id;
export const isClassic = (cat) => cat === 'classica' || cat === 'lirica';

export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// "Holst,Gustav" -> "Holst, Gustav"
export const tidyComposer = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').replace(/,(?=\S)/g, ', ');

export const worksOf = (r) => (r.works || []).filter((w) => w.title || w.composer);

export function composersOf(r) {
  const out = [];
  for (const w of r.works || []) if (w.composer && !out.includes(w.composer)) out.push(w.composer);
  return out;
}

const pad4 = (n) => String(parseInt(n, 10)).padStart(4, '0');

// "12" -> LP0012 (o CD0012 se il formato predefinito è CD); "cd 5" -> CD0005
export function formatId(raw, fmt = 'LP') {
  const s = String(raw ?? '').trim();
  let m = /^(\d+)$/.exec(s);
  if (m) return fmt + pad4(m[1]);
  m = /^(lp|cd)\s*0*(\d+)$/i.exec(s);
  if (m) return m[1].toUpperCase() + pad4(m[2]);
  return s;
}

export function nextId(records, fmt = 'LP') {
  let max = 0;
  for (const r of records) {
    if (fmtOf(r.id) !== fmt) continue;
    const n = parseInt(String(r.id).replace(/\D/g, ''), 10);
    if (n > max) max = n;
  }
  return fmt + String(max + 1).padStart(4, '0');
}

// Chiave di ordinamento: compositore (classica/lirica) o artista (pop/rock/altro).
const EMPTY = '￿';
export function sortKeyFor(r, composer) {
  if (isClassic(r.cat)) {
    const c = composer ?? composersOf(r)[0] ?? '';
    return norm(c) || EMPTY + norm(worksOf(r)[0]?.title || '');
  }
  const a = norm(r.artist).replace(/^(the|il|lo|la|i|gli|le|l')\s*/, '');
  return a || EMPTY + norm(r.title);
}

export function letterOf(key) {
  if (!key || key[0] === EMPTY) return '#';
  const c = key[0].toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });
export function compareEntries(a, b) {
  const ea = a.key[0] === EMPTY, eb = b.key[0] === EMPTY;
  if (ea !== eb) return ea ? 1 : -1;
  const k = collator.compare(a.key, b.key);
  if (k) return k;
  if (!isClassic(a.rec.cat) && a.rec.year !== b.rec.year) return collator.compare(a.rec.year || '9999', b.rec.year || '9999');
  if (!isClassic(a.rec.cat)) {
    const t = collator.compare(a.rec.title || '', b.rec.title || '');
    if (t) return t;
  }
  return collator.compare(a.rec.id, b.rec.id);
}

export function searchText(r) {
  if (r._st) return r._st;
  const parts = [r.id, r.artist, r.title, r.year, r.genre, r.label, r.catno, r.barcode, r.notes];
  for (const w of r.works || []) parts.push(w.composer, w.title);
  Object.defineProperty(r, '_st', { value: norm(parts.join(' ')), enumerable: false, configurable: true, writable: true });
  return r._st;
}
export function matches(r, q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const hay = searchText(r);
  return terms.every((t) => hay.includes(t));
}

const loaded = new Map();
// Carica uno script provando in ordine più indirizzi (copia locale, poi CDN).
export function loadScript(srcs) {
  const list = [].concat(srcs);
  const key = list[0];
  if (!loaded.has(key)) {
    const p = (async () => {
      for (const src of list) {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => { s.remove(); reject(new Error(src)); };
            document.head.append(s);
          });
          return;
        } catch { /* prossimo indirizzo */ }
      }
      throw new Error('Libreria non trovata. Controlla che la cartella "vendor" sia stata caricata sul server insieme agli altri file.');
    })();
    p.catch(() => loaded.delete(key));
    loaded.set(key, p);
  }
  return loaded.get(key);
}

// Riduce una foto/blob a una miniatura JPEG (data URL) per tenere leggero l'archivio.
export async function resizeImage(blob, max = 360, quality = 0.78) {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/jpeg', quality);
}
