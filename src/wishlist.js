// 위시리스트: 책·영화·드라마·영상·음악·글·장소 중 "나중에 보고/읽고/듣고/가고
// 싶은 것"을 가볍게 담아두는 목록. 컬렉션과 달리 실제 기록(글)과는 전혀 연결되지
// 않고, 제목과 (선택) 아티스트만 가진 독립적인 항목입니다.
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

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function init() {
  memoryItems = await db.getAllWishlistItems();
  notify();
  if (isConfigured() && navigator.onLine) {
    try {
      await refreshFromRemote();
    } catch (e) {
      console.warn('위시리스트 원격 동기화 실패:', e.message);
    }
  }
}

export async function refreshFromRemote() {
  const { data } = await gh.getJSONFile(DATA_PATHS.wishlist);
  if (Array.isArray(data)) {
    await db.putWishlistItems(data);
    memoryItems = data;
    notify();
  }
}

export async function createItem({ title, artist = '', type }) {
  const item = {
    id: uuid(),
    title: title.trim(),
    artist: (artist || '').trim(),
    type,
    createdAt: new Date().toISOString(),
  };
  memoryItems = [item, ...memoryItems];
  await db.putWishlistItem(item);
  notify();
  pushRemote();
  return item;
}

// "다녀왔어요/봤어요" 체크. 체크되면 이 항목은 목록 화면에서 아래쪽 "다녀온
// 기록" 아카이브로 옮겨집니다. visitedAt은 체크한 시각으로, GitHub Actions 알림
// 스크립트가 "체크한 지 1주일이 지나도 영감 탭에 관련 기록이 없으면" 판단하는
// 기준점으로 씁니다. 체크를 다시 풀거나 재체크하면 그 알림 전송 여부(visitedReminderSentAt)도
// 함께 초기화해서, 다음 번엔 새로 1주일을 기준으로 다시 판단하게 합니다.
export async function setVisited(id, visited) {
  const patch = {
    visited,
    visitedAt: visited ? new Date().toISOString() : null,
    visitedReminderSentAt: null,
  };
  memoryItems = memoryItems.map((it) => (it.id === id ? { ...it, ...patch } : it));
  const updated = memoryItems.find((it) => it.id === id);
  await db.putWishlistItem(updated);
  notify();
  pushRemote();
  return updated;
}

export async function deleteItem(id) {
  memoryItems = memoryItems.filter((it) => it.id !== id);
  await db.deleteWishlistItemLocal(id);
  notify();
  const pendingDeletes = (await db.kvGet('pendingWishlistDeletes')) || [];
  if (!pendingDeletes.includes(id)) pendingDeletes.push(id);
  await db.kvSet('pendingWishlistDeletes', pendingDeletes);
  await pushRemote();
}

async function pushRemote() {
  if (!isConfigured() || !navigator.onLine) return;
  try {
    const pendingDeletes = (await db.kvGet('pendingWishlistDeletes')) || [];
    await gh.putJSONFile(
      DATA_PATHS.wishlist,
      (current) => {
        const arr = Array.isArray(current) ? current : [];
        const byId = new Map(arr.map((it) => [it.id, it]));
        for (const id of pendingDeletes) byId.delete(id);
        for (const it of memoryItems) byId.set(it.id, it);
        return Array.from(byId.values());
      },
      `wishlist: ${memoryItems.length}개 항목 업데이트${pendingDeletes.length ? `, ${pendingDeletes.length}개 삭제` : ''}`
    );
    if (pendingDeletes.length) await db.kvSet('pendingWishlistDeletes', []);
  } catch (e) {
    console.warn('위시리스트 저장 실패(다음 동기화 때 재시도):', e.message);
  }
}

// entries.js/collections.js와 같은 이유: 온라인 복귀 시 내 변경사항을 올린 뒤,
// 다른 기기가 그 사이 만든 위시리스트 항목도 받아옵니다.
window.addEventListener('online', () => {
  pushRemote()
    .then(() => refreshFromRemote())
    .catch(() => {});
});
