// 영감 피드: 검색창 + 최근 기록 목록. 태그/유형 필터를 지원합니다.
// 회고(type: 'retro')는 별도의 "회고" 탭에서만 다루므로 이 피드에는 나타나지 않습니다.
// 목록은 최신순이 아니라 매번 탭을 열 때마다 새로 섞이는 랜덤 순서로 보여줍니다
// (다시 발견하는 재미를 위해). 검색 중에는 관련도 순서가 더 유용하므로 그대로 둡니다.
import * as entries from '../entries.js';
import * as collections from '../collections.js';
import * as search from '../search.js';
import { ENTRY_TYPES } from '../config.js';
import { openCapture } from './capture.js';
import { entryCard, wireEntryDelete, wireEntryEdit, wireContentToggle, applyContentClamp, wireLinkToggle } from './shared.js';

const FEED_TYPES = ENTRY_TYPES.filter((t) => t.id !== 'retro');

let unsubEntries = null;
let unsubCollections = null;
let activeTypeFilter = null;
let currentQuery = '';

// 기록 id -> 이번 화면 방문 동안 고정으로 쓰는 랜덤 순위. 목록이 다시 그려질
// 때마다(검색어 입력, 필터 변경, 데이터 변경 등) 매번 새로 섞이면 산만하므로,
// 탭을 새로 열 때만(render() 호출 시) 초기화하고 그 사이엔 순서를 유지합니다.
let randomRank = new Map();

function rankFor(id) {
  if (!randomRank.has(id)) randomRank.set(id, Math.random());
  return randomRank.get(id);
}

function shuffledByRank(list) {
  return [...list].sort((a, b) => rankFor(a.id) - rankFor(b.id));
}

function feedEntries() {
  return entries.getEntries().filter((e) => e.type !== 'retro');
}

export function render(container) {
  randomRank = new Map();
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

  // "전체" 칩이 기본값이자 항상 첫 번째로 있어서, 특정 유형을 골랐다가도 언제든
  // 한 번에 다시 모든 유형을 볼 수 있습니다. 유형 칩들은 토글이 아니라 라디오
  // 버튼처럼 동작해서(한 번에 하나만 선택), "지금 뭘 보고 있는지"가 항상 분명합니다.
  const filterRow = container.querySelector('#feed-type-filters');
  filterRow.innerHTML = [
    `<button type="button" class="chip small" data-type="">전체</button>`,
    ...FEED_TYPES.map(
      (t) => `<button type="button" class="chip small" data-type="${t.id}">${t.emoji} ${t.label}</button>`
    ),
  ].join('');
  const syncFilterChips = () => {
    filterRow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.type === (activeTypeFilter || '')));
  };
  syncFilterChips();
  filterRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    activeTypeFilter = btn.dataset.type || null;
    syncFilterChips();
    rerenderList(container);
  });

  const searchInput = container.querySelector('#feed-search');
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    rerenderList(container);
  });

  wireEntryDelete(container.querySelector('#feed-list'), entries);
  wireEntryEdit(container.querySelector('#feed-list'), (id) => {
    const entry = entries.getEntries().find((e) => e.id === id);
    if (!entry) return;
    openCapture({ editEntry: entry });
  });
  wireContentToggle(container.querySelector('#feed-list'));
  wireLinkToggle(container.querySelector('#feed-list'));

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
  let list = currentQuery.trim() ? search.search(currentQuery) : shuffledByRank(base);
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
  applyContentClamp(listEl);
}

export function openQuickCapture() {
  openCapture({});
}
