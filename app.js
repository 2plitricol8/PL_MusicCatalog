import * as DB from './db.js';
import {
  CATS, catName, isClassic, esc, tidyComposer, formatId, worksOf, composersOf, sortKeyFor, compareEntries,
  letterOf, nextId, matches, resizeImage, norm,
} from './util.js';
import * as IO from './io.js';
import * as Scan from './scanner.js';
import * as MB from './mb.js';

const $ = (s, r = document) => r.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('vinili.' + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('vinili.' + k, JSON.stringify(v)); } catch { /* spazio finito */ } },
};

const state = {
  records: [],
  cat: store.get('cat', 'classica'),
  q: '',
  perComposer: store.get('perComposer', false),
  addCat: store.get('addCat', 'classica'),
};

/* ---------- utilità interfaccia ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function updateStick() {
  document.documentElement.style.setProperty('--stick', $('#chrome').offsetHeight + 'px');
}
new ResizeObserver(updateStick).observe($('#chrome'));

for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
  });
}

/* ---------- schede e ricerca ---------- */
function buildTabs() {
  $('#tabs').innerHTML = CATS.map(
    (c) => `<button class="tab" role="tab" data-cat="${c.id}" aria-selected="false">${c.name}<small>0</small></button>`,
  ).join('');
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  state.cat = b.dataset.cat;
  store.set('cat', state.cat);
  window.scrollTo(0, 0);
  render();
});
let searchTimer;
$('#q').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = e.target.value;
    render();
  }, 120);
});

/* ---------- elenco ---------- */
function coverOf(r) {
  return r.cover || '';
}

function classicRow(r, under) {
  const w = worksOf(r);
  let prev = '';
  const rows = w.length
    ? w.map((x) => {
        const show = x.composer && x.composer !== prev;
        if (x.composer) prev = x.composer;
        return `<div class="wc${show ? '' : ' blank'}">${show ? esc(x.composer) : ''}</div><div class="wt">${esc(x.title)}</div>`;
      }).join('')
    : '<div class="wc blank"></div><div class="wt empty">Da completare</div>';
  const cover = coverOf(r) ? `<img class="thumb" src="${esc(coverOf(r))}" alt="" loading="lazy">` : '';
  const extra = r.year ? `<span>${esc(r.year)}</span>` : '';
  return `<article class="rec" tabindex="0" role="button" data-id="${esc(r.id)}" aria-label="${esc(r.id)}, modifica">
    <div class="idcol"><span class="sticker">${esc(r.id)}</span>${cover}</div>
    <div class="works">${rows}${under ? `<div class="also" style="grid-column:1/-1">Compare anche sotto altri compositori</div>` : ''}</div>
    <div class="lbl"><span>${esc(r.label)}</span><span class="catno">${esc(r.catno)}</span>${extra}</div>
    <div class="note">${esc(r.notes)}</div>
  </article>`;
}

function popRow(r) {
  const cover = coverOf(r) ? `<img class="thumb" src="${esc(coverOf(r))}" alt="" loading="lazy">` : '';
  const sub = [r.year, r.genre].filter(Boolean).map(esc).join(' · ');
  return `<article class="rec" tabindex="0" role="button" data-id="${esc(r.id)}" aria-label="${esc(r.id)}, modifica">
    <div class="idcol"><span class="sticker">${esc(r.id)}</span>${cover}</div>
    <div class="main"><div class="artist">${esc(r.artist) || '<span class="empty">Artista da completare</span>'}</div><div class="title">${esc(r.title)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <div class="lbl"><span>${esc(r.label)}</span><span class="catno">${esc(r.catno)}</span></div>
    <div class="note">${esc(r.notes)}</div>
  </article>`;
}

function backupNudge() {
  const changes = store.get('changes', 0);
  if (changes < 8) return '';
  return `<div class="nudge"><p>${changes} modifiche dall'ultimo backup. I dati sono solo su questo telefono: salva una copia.</p><button class="btn" data-act="backup">Salva backup Excel</button></div>`;
}

