// 공유 보기 전용 화면. 이 앱의 다른 화면들과 달리, GitHub 연결 설정이나
// IndexedDB, canWrite() 같은 "이 기기의 로컬 상태"를 전혀 쓰지 않습니다.
// 미리 공개 저장소에 올려둔 스냅샷 JSON을 fetch로 그냥 읽어와 보여줄
// 뿐이라, 방문자가 어떤 기기·브라우저로 열든 항상 읽기 전용으로만 보입니다.
import { escapeHtml, formatDate, contentBlockHtml, wireContentToggle, applyContentClamp } from './shared.js';
import { ENTRY_TYPES } from '../config.js';

const TYPE_MAP = new Map(ENTRY_TYPES.map((t) => [t.id, t]));

function typeInfoFor(entry) {
  if (entry.type === 'retro') return { emoji: '🪞', label: '회고' };
  return TYPE_MAP.get(entry.type) || { emoji: '📝', label: '기록' };
}

function readOnlyEntryCard(entry, collectionsById) {
  const typeInfo = typeInfoFor(entry);
  const collectionItem = entry.collectionId ? collectionsById.get(entry.collectionId) : null;
  const sourceLine = [entry.source || (collectionItem ? collectionItem.title : ''), entry.author].filter(Boolean).join(' · ');
  const tags = (entry.tags || []).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ');
  const linkLine = entry.url
    ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener" class="entry-link">${escapeHtml(entry.url)}</a>`
    : '';
  return `
    <article class="entry-card">
      <div class="entry-meta">
        <span class="entry-type">${typeInfo.emoji} ${typeInfo.label}</span>
        <span class="entry-meta-right">
          <span class="entry-time">${formatDate(entry.createdAt)}</span>
        </span>
      </div>
      ${sourceLine ? `<div class="entry-source">${escapeHtml(sourceLine)}</div>` : ''}
      ${contentBlockHtml(entry.content)}
      ${linkLine}
      ${tags ? `<div class="entry-tags">${tags}</div>` : ''}
    </article>
  `;
}

export async function renderViewer(root, slug) {
  root.innerHTML = `
    <div class="view viewer-view">
      <div class="viewer-banner">🔒 읽기 전용으로 공유된 기록이에요 · 여기서는 아무것도 고치거나 지울 수 없어요</div>
      <div id="viewer-body" class="empty-state">불러오는 중...</div>
    </div>
  `;
  const bodyEl = root.querySelector('#viewer-body');
  try {
    const res = await fetch(`./data-share/${encodeURIComponent(slug)}.json`, { cache: 'no-store' });
    if (!res.ok) {
      bodyEl.className = 'empty-state';
      bodyEl.textContent = '이 링크를 찾을 수 없어요. 링크가 잘못되었거나, 더 이상 공유되지 않는 것 같아요.';
      return;
    }
    const data = await res.json();
    const collectionsById = new Map((data.collections || []).map((c) => [c.id, c]));
    const list = (data.entries || [])
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (list.length === 0) {
      bodyEl.className = 'empty-state';
      bodyEl.textContent = '아직 공유된 기록이 없어요.';
      return;
    }
    bodyEl.className = 'entry-list';
    bodyEl.innerHTML = list.map((e) => readOnlyEntryCard(e, collectionsById)).join('');
    wireContentToggle(bodyEl);
    applyContentClamp(bodyEl);
  } catch (e) {
    bodyEl.className = 'empty-state';
    bodyEl.textContent = `불러오는 중 문제가 생겼어요: ${e.message}`;
  }
}
