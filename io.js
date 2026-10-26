// Import/export: Excel (stesso formato del catalogo esistente) e backup JSON.
import { CATS, isClassic, norm, tidyComposer, formatId, worksOf, sortKeyFor, compareEntries, loadScript } from './util.js';

const OPERA_RE = /\b(opera|highlights?|selezione|arie|aria|atti|atto)\b/i;

async function xlsxLib() {
  if (!globalThis.XLSX) await loadScript(['vendor/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js']);
  return globalThis.XLSX;
}
export const preloadXlsx = () => xlsxLib().catch(() => {});

function fieldOf(header) {
  const n = norm(header);
  if (['index', 'indice', 'id'].includes(n)) return 'id';
  if (n.startsWith('compositor')) return 'composer';
  if (['composizione', 'composizioni'].includes(n)) return 'composition';
  if (n === 'artista') return 'artist';
  if (n === 'titolo') return 'title';
  if (n.startsWith('etichetta')) return 'label';
  if (['numero di catalogo', 'n. catalogo', 'n catalogo', 'catalogo', 'catno'].includes(n)) return 'catno';
  if (n === 'note') return 'notes';
  if (n === 'anno') return 'year';
  if (n === 'genere') return 'genre';
  if (['barcode', 'codice a barre', 'ean'].includes(n)) return 'barcode';
  if (n === 'categoria') return 'cat';
  return null;
}

function catFromSheetName(name) {
  const n = norm(name);
  if (/class/.test(n)) return 'classica';
  if (/liric|opera/.test(n)) return 'lirica';
  if (/pop|rock/.test(n)) return 'poprock';
  if (/altro/.test(n)) return 'altro';
  return null;
}

const blankRec = (id, cat) => ({
  id, cat, works: [], artist: '', title: '', year: '', genre: '', label: '', catno: '', barcode: '', notes: '', cover: '', coverUrl: '', mbid: '',
});

const str = (v) => String(v ?? '').trim();

function parseSheet(rows, sheetName) {
  const hi = rows.findIndex((r) => r.some((c) => ['index', 'indice'].includes(norm(c))));
  if (hi < 0) return [];
  const cols = rows[hi].map(fieldOf);
  const hasArtist = cols.includes('artist');
  let sheetCat = catFromSheetName(sheetName) || (hasArtist ? 'poprock' : 'auto');
  const out = [];
  let cur = null;
  let lastComposer = '';

  for (const row of rows.slice(hi + 1)) {
    const f = {};
    cols.forEach((k, i) => {
      if (k && row[i] !== undefined && str(row[i]) !== '') f[k] = str(row[i]);
    });
    if (!Object.keys(f).length) continue;

    if (f.id) {
      cur = blankRec(formatId(f.id), f.cat && CATS.some((c) => c.id === f.cat) ? f.cat : sheetCat);
      lastComposer = '';
      out.push(cur);
      for (const k of ['artist', 'title', 'year', 'genre', 'label', 'catno', 'barcode', 'notes']) if (f[k]) cur[k] = f[k];
    } else if (!cur) {
      continue;
    } else {
      for (const k of ['label', 'catno', 'barcode', 'year']) if (f[k] && !cur[k]) cur[k] = f[k];
      if (f.notes) cur.notes = cur.notes ? cur.notes + '; ' + f.notes : f.notes;
    }

    if (f.composer) lastComposer = tidyComposer(f.composer);
    if (f.composition || f.composer) cur.works.push({ composer: lastComposer, title: f.composition || '' });
  }

  for (const r of out) {
    if (r.cat === 'auto') {
      const text = r.works.map((w) => w.title).join(' ') + ' ' + r.notes;
      r.cat = OPERA_RE.test(text) ? 'lirica' : 'classica';
    }
  }
  return out;
}

export async function readFile(file) {
  const name = file.name.toLowerCase();
  let recs;
  if (name.endsWith('.json')) {
    const j = JSON.parse(await file.text());
    const list = Array.isArray(j) ? j : j.records;
    if (!Array.isArray(list)) throw new Error('Il file JSON non contiene un elenco di dischi.');
    recs = list.map((r) => ({ ...blankRec(formatId(r.id), CATS.some((c) => c.id === r.cat) ? r.cat : 'classica'), ...r, id: formatId(r.id) }));
  } else {
    const X = await xlsxLib();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    recs = [];
    for (const name of wb.SheetNames) {
      const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false });
      recs.push(...parseSheet(rows, name));
    }
  }
  const seen = new Set();
  const unique = recs.filter((r) => r.id && !seen.has(r.id) && seen.add(r.id));
  if (!unique.length) throw new Error('Non ho trovato dischi in questo file. Serve una colonna "Index".');
  return unique;
}

export function backupJson(records) {
  const data = { app: 'vinili', version: 1, exported: new Date().toISOString(), records };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

function sorted(records, cat) {
  return records
    .filter((r) => r.cat === cat)
    .map((rec) => ({ rec, key: sortKeyFor(rec) }))
    .sort(compareEntries)
    .map((e) => e.rec);
}

export async function buildWorkbook(records) {
  const X = await xlsxLib();
  const wb = X.utils.book_new();
  for (const cat of CATS) {
    const list = sorted(records, cat.id);
    let aoa, widths;
    if (isClassic(cat.id)) {
      aoa = [['Index', 'Compositore/i', 'Composizione', 'Etichetta discografica', 'Numero di catalogo', 'Note', 'Anno', 'Barcode']];
      for (const r of list) {
        const w = worksOf(r);
        if (!w.length) aoa.push([r.id, '', '', r.label, r.catno, r.notes, r.year, r.barcode]);
        let prev = '';
        w.forEach((x, i) => {
          const showC = x.composer && x.composer !== prev;
          if (x.composer) prev = x.composer;
          aoa.push([i ? '' : r.id, showC ? x.composer : '', x.title, i ? '' : r.label, i ? '' : r.catno, i ? '' : r.notes, i ? '' : r.year, i ? '' : r.barcode]);
        });
      }
      widths = [9, 28, 56, 24, 22, 32, 7, 15];
    } else {
      aoa = [['Index', 'Artista', 'Titolo', 'Anno', 'Genere', 'Etichetta discografica', 'Numero di catalogo', 'Barcode', 'Note']];
      for (const r of list) aoa.push([r.id, r.artist, r.title, r.year, r.genre, r.label, r.catno, r.barcode, r.notes]);
      widths = [9, 28, 40, 7, 16, 24, 22, 15, 32];
    }
    const ws = X.utils.aoa_to_sheet(aoa);
    ws['!cols'] = widths.map((wch) => ({ wch }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    X.utils.book_append_sheet(wb, ws, cat.name.replace('/', '-'));
  }
  return wb;
}

export async function xlsxBlob(records) {
  const X = await xlsxLib();
  const wb = await buildWorkbook(records);
  const buf = X.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Condivide il file (menu di sistema su telefono) oppure lo scarica.
export async function saveBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
  return 'downloaded';
}
