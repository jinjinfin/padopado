// 기록(entry) 도메인 로직: 즉시 로컬 저장(낙관적) + 백그라운드로 GitHub 동기화.
// 모든 기록 유형(글귀/인사이트/링크/생각/영상/회고)은 같은 구조를 공유합니다.
import * as db from './db.js';
import * as gh from './github.js';
import { DATA_PATHS, isConfigured } from './config.js';

let memoryEntries = []; // 최신순 정렬 캐시
let knownYears = new Set();
let syncTimer = null;
let listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(memoryEntries));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function sortDesc(list) {
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getEntries() {
  return memoryEntries;
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
  const local = await db.getAllEntries();
  memoryEntries = sortDesc(local);
  notify();
  if (isConfigured() && navigator.onLine) {
    try {
      await refreshFromRemote();
    } catch (e) {
      console.warn('원격 동기화 초기 로드 실패(오프라인일 수 있음):', e.message);
    }
    syncPending();
  }
}

export async function refreshFromRemote() {
  const dirEntries = await gh.listDir(DATA_PATHS.entriesDir);
  const years = dirEntries
    .map((f) => f.name.match(/^(\d{4})\.json$/))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  for (const year of years) {
    knownYears.add(year);
    const { data } = await gh.getJSONFile(DATA_PATHS.entryYearFile(year));
    if (!Array.isArray(data)) continue;
    const pendingIds = new Set(
      memoryEntries.filter((e) => e.syncStatus === 'pending' && e.year === year).map((e) => e.id)
    );
    const merged = data
      .filter((remote) => !pendingIds.has(remote.id)) // 아직 안 올라간 로컬 수정이 있으면 로컬 우선
      .map((remote) => ({ ...remote, year, syncStatus: 'synced' }));
    await db.putEntries(merged);
    const localOnly = memoryEntries.filter((e) => e.year === year && pendingIds.has(e.id));
    const others = memoryEntries.filter((e) => e.year !== year);
    memoryEntries = sortDesc([...others, ...merged, ...localOnly]);
  }
  notify();
}

export async function addEntry(fields) {
  const now = new Date().toISOString();
  const entry = {
    id: uuid(),
    type: fields.type || 'thought',
    content: fields.content || '',
    source: fields.source || '',
    author: fields.author || '',
    url: fields.url || '',
    collectionId: fields.collectionId || null,
    tags: fields.tags || [],
    retroPeriod: fields.retroPeriod || null,
    createdAt: fields.createdAt || now,
    updatedAt: now,
    year: new Date(fields.createdAt || now).getFullYear(),
    syncStatus: 'pending',
  };
  await db.putEntry(entry);
  memoryEntries = sortDesc([entry, ...memoryEntries]);
  notify();
  queueSync();
  return entry;
}

export async function updateEntry(id, patch) {
  const idx = memoryEntries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const updated = { ...memoryEntries[idx], ...patch, updatedAt: new Date().toISOString(), syncStatus: 'pending' };
  await db.putEntry(updated);
  memoryEntries = sortDesc(memoryEntries.map((e) => (e.id === id ? updated : e)));
  notify();
  queueSync();
  return updated;
}

export async function deleteEntry(id) {
  const entry = memoryEntries.find((e) => e.id === id);
  if (!entry) return;
  memoryEntries = memoryEntries.filter((e) => e.id !== id);
  await db.deleteEntryLocal(id);
  notify();
  const pendingDeletes = (await db.kvGet('pendingDeletes')) || [];
  pendingDeletes.push({ id, year: entry.year });
  await db.kvSet('pendingDeletes', pendingDeletes);
  queueSync();
}

function queueSync() {
  if (!isConfigured()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncPending().catch((e) => console.warn('동기화 실패:', e.message));
  }, 1200);
}

export async function syncPending() {
  if (!isConfigured() || !navigator.onLine) return;
  const pending = memoryEntries.filter((e) => e.syncStatus === 'pending');
  const pendingDeletes = (await db.kvGet('pendingDeletes')) || [];
  const years = new Set([...pending.map((e) => e.year), ...pendingDeletes.map((d) => d.year)]);
  if (years.size === 0) return;

  for (const year of years) {
    const yearPending = pending.filter((e) => e.year === year);
    const yearDeleteIds = new Set(pendingDeletes.filter((d) => d.year === year).map((d) => d.id));
    await gh.putJSONFile(
      DATA_PATHS.entryYearFile(year),
      (current) => {
        const arr = Array.isArray(current) ? current : [];
        const byId = new Map(arr.map((e) => [e.id, e]));
        for (const id of yearDeleteIds) byId.delete(id);
        for (const e of yearPending) {
          const { syncStatus, ...clean } = e;
          byId.set(e.id, clean);
        }
        return sortDesc(Array.from(byId.values()));
      },
      `sync(${year}): ${yearPending.length}개 기록 저장, ${yearDeleteIds.size}개 삭제`
    );
    const syncedNow = yearPending.map((e) => ({ ...e, syncStatus: 'synced' }));
    await db.putEntries(syncedNow);
    memoryEntries = sortDesc(
      memoryEntries.map((e) => syncedNow.find((s) => s.id === e.id) || e)
    );
  }
  const remainingDeletes = pendingDeletes.filter((d) => !years.has(d.year));
  await db.kvSet('pendingDeletes', remainingDeletes);
  notify();
}

export function pendingCount() {
  return memoryEntries.filter((e) => e.syncStatus === 'pending').length;
}

// 온라인 복귀 시: 내가 쓴 대기중인 기록을 먼저 올리고(push), 그 다음 다른
// 기기(예: 모바일)가 그 사이 올려둔 기록도 받아옵니다(pull). pull이 없으면
// 다른 기기에서 쓴 글이 "설정 > 지금 동기화"를 직접 누르기 전까지 이 기기
// 화면에 영영 나타나지 않습니다.
window.addEventListener('online', () => {
  syncPending()
    .then(() => refreshFromRemote())
    .catch(() => {});
});
