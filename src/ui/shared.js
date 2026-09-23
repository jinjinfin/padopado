// 여러 화면에서 공용으로 쓰는 렌더링 헬퍼.
import { ENTRY_TYPES, canWrite } from '../config.js';

const TYPE_MAP = new Map(ENTRY_TYPES.map((t) => [t.id, t]));

// 댓글 섹션이 펼쳐져 있는 기록 id들. 목록이 통째로 다시 그려질 때마다(데이터
// 변경, 댓글 등록 직후 등) 매번 접혀버리면 "댓글을 남겼는데 바로 사라진 것
// 같은" 느낌을 주므로, 세션 동안 펼침 상태를 여기 따로 기억해뒀다가
// commentSectionHtml()이 다시 그릴 때 그대로 반영합니다.
const openComments = new Set();

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
  const linkBlock = linkBlockHtml(entry.url);
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
      ${linkBlock}
      ${tags ? `<div class="entry-tags">${tags}</div>` : ''}
      ${commentSectionHtml(entry)}
    </article>
  `;
}

// 각 기록에서 파생된 생각을 짧게 덧붙일 수 있는 댓글 섹션. 기록 자체를 수정하는
// 것과 달리, 원래 내용은 그대로 둔 채 "이 글을 보고 떠오른 것"만 따로 쌓아갑니다.
export function commentSectionHtml(entry) {
  const comments = entry.comments || [];
  const isOpen = openComments.has(entry.id);
  const listHtml = comments
    .map(
      (c) => `
        <li class="comment-item" data-comment-id="${c.id}">
          <p class="comment-text">${escapeHtml(c.text).replace(/\n/g, '<br/>')}</p>
          <span class="comment-item-meta">
            <span class="comment-time">${timeAgo(c.createdAt)}</span>
            <button type="button" class="comment-delete" data-comment-id="${c.id}" aria-label="댓글 삭제">✕</button>
          </span>
        </li>`
    )
    .join('');

  return `
    <div class="comment-block" data-entry-id="${entry.id}">
      <button type="button" class="comment-toggle">💬 댓글${comments.length > 0 ? ` ${comments.length}` : ''}</button>
      <div class="comment-section${isOpen ? '' : ' comment-hidden'}">
        ${comments.length > 0 ? `<ul class="comment-list">${listHtml}</ul>` : ''}
        <form class="comment-form">
          <input type="text" class="comment-input" placeholder="이 글에서 떠오른 생각을 남겨보세요" maxlength="500" />
          <button type="submit" class="comment-submit">등록</button>
        </form>
      </div>
    </div>
  `;
}

// .comment-toggle 클릭으로 댓글 섹션을 펼치고/접습니다. 위 openComments
// 세트에도 반영해서, 이후 목록이 다시 그려져도 펼친 상태가 유지되게 합니다.
export function wireCommentToggle(container) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.comment-toggle');
    if (!btn) return;
    const block = btn.closest('.comment-block');
    if (!block) return;
    const entryId = block.dataset.entryId;
    const section = block.querySelector('.comment-section');
    if (!section) return;
    const nowOpen = section.classList.toggle('comment-hidden') === false;
    if (nowOpen) {
      openComments.add(entryId);
      const input = section.querySelector('.comment-input');
      if (input) input.focus();
    } else {
      openComments.delete(entryId);
    }
  });
}

// 댓글 등록(form submit)과 삭제(✕ 버튼)를 이벤트 위임으로 처리하는 공용 헬퍼.
// entryCard()가 쓰이는 화면(영감 피드, 홈)마다 한 번씩 불러주면 됩니다.
export function wireCommentActions(container, entriesMod) {
  container.addEventListener('submit', (e) => {
    const form = e.target.closest('.comment-form');
    if (!form) return;
    e.preventDefault();
    const block = form.closest('.comment-block');
    if (!block) return;
    const entryId = block.dataset.entryId;
    const input = form.querySelector('.comment-input');
    const text = (input.value || '').trim();
    if (!text) return;
    openComments.add(entryId); // 등록 직후 다시 그려져도 열려있게
    input.value = '';
    entriesMod.addComment(entryId, text);
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.comment-delete');
    if (!btn) return;
    const block = btn.closest('.comment-block');
    if (!block) return;
    if (!window.confirm('이 댓글을 지울까요?')) return;
    entriesMod.deleteComment(block.dataset.entryId, btn.dataset.commentId);
  });
}

// 링크는 목록에서 바로 노출하지 않고, "🔗 링크 보기" 버튼을 눌러야 펼쳐지도록
// 합니다(카드 목록이 URL로 지저분해지지 않도록). wireLinkToggle()로 클릭을 처리합니다.
function linkBlockHtml(url) {
  if (!url) return '';
  return `<button type="button" class="link-toggle">🔗 링크 보기</button><a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="entry-link link-hidden">${escapeHtml(url)}</a>`;
}

export function wireLinkToggle(container) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.link-toggle');
    if (!btn) return;
    const linkEl = btn.nextElementSibling;
    if (!linkEl || !linkEl.classList.contains('entry-link')) return;
    const nowHidden = linkEl.classList.toggle('link-hidden');
    btn.textContent = nowHidden ? '🔗 링크 보기' : '🔗 링크 숨기기';
  });
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