function render() {
  const inCat = state.records.filter((r) => r.cat === state.cat);
  const q = state.q.trim();
  const counts = Object.fromEntries(CATS.map((c) => [c.id, 0]));
  for (const r of state.records) if (!q || matches(r, q)) counts[r.cat]++;
  document.querySelectorAll('.tab').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.cat === state.cat));
    b.querySelector('small').textContent = counts[b.dataset.cat];
  });

  const shown = q ? inCat.filter((r) => matches(r, q)) : inCat;
  const entries = [];
  for (const rec of shown) {
    const cs = composersOf(rec);
    if (isClassic(rec.cat) && state.perComposer && cs.length > 1) {
      cs.forEach((c, i) => entries.push({ rec, key: sortKeyFor(rec, c), under: i > 0 }));
    } else {
      entries.push({ rec, key: sortKeyFor(rec) });
    }
  }
  entries.sort(compareEntries);

  const list = $('#list');
  const rail = $('#rail');
  if (!shown.length) {
    rail.innerHTML = '';
    if (q) {
      list.innerHTML = `<div class="empty-state"><p>Nessun risultato per «${esc(q)}» in ${catName(state.cat)}.</p><p>Controlla le altre categorie: i numeri sulle schede mostrano dove ci sono corrispondenze.</p></div>`;
    } else if (!state.records.length) {
      list.innerHTML = `<div class="empty-state"><p>Il catalogo è vuoto. Tocca «Aggiungi disco» e inquadra il codice a barre sul retro della copertina.</p><p>Hai già un file Excel? Importalo dal menu in alto a destra.</p><button class="btn" data-act="import">Importa da Excel</button></div>${backupNudge()}`;
    } else {
      list.innerHTML = `<div class="empty-state"><p>Nessun disco in ${catName(state.cat)}.</p><p>Tocca «Aggiungi disco» per inserirne uno.</p></div>${backupNudge()}`;
    }
    return;
  }

  let html = backupNudge();
  let current = null;
  const letters = [];
  for (const e of entries) {
    const L = letterOf(e.key);
    if (L !== current) {
      if (current !== null) html += '</section>';
      html += `<section class="group"><h2 class="divider" id="L-${L === '#' ? 'num' : L}"><span>${L}</span></h2>`;
      letters.push(L);
      current = L;
    }
    html += isClassic(e.rec.cat) ? classicRow(e.rec, e.under) : popRow(e.rec);
  }
  html += '</section>';
  list.innerHTML = html;
  rail.innerHTML = letters.length >= 4 ? letters.map((l) => `<button data-letter="${l === '#' ? 'num' : l}" aria-label="Vai a ${l}">${l}</button>`).join('') : '';
}

$('#rail').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const el = document.getElementById('L-' + b.dataset.letter);
  if (el) window.scrollTo({ top: el.parentElement.getBoundingClientRect().top + scrollY - $('#chrome').offsetHeight, behavior: 'auto' });
});

$('#list').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'backup') return doExportXlsx();
  if (act === 'import') return $('#fileImport').click();
  const row = e.target.closest('.rec');
  if (row) openForm(editDraft(row.dataset.id));
});
$('#list').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.rec')) {
    e.preventDefault();
    openForm(editDraft(e.target.dataset.id));
  }
});

function refreshLists() {
  const comps = new Set(), labels = new Set();
  for (const r of state.records) {
    composersOf(r).forEach((c) => comps.add(c));
    if (r.label) labels.add(r.label);
  }
  $('#dlComposers').innerHTML = [...comps].sort().map((c) => `<option value="${esc(c)}">`).join('');
  $('#dlLabels').innerHTML = [...labels].sort().map((c) => `<option value="${esc(c)}">`).join('');
}

function touchChanges(n = 1) {
  store.set('changes', store.get('changes', 0) + n);
}

/* ---------- scheda disco (aggiunta/modifica) ---------- */
let draft = null;
const blank = (cat, base = {}) => ({
  id: nextId(state.records), cat, works: [{ composer: '', title: '' }], artist: '', title: '', year: '', genre: '',
  label: '', catno: '', barcode: '', notes: '', cover: '', coverUrl: '', mbid: '', ...base, _new: true,
});
function editDraft(id) {
  const r = structuredClone(state.records.find((x) => x.id === id));
  if (!r.works?.length) r.works = [{ composer: '', title: '' }];
  return { ...r, _orig: r.id };
}

