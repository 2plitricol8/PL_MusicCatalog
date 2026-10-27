// Archivio locale (IndexedDB). I dati restano sul dispositivo.
const DB_NAME = 'vinili';
const STORE = 'records';
let opened;

function open() {
  if (!opened) {
    opened = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return opened;
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function all() {
  const db = await open();
  return wrap(db.transaction(STORE).objectStore(STORE).getAll());
}

export async function put(rec) {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(rec);
  await done(tx);
}

export async function remove(id) {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await done(tx);
}

export async function putMany(recs, { replace = false } = {}) {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  if (replace) store.clear();
  for (const r of recs) store.put(r);
  await done(tx);
}

export async function clear() {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await done(tx);
}
