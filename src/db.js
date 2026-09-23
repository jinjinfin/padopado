// IndexedDB 로컬 캐시. 오프라인에서도 즉시 저장되고, 온라인이 되면 GitHub과 동기화됩니다.
import { openDB } from './vendor/idb.min.js';

const DB_NAME = 'jot-db';
const DB_VERSION = 2;

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entries')) {
          const store = db.createObjectStore('entries', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('year', 'year');
          store.createIndex('syncStatus', 'syncStatus');
          store.createIndex('collectionId', 'collectionId');
        }
        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('wishlist')) {
          db.createObjectStore('wishlist', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      },
    });
  }
  return dbPromise;
}

export async function putEntry(entry) {
  const db = await getDB();
  await db.put('entries', entry);
  return entry;
}

export async function putEntries(entries) {
  const db = await getDB();
  const tx = db.transaction('entries', 'readwrite');
  await Promise.all(entries.map((e) => tx.store.put(e)));
  await tx.done;
}

export async function deleteEntryLocal(id) {
  const db = await getDB();
  await db.delete('entries', id);
}

export async function getAllEntries() {
  const db = await getDB();
  return db.getAll('entries');
}

export async function getPendingEntries() {
  const db = await getDB();
  const all = await db.getAllFromIndex('entries', 'syncStatus', 'pending');
  return all;
}

export async function putCollectionItem(item) {
  const db = await getDB();
  await db.put('collections', item);
  return item;
}

export async function putCollectionItems(items) {
  const db = await getDB();
  const tx = db.transaction('collections', 'readwrite');
  await Promise.all(items.map((it) => tx.store.put(it)));
  await tx.done;
}

export async function getAllCollectionItems() {
  const db = await getDB();
  return db.getAll('collections');
}

export async function deleteCollectionItemLocal(id) {
  const db = await getDB();
  await db.delete('collections', id);
}

export async function putWishlistItem(item) {
  const db = await getDB();
  await db.put('wishlist', item);
  return item;
}

export async function putWishlistItems(items) {
  const db = await getDB();
  const tx = db.transaction('wishlist', 'readwrite');
  await Promise.all(items.map((it) => tx.store.put(it)));
  await tx.done;
}

export async function getAllWishlistItems() {
  const db = await getDB();
  return db.getAll('wishlist');
}

export async function deleteWishlistItemLocal(id) {
  const db = await getDB();
  await db.delete('wishlist', id);
}

export async function kvGet(key) {
  const db = await getDB();
  return db.get('kv', key);
}

export async function kvSet(key, value) {
  const db = await getDB();
  return db.put('kv', value, key);
}