function workRow(w = {}) {
  return `<div class="wrow">
    <input name="wc" list="dlComposers" placeholder="Compositore (vuoto = come sopra)" value="${esc(w.composer)}" autocomplete="off" aria-label="Compositore">
    <input name="wt" placeholder="Composizione" value="${esc(w.title)}" autocomplete="off" aria-label="Composizione">
    <button type="button" class="btn x" data-rm aria-label="Rimuovi riga">×</button>
  </div>`;
}

function formHtml(d) {
  const classic = isClassic(d.cat);
  const seg = CATS.map((c) => `<label><input type="radio" name="cat" value="${c.id}" ${c.id === d.cat ? 'checked' : ''}><span>${c.name}</span></label>`).join('');
  const chips = d.suggest?.length
    ? `<div class="chips" id="chips"><small>Dal database:</small>${d.suggest.map((s) => `<button type="button" class="chip" data-fill="${esc(s)}">${esc(s)}</button>`).join('')}</div>`
    : '';
  return `<form id="recForm" autocomplete="off">
    <header class="sheet-h"><h2 id="formTitle">${d._new ? 'Nuovo disco' : esc(d._orig)}</h2><button type="button" class="btn icon" data-close aria-label="Chiudi">×</button></header>
    <div class="sheet-b">
      <div class="seg" role="radiogroup" aria-label="Categoria">${seg}</div>
      <div class="row2">
        <label class="field"><span>Indice</span><input name="id" value="${esc(d.id)}" required></label>
        <label class="field"><span>Anno</span><input name="year" value="${esc(d.year)}" inputmode="numeric" maxlength="4"></label>
      </div>
      <div data-for="classic" ${classic ? '' : 'hidden'}>
        <div class="field"><span>Compositori e composizioni</span></div>
        <div id="works" style="display:grid;gap:8px;margin-top:4px">${d.works.map(workRow).join('')}</div>
        <div class="row-actions" style="margin-top:8px"><button type="button" class="btn" id="addWork">Aggiungi riga</button></div>
        ${chips}
      </div>
      <div data-for="pop" ${classic ? 'hidden' : ''} style="display:${classic ? 'none' : 'grid'};gap:14px">
        <label class="field"><span>Artista</span><input name="artist" value="${esc(d.artist)}"></label>
        <label class="field"><span>Titolo</span><input name="title" value="${esc(d.title)}"></label>
        <label class="field"><span>Genere</span><input name="genre" value="${esc(d.genre)}" placeholder="Jazz, colonna sonora, folk…"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Etichetta discografica</span><input name="label" list="dlLabels" value="${esc(d.label)}"></label>
        <label class="field"><span>Numero di catalogo</span><input name="catno" value="${esc(d.catno)}"></label>
      </div>
      <label class="field"><span>Codice a barre</span><input name="barcode" value="${esc(d.barcode)}" inputmode="numeric"></label>
      <label class="field"><span>Note (interpreti, stato del disco)</span><textarea name="notes">${esc(d.notes)}</textarea></label>
      <div class="cover-edit">
        <div id="coverBox">${coverBox(d)}</div>
        <div class="row-actions" style="flex:1">
          <label class="btn">Foto copertina<input type="file" accept="image/*" capture="environment" id="fileCover" hidden></label>
          <button type="button" class="btn" id="rmCover" ${d.cover ? '' : 'hidden'}>Rimuovi</button>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn primary" value="save">Salva</button>
        ${d._new ? '<button class="btn" value="again">Salva e aggiungi altro</button>' : '<button type="button" class="btn danger" id="btnDelete">Elimina</button>'}
      </div>
    </div>
  </form>`;
}
const coverBox = (d) => (d.cover ? `<img src="${esc(d.cover)}" alt="Copertina">` : '<div class="ph" aria-hidden="true"></div>');

