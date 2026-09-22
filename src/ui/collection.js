// 컬렉션: 책, 영화·드라마 등 "작품" 단위로 쌓이는 아카이브.
// 글귀를 기록하며 책 제목을 남기거나, 영상/작품을 기록하며 작품명을 남기면 자동으로 여기 쌓입니다.
import * as collections from '../collections.js';
import * as entries from '../entries.js';
import { COLLECTION_KINDS, canWrite } from '../config.js';
import { escapeHtml, formatDate, wireEntryDelete, wireEntryEdit, contentBlockHtml, wireContentToggle, applyContentClamp } from './shared.js';
import { openCapture } from './capture.js';

let unsubCollections = null;
let unsubEntries = null;
let currentItemId = null;

export function render(container) {
  currentItemId = null;
  renderList(container);

  unsubCollections = collections.onChange(() => renderList(container));
  unsubEntries = entries.onChange(() => {
    if (currentItemId) renderDetail(container, currentItemId);
    else renderList(container);
  });

  return () => {
    if (unsubCollections) unsubCollections();
    if (unsubEntries) unsubEntries();
  };
}

function renderList(container) {
  currentItemId = null;
  const items = collections.getItems();
  const countOf = (id) => entries.getEntries().filter((e) => e.collectionId === id).length;

  const books = items.filter((it) => it.kind === 'book');
  const media = items.filter((it) => it.kind === 'media');

  const section = (title, list) =>
    list.length === 0
      ? ''
      : `
        <h2 class="section-title">${title}</h2>
        <div class="book-grid">${list.map((it) => itemCardHtml(it, countOf(it.id))).join('')}</div>
      `;

  container.innerHTML = `
    <div class="view book-view">
      <h1 class="view-title">🗃️ 컬렉션</h1>
      <p class="view-subtitle">글귀를 남긴 책, 기록한 영화·드라마가 작품 단위로 자동으로 쌓여요.</p>
      ${
        items.length === 0
          ? `<div class="empty-state">아직 등록된 항목이 없어요. 영감 탭 + 버튼에서 "글귀"나 "영상/작품"을 고르고, 출처에 책·영상 제목을 적으면 자동으로 여기에 쌓여요.</div>`
          : `${section('📖 책', books)}${section('🎬 영화·드라마', media)}`
      }
    </div>
  `;

  container.querySelectorAll('.book-card').forEach((el) => {
    el.addEventListener('click', () => renderDetail(container, el.dataset.id));
  });
}

function itemCardHtml(item, count) {
  const kindInfo = COLLECTION_KINDS[item.kind] || COLLECTION_KINDS.book;
  return `
    <button type="button" class="book-card" data-id="${item.id}">
      <div class="book-cover">${item.finished ? kindInfo.doneIcon : kindInfo.icon}</div>
      <div class="book-title">${escapeHtml(item.title)}</div>
      <div class="book-author">${escapeHtml(item.author || '')}</div>
      <div class="book-count">${count}개의 기록</div>
    </button>
  `;
}

function renderDetail(container, itemId) {
  currentItemId = itemId;
  const item = collections.getItems().find((it) => it.id === itemId);
  if (!item) { renderList(container); return; }
  const kindInfo = COLLECTION_KINDS[item.kind] || COLLECTION_KINDS.book;
  const itemEntries = entries.getEntries().filter((e) => e.collectionId === itemId);

  // 읽기 전용 연결(다른 사람에게 보기 전용으로 나눠준 토큰)이면 완독 체크와
  // 기록 수정/삭제 버튼을 숨깁니다 — 어차피 GitHub이 저장을 거부할 테니까요.
  const finishToggleHtml = canWrite()
    ? `<label class="finish-toggle">
        <input type="checkbox" id="item-finished" ${item.finished ? 'checked' : ''}/> ${kindInfo.doneLabel}
      </label>`
    : '';
  const actionButtons = (id) => canWrite()
    ? `<button type="button" class="entry-edit" data-id="${id}" aria-label="수정">✎</button>
       <button type="button" class="entry-delete" data-id="${id}" aria-label="삭제">✕</button>`
    : '';

  container.innerHTML = `
    <div class="view book-detail-view">
      <button type="button" class="back-btn" id="book-back">← 컬렉션으로</button>
      <h1 class="view-title">${kindInfo.icon} ${escapeHtml(item.title)}</h1>
      <p class="view-subtitle">${escapeHtml(item.author || '')}</p>
      ${finishToggleHtml}
      <div class="stat-pill">${itemEntries.length}개의 기록을 모았어요</div>
      <div class="entry-list">
        ${itemEntries.map((e) => `
          <article class="entry-card" data-id="${e.id}">
            <div class="entry-meta">
              <span class="entry-meta-right">
                <span class="entry-time">${formatDate(e.createdAt)}</span>
                ${actionButtons(e.id)}
              </span>
            </div>
            ${contentBlockHtml(e.content)}
          </article>
        `).join('') || '<div class="empty-state">아직 이 항목에서 모은 기록이 없어요.</div>'}
      </div>
    </div>
  `;

  container.querySelector('#book-back').addEventListener('click', () => renderList(container));
  const finishedCheckbox = container.querySelector('#item-finished');
  if (finishedCheckbox) {
    finishedCheckbox.addEventListener('change', (e) => {
      collections.updateItem(item.id, { finished: e.target.checked });
    });
  }
  const entryListEl = container.querySelector('.entry-list');
  wireEntryDelete(entryListEl, entries);
  wireEntryEdit(entryListEl, (id) => {
    const entry = entries.getEntries().find((e) => e.id === id);
    if (!entry) return;
    openCapture({ editEntry: entry });
  });
  wireContentToggle(entryListEl);
  applyContentClamp(entryListEl);
}
