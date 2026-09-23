// 위시리스트 탭: 책·영화·드라마·영상·음악·글·장소 중 나중에 보고/읽고/듣고/가고
// 싶은 것들을 가볍게 담아두는 목록. 컬렉션과 달리 실제 기록과는 연결되지 않고
// 제목 + (선택) 아티스트만 입력합니다. 카드형 목록으로 보여지며, 화면이
// 넓어질수록 1열 -> 4열까지 반응형으로 늘어납니다(컬렉션과 동일한 그리드 규칙).
import * as wishlist from '../wishlist.js';
import { WISHLIST_TYPES, canWrite } from '../config.js';
import { escapeHtml } from './shared.js';

const TYPE_MAP = new Map(WISHLIST_TYPES.map((t) => [t.id, t]));

let unsub = null;
let modalEl = null;

export function render(container) {
  renderList(container);
  unsub = wishlist.onChange(() => renderList(container));
  return () => {
    if (unsub) unsub();
    closeModal();
  };
}

function renderList(container) {
  const items = wishlist.getItems();
  const addBtn = canWrite()
    ? `<button type="button" class="btn secondary" id="wishlist-add-btn">＋ 위시리스트 추가</button>`
    : '';

  container.innerHTML = `
    <div class="view book-view">
      <h1 class="view-title">⭐ 위시리스트</h1>
      <p class="view-subtitle">나중에 보고 싶은 책·영화·드라마·영상·음악·글·장소를 미리 담아두세요.</p>
      ${addBtn}
      ${
        items.length === 0
          ? `<div class="empty-state">아직 담아둔 항목이 없어요.${canWrite() ? ' 위의 버튼으로 추가해보세요.' : ''}</div>`
          : `<div class="book-grid">${items.map(itemCardHtml).join('')}</div>`
      }
    </div>
  `;

  const addBtnEl = container.querySelector('#wishlist-add-btn');
  if (addBtnEl) addBtnEl.addEventListener('click', () => openAddModal());

  container.querySelectorAll('.wishlist-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!window.confirm('이 항목을 위시리스트에서 지울까요?')) return;
      wishlist.deleteItem(btn.dataset.id);
    });
  });
}

function itemCardHtml(item) {
  const typeInfo = TYPE_MAP.get(item.type) || WISHLIST_TYPES[0];
  const deleteBtn = canWrite()
    ? `<button type="button" class="entry-delete wishlist-delete" data-id="${item.id}" aria-label="삭제">✕</button>`
    : '';
  return `
    <div class="book-card wishlist-card">
      ${deleteBtn}
      <div class="book-cover">${typeInfo.emoji}</div>
      <div class="book-title">${escapeHtml(item.title)}</div>
      ${item.artist ? `<div class="book-author">${escapeHtml(item.artist)}</div>` : ''}
    </div>
  `;
}

function openAddModal() {
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'wishlist-modal';
    modalEl.className = 'modal-backdrop';
    document.body.appendChild(modalEl);
  }
  let selectedType = WISHLIST_TYPES[0].id;
  const chips = WISHLIST_TYPES.map(
    (t) => `<button type="button" class="chip type-chip${t.id === selectedType ? ' active' : ''}" data-type="${t.id}">${t.emoji} ${t.label}</button>`
  ).join('');

  modalEl.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-label="위시리스트 추가">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>위시리스트에 추가</h2>
        <button type="button" class="icon-btn" id="wishlist-close" aria-label="닫기">✕</button>
      </div>
      <div class="chip-row" id="wishlist-type-chips">${chips}</div>
      <input type="text" id="wishlist-title" placeholder="제목" />
      <input type="text" id="wishlist-artist" placeholder="아티스트 (선택 · 장소는 건축가·디자이너도 좋아요)" />
      <button type="button" class="btn primary" id="wishlist-save">추가하기</button>
    </div>
  `;
  modalEl.classList.add('open');

  const $ = (sel) => modalEl.querySelector(sel);

  $('#wishlist-close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  $('#wishlist-type-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.type-chip');
    if (!btn) return;
    selectedType = btn.dataset.type;
    modalEl.querySelectorAll('.type-chip').forEach((c) => c.classList.toggle('active', c === btn));
  });

  $('#wishlist-save').addEventListener('click', async () => {
    const title = $('#wishlist-title').value.trim();
    if (!title) {
      $('#wishlist-title').focus();
      return;
    }
    const artist = $('#wishlist-artist').value.trim();
    const saveBtn = $('#wishlist-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '추가하는 중...';
    await wishlist.createItem({ title, artist, type: selectedType });
    closeModal();
  });
}

function closeModal() {
  if (modalEl) {
    modalEl.classList.remove('open');
    modalEl.innerHTML = '';
  }
}