function openForm(d) {
  draft = d;
  const dlg = $('#dlgForm');
  dlg.innerHTML = formHtml(d);
  refreshLists();
  bindForm(dlg);
  if (!dlg.open) dlg.showModal();
  if (d.mbid && !d.cover) {
    const mine = d;
    MB.fetchCover(d.mbid).then((url) => {
      if (url && draft === mine) {
        mine.cover = url;
        $('#coverBox').innerHTML = coverBox(mine);
        $('#rmCover').hidden = false;
      }
    });
  }
}

function bindForm(dlg) {
  const form = $('#recForm', dlg);
  const toggle = () => {
    const cat = form.cat.value;
    const classic = isClassic(cat);
    const c = form.querySelector('[data-for=classic]');
    const p = form.querySelector('[data-for=pop]');
    c.hidden = !classic;
    p.hidden = classic;
    p.style.display = classic ? 'none' : 'grid';
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'cat') toggle(); });
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return dlg.close();
    if (e.target.closest('#addWork')) {
      $('#works', form).insertAdjacentHTML('beforeend', workRow());
      $('#works', form).lastElementChild.querySelector('input[name=wc]').focus();
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const rows = $('#works', form);
      if (rows.children.length > 1) rm.closest('.wrow').remove();
      else rm.closest('.wrow').querySelectorAll('input').forEach((i) => (i.value = ''));
    }
    const chip = e.target.closest('[data-fill]');
    if (chip) {
      const first = $('#works input[name=wc]', form);
      const emptyC = [...form.querySelectorAll('input[name=wc]')].find((i) => !i.value);
      (emptyC || first).value = tidyComposer(chip.dataset.fill);
    }
    if (e.target.closest('#btnDelete')) deleteDraft(dlg);
    if (e.target.closest('#rmCover')) {
      draft.cover = '';
      draft.coverUrl = '';
      $('#coverBox').innerHTML = coverBox(draft);
      e.target.closest('#rmCover').hidden = true;
    }
  });
  $('#fileCover', form).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      draft.cover = await resizeImage(f);
      $('#coverBox').innerHTML = coverBox(draft);
      $('#rmCover').hidden = false;
    } catch {
      toast('Non riesco a leggere questa foto.');
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveDraft(form, e.submitter?.value === 'again', dlg);
  });
}

function readForm(form) {
  const f = new FormData(form);
  const cat = f.get('cat');
  const rec = {
    id: formatId(f.get('id')),
    cat,
    works: [],
    artist: '', title: '',
    year: String(f.get('year') || '').trim(),
    genre: '',
    label: String(f.get('label') || '').trim(),
    catno: String(f.get('catno') || '').trim(),
    barcode: String(f.get('barcode') || '').replace(/\s/g, ''),
    notes: String(f.get('notes') || '').trim(),
  };
  if (isClassic(cat)) {
    let last = '';
    for (const row of form.querySelectorAll('.wrow')) {
      const c = tidyComposer(row.querySelector('[name=wc]').value);
      const t = row.querySelector('[name=wt]').value.trim();
      if (c) last = c;
      if (c || t) rec.works.push({ composer: last, title: t });
    }
  } else {
    rec.artist = String(f.get('artist') || '').trim();
    rec.title = String(f.get('title') || '').trim();
    rec.genre = String(f.get('genre') || '').trim();
  }
  return rec;
}

