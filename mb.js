// Ricerca su MusicBrainz (gratuita, senza chiave) e copertine da Cover Art Archive.
import { resizeImage } from './util.js';

const BASE = 'https://musicbrainz.org/ws/2/';
let nextSlot = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mb(path) {
  // MusicBrainz chiede al massimo ~1 richiesta al secondo.
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Date.now() + wait + 1100;
  if (wait) await sleep(wait);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(BASE + path + (path.includes('?') ? '&' : '?') + 'fmt=json', { signal: ctrl.signal });
    if (res.status === 503 || res.status === 429) throw new Error('Il servizio è occupato. Riprova tra qualche secondo.');
    if (!res.ok) throw new Error('Il servizio ha risposto con un errore (' + res.status + ').');
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Il servizio non risponde. Controlla la connessione e riprova.');
    if (e instanceof TypeError) throw new Error('Non riesco a raggiungere MusicBrainz. Sei offline?');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const lucene = (s) => String(s).replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1').trim();

function parse(r) {
  const ac = r['artist-credit'] || [];
  const artists = ac
    .filter((a) => a.artist)
    .map((a) => ({ name: a.name || a.artist.name, sort: a.artist['sort-name'] || a.name || a.artist.name }));
  const infos = r['label-info'] || [];
  const li = infos.find((i) => i['catalog-number'] && i.label) || infos[0] || {};
  const format = (r.media || []).map((m) => m.format).find(Boolean) || '';
  return {
    mbid: r.id,
    title: r.title || '',
    artists,
    artistText: ac.map((a) => (a.name || a.artist?.name || '') + (a.joinphrase || '')).join('').trim(),
    year: (r.date || '').slice(0, 4),
    label: li.label?.name || '',
    catno: li['catalog-number'] || '',
    barcode: r.barcode || '',
    format,
    country: r.country || '',
    vinyl: /vinyl|lp/i.test(format),
    score: Number(r.score) || 0,
  };
}

const rank = (a, b) => Number(b.vinyl) - Number(a.vinyl) || b.score - a.score;

async function search(query) {
  const j = await mb('release/?limit=25&query=' + encodeURIComponent(query));
  return (j.releases || []).map(parse).sort(rank).slice(0, 12);
}

export function byBarcode(code) {
  const variants = [code];
  if (code.length === 12) variants.push('0' + code);
  if (code.length === 13 && code[0] === '0') variants.push(code.slice(1));
  return search(variants.map((v) => `barcode:${v}`).join(' OR '));
}

export function byText(text) {
  const q = lucene(text);
  return search(`release:(${q}) OR artist:(${q}) OR catno:"${q}"`);
}

export async function fetchCover(mbid) {
  try {
    const res = await fetch(`https://coverartarchive.org/release/${mbid}/front-250`);
    if (!res.ok) return null;
    return await resizeImage(await res.blob());
  } catch {
    return null;
  }
}

export const coverUrl = (mbid) => `https://coverartarchive.org/release/${mbid}/front-250`;
