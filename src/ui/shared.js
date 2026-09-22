// 여러 화면에서 공용으로 쓰는 렌더링 헬퍼.
import { ENTRY_TYPES } from '../config.js';
import { withUnlock } from './lock.js';

const TYPE_MAP = new Map(ENTRY_TYPES.map((t) => [t.id, t]));

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// 모든 기록은 저장되는 순간 자동으로 날짜가 찍힙니다. 목록에서 언제든 정확한
// 기록일자를 바로 볼 수 있도록, 상대 시간 대신(혹은 함께) 절대 날짜를 항상 보여줍니다.
export function formatDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day}(${WEEKDAY_KO[d.getDay()]}) ${hh}:${mm}`;
}

export function entryDateLabel(iso) {
  return `${formatDate(iso)} · ${timeAgo(iso)}`;
}

export function entryCard(entry, collectionsById = new Map()) {
  const typeInfo = TYPE_MAP.get(entry.type) || { emoji: '📝', label: '기록' };
  const collectionItem = entry.collectionId ? collectionsById.get(entry.collectionId) : null;
  const sourceLine = [entry.source || (collectionItem ? collectionItem.title : ''), entry.author].filter(Boolean).join(' · ');
  const tags = (entry.tags || []).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ');
  const linkLine = entry.url
    ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener" class="entry-link">${escapeHtml(entry.url)}</a>`
    : '';
  const pendingBadge = entry.syncStatus === 'pending' ? '<span class="pending-dot" title="동기화 대기 중">●</span>' : '';

  return `
    <article class="entry-card" data-id="${entry.id}">
      <div class="entry-meta">
        <span class="entry-type">${typeInfo.emoji} ${typeInfo.label}</span>
        <span class="entry-meta-right">
          <span class="entry-time">${formatDate(entry.createdAt)}${pendingBadge}</span>
          <button type="button" class="entry-edit" data-id="${entry.id}" aria-label="수정">✎</button>
          <button type="button" class="entry-delete" data-id="${entry.id}" aria-label="삭제">✕</button>
        </span>
      </div>
      ${sourceLine ? `<div class="entry-source">${escapeHtml(sourceLine)}</div>` : ''}
      <p class="entry-content">${escapeHtml(entry.content).replace(/\n/g, '<br/>')}</p>
      ${linkLine}
      ${tags ? `<div class="entry-tags">${tags}</div>` : ''}
    </article>
  `;
}

// 기록 삭제 버튼을 이벤트 위임으로 처리하는 공용 헬퍼.
// container 안 어디든 있는 .entry-delete 버튼 클릭을 잡아서, 확인 후 삭제합니다.
// 설정 화면 잠금이 걸려 있으면(withUnlock), 삭제도 비밀번호를 맞혀야 진행됩니다 —
// 같이 쓰는 사람이 기록을 지우는 것도 쓰는 것만큼 막아야 하는 일이라서요.
export function wireEntryDelete(container, entriesMod) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.entry-delete');
    if (!btn) return;
    withUnlock(async () => {
      if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
      await entriesMod.deleteEntry(btn.dataset.id);
    });
  });
}

// 기록 수정 버튼을 이벤트 위임으로 처리하는 공용 헬퍼.
// container 안 어디든 있는 .entry-edit 버튼 클릭을 잡으면, 잠금을 확인한 뒤
// onEdit(id)를 호출합니다. 실제로 어떤 기록인지 찾아서 캡처 모달을 여는 일은
// 각 화면(feed/collection/retro)이 entries 모듈을 이미 들고 있으므로, 그쪽에서
// 콜백으로 처리합니다.
export function wireEntryEdit(container, onEdit) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.entry-edit');
    if (!btn) return;
    withUnlock(() => onEdit(btn.dataset.id));
  });
}