async function saveDraft(form, again, dlg) {
  const rec = readForm(form);
  if (!rec.id) return toast('Serve un indice, per esempio LP0024.');
  if (isClassic(rec.cat) ? !rec.works.length : !(rec.artist || rec.title)) {
    return toast(isClassic(rec.cat) ? 'Inserisci almeno un compositore o una composizione.' : 'Inserisci almeno artista o titolo.');
  }
  const clash = state.records.find((r) => r.id === rec.id && r.id !== draft._orig);
  if (clash) return toast(`L'indice ${rec.id} è già usato da un altro disco.`);
  if (draft._new) {
    const dup = state.records.find(
      (r) => (rec.barcode && r.barcode === rec.barcode) || (rec.catno && rec.label && norm(r.catno) === norm(rec.catno) && norm(r.label) === norm(rec.label)),
    );
    if (dup && !confirm(`Sembra già presente come ${dup.id}. Salvare lo stesso?`)) return;
  }
  Object.assign(rec, {
    cover: draft.cover || '',
    coverUrl: draft.cover ? '' : draft.coverUrl || '',
    mbid: draft.mbid || '',
    created: draft.created || Date.now(),
    updated: Date.now(),
  });
  await DB.put(rec);
  if (draft._orig && draft._orig !== rec.id) {
    await DB.remove(draft._orig);
    state.records = state.records.filter((r) => r.id !== draft._orig);
  }
  const i = state.records.findIndex((r) => r.id === rec.id);
  if (i >= 0) state.records[i] = rec;
  else state.records.push(rec);
  touchChanges();
  navigator.storage?.persist?.();
  state.cat = rec.cat;
  store.set('cat', state.cat);
  render();
  dlg.close();
  toast(`Salvato ${rec.id}`);
  if (again) openAdd(rec.cat);
}

async function deleteDraft(dlg) {
  if (!confirm(`Eliminare ${draft._orig}? L'operazione non si può annullare.`)) return;
  await DB.remove(draft._orig);
  state.records = state.records.filter((r) => r.id !== draft._orig);
  touchChanges();
  render();
  dlg.close();
  toast(`${draft._orig} eliminato`);
}

/* ---------- scansione e ricerca ---------- */
let lastBarcode = '';
let lastResults = [];

function addCatsHtml() {
  $('#addCats').innerHTML = CATS.map(
    (c) => `<label><input type="radio" name="addcat" value="${c.id}" ${c.id === state.addCat ? 'checked' : ''}><span>${c.name}</span></label>`,
  ).join('');
}
$('#addCats').addEventListener('change', (e) => {
  state.addCat = e.target.value;
  store.set('addCat', state.addCat);
});

function openAdd(cat) {
  if (cat) {
    state.addCat = cat;
    store.set('addCat', cat);
  }
  addCatsHtml();
  lastBarcode = '';
  $('#searchQ').value = '';
  $('#dlgAdd').showModal();
  startScan();
}
$('#btnAdd').addEventListener('click', () => openAdd(state.cat));
$('#dlgAdd').addEventListener('close', () => Scan.stop());
document.addEventListener('visibilitychange', () => document.hidden && Scan.stop());

async function startScan() {
  $('#scanPane').hidden = false;
  $('#resPane').hidden = true;
  const msg = $('#scanMsg');
  msg.className = 'hint';
  msg.textContent = 'Inquadra il codice a barre sul retro della copertina.';
  $('#btnTorch').hidden = true;
  try {
    await Scan.start($('#vid'), onCode);
    $('#btnTorch').hidden = !Scan.torchSupported();
  } catch (e) {
    msg.className = 'hint err';
    msg.textContent = e.message;
  }
}

function onCode(code) {
  navigator.vibrate?.(60);
  Scan.stop();
  $('#searchQ').value = code;
  runSearch(code);
}

$('#btnTorch').addEventListener('click', async (e) => {
  const on = !e.target.dataset.on;
  try {
    await Scan.setTorch(on);
    e.target.dataset.on = on ? '1' : '';
    e.target.textContent = on ? 'Spegni luce' : 'Luce';
  } catch { /* non disponibile */ }
});

$('#fileBar').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  Scan.stop();
  const msg = $('#scanMsg');
  msg.className = 'hint';
  msg.textContent = 'Leggo la foto…';
  try {
    const code = await Scan.decodeFile(f);
    if (code) return onCode(code);
    msg.className = 'hint err';
    msg.textContent = 'Non trovo un codice in questa foto. Avvicinati, tieni il codice a fuoco e ben illuminato, poi riprova.';
  } catch {
    msg.className = 'hint err';
    msg.textContent = 'Non riesco a leggere questa foto.';
  }
});

$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#searchQ').value.trim();
  if (v) {
    Scan.stop();
    runSearch(v);
  }
});
$('#btnManual').addEventListener('click', manual);
$('#btnManualRes').addEventListener('click', manual);
$('#btnRescan').addEventListener('click', startScan);

