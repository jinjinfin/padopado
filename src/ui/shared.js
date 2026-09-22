// 여러 화면에서 공용으로 쓰는 렌더링 헬퍼.
import { ENTRY_TYPES, canWrite } from '../config.js';

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
  // 읽기 전용 연결(다른 사람에게 "보기 전용"으로 나눠준 토큰)이면 수정/삭제
  // 버튼 자체를 안 보여줍니다 — 어차피 GitHub이 저장을 거부할 텐데, 눌러봤다가
  // 실패하는 것보다 처음부터 없는 게 더 매끄러운 경험이라서요.
  const actionButtons = canWrite()
    ? `<button type="button" class="entry-edit" data-id="${entry.id}" aria-label="수정">✎</button>
       <button type="button" class="entry-delete" data-id="${entry.id}" aria-label="삭제">✕</button>`
    : '';

  return `
    <article class="entry-card" data-id="${entry.id}">
      <div class="entry-meta">
        <span class="entry-type">${typeInfo.emoji} ${typeInfo.label}</span>
        <span class="entry-meta-right">
          <span class="entry-time">${formatDate(entry.createdAt)}${pendingBadge}</span>
          ${actionButtons}
        </span>
      </div>
      ${sourceLine ? `<div class="entry-source">${escapeHtml(sourceLine)}</div>` : ''}
      ${contentBlockHtml(entry.content)}
      ${linkLine}
      ${tags ? `<div class="entry-tags">${tags}</div>` : ''}
    </article>
  `;
}

// 긴 글은 5줄까지만 보이고, 나머지는 "더 보기" 토글로 펼쳐볼 수 있게 합니다.
// 실제로 5줄을 넘는지는 렌더링된 폭에 따라 달라지므로(글자 수만으로는 알 수
// 없음), 버튼은 일단 숨겨두고 applyContentClamp()가 렌더링 후 실제로 넘치는
// 경우에만 보여줍니다. entryCard()뿐 아니라 retro/collection의 자체 카드
// 템플릿에서도 이 함수를 그대로 재사용합니다.
export function contentBlockHtml(content) {
  return `<p class="entry-content clamp-5">${escapeHtml(content).replace(/\n/g, '<br/>')}</p><button type="button" class="content-toggle" style="display:none">더 보기</button>`;
}

// "더 보기 / 접기" 토글 클릭을 이벤트 위임으로 처리합니다. container 안에서
// 앞으로 새로 렌더링될 카드들에도 그대로 적용되도록, 이 함수는 리스트가 담기는
// (재사용되는) 컨테이너 하나에 대해 한 번만 불러주면 됩니다.
export function wireContentToggle(container) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.content-toggle');
    if (!btn) return;
    const contentEl = btn.previousElementSibling;
    if (!contentEl) return;
    const expanded = contentEl.classList.toggle('expanded');
    btn.textContent = expanded ? '접기' : '더 보기';
  });
}

// 방금 새로 렌더링된 .entry-content 중, 실제로 5줄을 넘어서 잘린 것들만
// "더 보기" 버튼을 보이게 합니다. 리스트 내용을 innerHTML로 새로 그릴 때마다
// (검색어 입력, 필터 변경, 데이터 변경 등) 매번 다시 불러줘야 합니다.
export function applyContentClamp(container) {
  if (!container) return;
  requestAnimationFrame(() => {
    container.querySelectorAll('.entry-content.clamp-5').forEach((el) => {
      const btn = el.nextElementSibling;
      if (!btn || !btn.classList.contains('content-toggle')) return;
      if (el.classList.contains('expanded')) return; // 펼쳐둔 상태는 그대로 유지
      btn.style.display = el.scrollHeight > el.clientHeight + 1 ? '' : 'none';
    });
  });
}

// 기록 삭제 버튼을 이벤트 위임으로 처리하는 공용 헬퍼.
// container 안 어디든 있는 .entry-delete 버튼 클릭을 잡아서, 확인 후 삭제합니다.
export function wireEntryDelete(container, entriesMod) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.entry-delete');
    if (!btn) return;
    if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
    entriesMod.deleteEntry(btn.dataset.id);
  });
}

// 기록 수정 버튼을 이벤트 위임으로 처리하는 공용 헬퍼.
// container 안 어디든 있는 .entry-edit 버튼 클릭을 잡으면 onEdit(id)를 호출합니다.
// 실제로 어떤 기록인지 찾아서 캡처 모달을 여는 일은 각 화면(feed/collection/retro)이
// entries 모듈을 이미 들고 있으므로, 그쪽에서 콜백으로 처리합니다.
export function wireEntryEdit(container, onEdit) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.entry-edit');
    if (!btn) return;
    onEdit(btn.dataset.id);
  });
}
