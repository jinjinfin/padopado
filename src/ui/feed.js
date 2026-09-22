// 영감 피드: 검색창 + 최근 기록 목록. 태그/유형 필터를 지원합니다.
// 회고(type: 'retro')는 별도의 "회고" 탭에서만 다루므로 이 피드에는 나타나지 않습니다.
import * as entries from '../entries.js';
import * as collections from '../collections.js';
import * as search from '../search.js';
import { ENTRY_TYPES } from '../config.js';
import { openCapture } from './capture.js';
import { entryCard, wireEntryDelete } from './shared.js';

const FEED_TYPES = ENTRY_TYPES.filter((t) => t.id !== 'retro');

let unsubEntries = null;
let unsubCollections = null;
let activeTypeFilter = null;
let currentQuery = '';

function feedEntries() {
  return entries.getEntries().filter((e) => e.type !== 'retro');
}

export function render(container) {
  container.innerHTML = `
    <div class="view feed-view">
      <h1 class="view-title">✨ 영감</h1>
      <p class="view-subtitle">글귀, 인사이트, 링크, 생각, 영상까지 — 쌓이는 대로 다시 찾아보세요.</p>
      <div class="search-bar">
        <input type="search" id="feed-search" placeholder="내용, 태그, 출처로 검색..." />
      </div>
      <div class="chip-row" id="feed-type-filters"></div>
      <div id="feed-list" class="entry-list"></div>
      <div id="feed-empty" class="empty-state" style="display:none">
        아직 기록이 없어요. 오른쪽 아래 + 버튼으로 첫 기록을 남겨보세요.
      </div>
    </div>
  `;

  const filterRow = container.querySelector('#feed-type-filters');
  filterRow.innerHTML = FEED_TYPES.map(
    (t) => `<button type="button" class="chip small" data-type="${t.id}">${t.emoji} ${t.label}</button>`
  ).join('');
  filterRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    activeTypeFilter = activeTypeFilter === btn.dataset.type ? null : btn.dataset.type;
    filterRow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.type === activeTypeFilter));
    rerenderList(container);
  });

  const searchInput = container.querySelector('#feed-search');
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    rerenderList(container);
  });

  wireEntryDelete(container.querySelector('#feed-list'), entries);

  rebuildSearchIndex();
  rerenderList(container);

  unsubEntries = entries.onChange(() => {
    rebuildSearchIndex();
    rerenderList(container);
  });
  unsubCollections = collections.onChange(() => rebuildSearchIndex());

  return () => {
    if (unsubEntries) unsubEntries();
    if (unsubCollections) unsubCollections();
  };
}

function rebuildSearchIndex() {
  const collectionsById = new Map(collections.getItems().map((it) => [it.id, it]));
  search.buildIndex(feedEntries(), collectionsById);
}

function rerenderList(container) {
  const listEl = container.querySelector('#feed-list');
  const emptyEl = container.querySelector('#feed-empty');
  if (!listEl) return;

  const base = feedEntries();
  let list = currentQuery.trim() ? search.search(currentQuery) : base;
  if (activeTypeFilter) list = list.filter((e) => e.type === activeTypeFilter);

  if (list.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = base.length === 0 ? 'block' : 'none';
    if (base.length > 0) {
      listEl.innerHTML = `<div class="empty-state">검색 결과가 없어요.</div>`;
    }
    return;
  }
  emptyEl.style.display = 'none';
  const collectionsById = new Map(collections.getItems().map((it) => [it.id, it]));
  listEl.innerHTML = list.map((e) => entryCard(e, collectionsById)).join('');
}

export function openQuickCapture() {
  openCapture({});
}