function manual() {
  $('#dlgAdd').close();
  openForm(blank(state.addCat, { barcode: lastBarcode }));
}

async function runSearch(raw) {
  const digits = raw.replace(/[\s-]/g, '');
  const isBar = /^(\d{8}|\d{12,13})$/.test(digits);
  lastBarcode = isBar ? digits : '';
  $('#scanPane').hidden = true;
  $('#resPane').hidden = false;
  $('#resList').innerHTML = '';
  const msg = $('#resMsg');
  msg.className = 'hint';
  msg.textContent = isBar ? `Cerco il codice ${digits}…` : `Cerco «${raw}»…`;
  try {
    lastResults = isBar ? await MB.byBarcode(digits) : await MB.byText(raw);
  } catch (e) {
    msg.className = 'hint err';
    msg.textContent = e.message + ' Puoi inserire i dati a mano: il codice a barre resta salvato.';
    return;
  }
  if (!lastResults.length) {
    msg.textContent = isBar
      ? `Nessun disco con il codice ${digits} nel database. Inseriscilo a mano: il codice resta salvato.`
      : `Nessun risultato per «${raw}». Prova con meno parole o inseriscilo a mano.`;
    return;
  }
  msg.textContent = 'Tocca il disco giusto. Controlla etichetta e numero di catalogo: la stessa copertina può avere più edizioni.';
  $('#resList').innerHTML = lastResults
    .map(
      (r, i) => `<li><button class="res" data-i="${i}">
        <img class="cv" src="${MB.coverUrl(r.mbid)}" alt="" loading="lazy">
        <div><b>${esc(r.title)}</b><span>${esc(r.artistText)}</span>
        <span>${[r.label, r.catno, r.year, r.country, r.format].filter(Boolean).map(esc).join(' · ')}</span></div>
      </button></li>`,
    )
    .join('');
  $('#resList').querySelectorAll('img.cv').forEach((img) => img.addEventListener('error', () => (img.style.visibility = 'hidden')));
}

$('#resList').addEventListener('click', (e) => {
  const b = e.target.closest('.res');
  if (!b) return;
  const r = lastResults[+b.dataset.i];
  const cat = state.addCat;
  const base = {
    label: r.label, catno: r.catno, year: r.year, barcode: r.barcode || lastBarcode, mbid: r.mbid,
    coverUrl: MB.coverUrl(r.mbid), suggest: [...new Set(r.artists.map((a) => a.sort))],
  };
  const d = isClassic(cat)
    ? blank(cat, { ...base, works: [{ composer: '', title: r.title }], notes: r.artistText })
    : blank(cat, { ...base, artist: r.artistText, title: r.title });
  $('#dlgAdd').close();
  openForm(d);
});

/* ---------- menu, backup, importazione ---------- */
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'mai';
}

function openMenu() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const dlg = $('#dlgMenu');
  dlg.innerHTML = `<header class="sheet-h"><h2 id="menuTitle">Menu</h2><button class="btn icon" data-close aria-label="Chiudi">×</button></header>
    <div class="sheet-b"><div class="menu-list">
      <p class="stat">${state.records.length} dischi · ultimo backup: ${fmtDate(store.get('lastBackup', ''))}</p>
      <button class="btn" data-act="xlsx">Esporta in Excel</button>
      <button class="btn" data-act="json">Backup completo (JSON, con copertine)</button>
      <button class="btn" data-act="import">Importa da Excel o backup</button>
      <label class="toggle"><input type="checkbox" id="optPer" ${state.perComposer ? 'checked' : ''}> Mostra i dischi con più compositori sotto ciascuno</label>
      ${installEvent && !standalone ? '<button class="btn primary" data-act="install">Installa l\'app</button>' : ''}
      ${ios && !standalone ? '<p class="stat">Per installarla su iPhone: Condividi, poi «Aggiungi alla schermata Home».</p>' : ''}
    </div></div>`;
  IO.preloadXlsx();
  dlg.showModal();
}
$('#btnMenu').addEventListener('click', openMenu);
$('#dlgMenu').addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'import') { $('#dlgMenu').close(); return $('#fileImport').click(); }
  if (act === 'install') { installEvent?.prompt(); return; }
  $('#dlgMenu').close();
  if (act === 'xlsx') doExportXlsx();
  if (act === 'json') doExportJson();
});
$('#dlgMenu').addEventListener('change', (e) => {
  if (e.target.id === 'optPer') {
    state.perComposer = e.target.checked;
    store.set('perComposer', state.perComposer);
    render();
  }
});

