// 컬렉션: 책, 영화·드라마 등 "작품" 단위로 쌓이는 아카이브.
// 글귀(quote)를 기록하며 책 제목을 남기거나, 영상/작품(media)을 기록하며 작품명을 남기면
// 같은 제목끼리 자동으로 모여 하나의 아카이브가 됩니다.
import * as db from './db.js';
import * as gh from './github.js';
import { DATA_PATHS, isConfigured } from './config.js';

let memoryItems = [];
let listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(memoryItems));
}
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getItems() {
  return memoryItems;
}
export function getItemsByKind(kind) {
  return memoryItems.filter((it) => it.kind === kind);
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function init() {
  memoryItems = await db.getAllCollectionItems();
  notify();
  if (isConfigured() && navigator.onLine) {
    try {
      await refreshFromRemote();
    } catch (e) {
      console.warn('컬렉션 원격 동기화 실패:', e.message);
    }
  }
}

export async function refreshFromRemote() {
  const { data } = await gh.getJSONFile(DATA_PATHS.collections);
  if (Array.isArray(data)) {
    await db.putCollectionItems(data);
    memoryItems = data;
    notify();
  }
}

/**
 * 제목(과 종류) 기준으로 기존 컬렉션 항목을 찾거나 새로 만듭니다.
 * 같은 제목이라도 책과 영상 작품은 서로 다른 항목으로 구분됩니다.
 */
export async function findOrCreateItem({ title, author, kind }) {
  const norm = (s) => (s || '').trim().toLowerCase();
  const existing = memoryItems.find((it) => it.kind === kind && norm(it.title) === norm(title));
  if (existing) {
    if (!existing.author && author) {
      return updateItem(existing.id, { author: author.trim() });
    }
    return existing;
  }
  return createItem({ title, author, kind });
}

export async function createItem({ title, author, kind, note = '' }) {
  const item = {
    id: uuid(),
    title: title.trim(),
    author: (author || '').trim(),
    kind,
    note,
    finished: false,
    createdAt: new Date().toISOString(),
  };
  memoryItems = [item, ...memoryItems];
  await db.putCollectionItem(item);
  notify();
  pushRemote();
  return item;
}

export async function updateItem(id, patch) {
  memoryItems = memoryItems.map((it) => (it.id === id ? { ...it, ...patch } : it));
  const updated = memoryItems.find((it) => it.id === id);
  await db.putCollectionItem(updated);
  notify();
  pushRemote();
  return updated;
}

async function pushRemote() {
  if (!isConfigured() || !navigator.onLine) return;
  try {
    await gh.putJSONFile(
      DATA_PATHS.collections,
      (current) => {
        const arr = Array.isArray(current) ? current : [];
        const byId = new Map(arr.map((it) => [it.id, it]));
        for (const it of memoryItems) byId.set(it.id, it);
        return Array.from(byId.values());
      },
      `collections: ${memoryItems.length}개 항목 업데이트`
    );
  } catch (e) {
    console.warn('컬렉션 저장 실패(다음 동기화 때 재시도):', e.message);
  }
}

window.addEventListener('online', () => {
  pushRemote().catch(() => {});
});
