// store.js — recordings live in IndexedDB on this device.
// While recording, each one-second chunk is written straight away, so a crash
// or a closed tab loses at most a second. Finished takes are saved as clips.

const DB_NAME = 'avatar-studio';
const DB_VERSION = 1;
let dbPromise;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const d = open.result;
      if (!d.objectStoreNames.contains('clips')) d.createObjectStore('clips', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('chunks')) {
        const s = d.createObjectStore('chunks', { autoIncrement: true });
        s.createIndex('rec', 'rec');
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return dbPromise;
}

async function store(name, mode = 'readonly') {
  return (await db()).transaction(name, mode).objectStore(name);
}

function done(s) {
  return new Promise((resolve, reject) => {
    s.transaction.oncomplete = () => resolve();
    s.transaction.onerror = () => reject(s.transaction.error);
    s.transaction.onabort = () => reject(s.transaction.error);
  });
}

// ----- chunks of the take in progress -----
export async function putChunk(rec, seq, mime, data, meta) {
  const s = await store('chunks', 'readwrite');
  s.add({ rec, seq, mime, data, ...meta });
  return done(s);
}

export async function getChunks(rec) {
  const s = await store('chunks');
  const rows = await req(s.index('rec').getAll(rec));
  return rows.sort((a, b) => a.seq - b.seq);
}

export async function deleteChunks(rec) {
  const s = await store('chunks', 'readwrite');
  const keys = await req(s.index('rec').getAllKeys(rec));
  for (const k of keys) s.delete(k);
  return done(s);
}

// Takes that were interrupted before they could be saved.
export async function pendingTakes() {
  const s = await store('chunks');
  const rows = await req(s.getAll());
  const map = new Map();
  for (const r of rows) {
    const t = map.get(r.rec) || { rec: r.rec, chunks: 0, bytes: 0, mime: r.mime, started: r.started, width: r.width, height: r.height };
    t.chunks++;
    t.bytes += r.data?.size || 0;
    map.set(r.rec, t);
  }
  return [...map.values()];
}

// ----- finished clips -----
export async function saveClip(clip) {
  const s = await store('clips', 'readwrite');
  s.put(clip);
  return done(s);
}

export async function listClips() {
  const s = await store('clips');
  const rows = await req(s.getAll());
  return rows.sort((a, b) => b.created - a.created);
}

export async function deleteClip(id) {
  const s = await store('clips', 'readwrite');
  s.delete(id);
  return done(s);
}