function markBackup() {
  store.set('lastBackup', new Date().toISOString());
  store.set('changes', 0);
  render();
}
const stamp = () => new Date().toISOString().slice(0, 10);

async function doExportXlsx() {
  if (!state.records.length) return toast('Non c\'è ancora nulla da esportare.');
  try {
    const res = await IO.saveBlob(await IO.xlsxBlob(state.records), `vinili-${stamp()}.xlsx`);
    if (res !== 'cancelled') { markBackup(); toast('File Excel pronto'); }
  } catch (e) { toast(e.message || 'Esportazione non riuscita.'); }
}
async function doExportJson() {
  if (!state.records.length) return toast('Non c\'è ancora nulla da esportare.');
  try {
    const res = await IO.saveBlob(IO.backupJson(state.records), `vinili-backup-${stamp()}.json`);
    if (res !== 'cancelled') { markBackup(); toast('Backup salvato'); }
  } catch (e) { toast(e.message || 'Backup non riuscito.'); }
}

$('#fileImport').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const recs = await IO.readFile(f);
    openImport(recs, f.name);
  } catch (err) {
    toast(err.message || 'Non riesco a leggere il file.');
  }
});

function openImport(recs, name) {
  const have = new Set(state.records.map((r) => r.id));
  const fresh = recs.filter((r) => !have.has(r.id));
  const byCat = CATS.map((c) => [c.name, recs.filter((r) => r.cat === c.id).length]).filter(([, n]) => n);
  const dlg = $('#dlgImport');
  dlg.innerHTML = `<header class="sheet-h"><h2 id="impTitle">Importa dischi</h2><button class="btn icon" data-close aria-label="Chiudi">×</button></header>
    <div class="sheet-b">
      <p class="stat" style="color:var(--ink)">${esc(name)}: ${recs.length} dischi (${byCat.map(([n, c]) => `${c} ${n}`).join(', ')}).</p>
      ${state.records.length ? `<p class="stat">${fresh.length} sono nuovi; ${recs.length - fresh.length} hanno un indice già presente.</p>` : ''}
      <p class="stat">Se il file non indica la categoria, riconosco i dischi d'opera dal titolo; puoi correggerli aprendoli uno per uno.</p>
      <div class="form-actions">
        <button class="btn primary" data-do="add">${state.records.length ? `Aggiungi i ${fresh.length} nuovi` : `Importa ${recs.length} dischi`}</button>
        ${state.records.length ? '<button class="btn danger" data-do="replace">Sostituisci tutto</button>' : ''}
      </div>
    </div>`;
  dlg.onclick = async (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) return dlg.close();
    const what = e.target.closest('[data-do]')?.dataset.do;
    if (!what) return;
    if (what === 'replace' && !confirm(`Questo cancella i ${state.records.length} dischi attuali e li sostituisce con quelli del file. Continuare?`)) return;
    const now = Date.now();
    const toSave = (what === 'replace' ? recs : fresh).map((r) => ({ ...r, created: r.created || now, updated: now }));
    await DB.putMany(toSave, { replace: what === 'replace' });
    state.records = await DB.all();
    navigator.storage?.persist?.();
    const firstCat = toSave[0]?.cat;
    if (firstCat) { state.cat = firstCat; store.set('cat', firstCat); }
    render();
    dlg.close();
    toast(`${toSave.length} dischi importati`);
  };
  dlg.showModal();
}

/* ---------- avvio ---------- */
async function boot() {
  buildTabs();
  updateStick();
  try {
    state.records = await DB.all();
  } catch {
    toast('Archivio non disponibile in questa modalità del browser.');
  }
  refreshLists();
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
