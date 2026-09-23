// 메인 화면: 헤더 로고를 누르면 오는 첫 화면. 인사 메시지("오늘도 파도가
// 밀려와요" + "파도에 올라타 보세요")와 함께, 예전에 쓴 기록 중 하나와
// 위시리스트 중 하나를 각각 무작위로 다시 보여줍니다.
// 탭바에는 나타나지 않는 숨은 화면이라, 로고를 누르는 것이 유일한 진입 경로입니다.
import * as entries from '../entries.js';
import * as collections from '../collections.js';
import * as wishlist from '../wishlist.js';
import * as stats from '../stats.js';
import { WISHLIST_TYPES } from '../config.js';
import { entryCard, wireEntryDelete, wireEntryEdit, wireContentToggle, applyContentClamp, wireLinkToggle, escapeHtml } from './shared.js';
import { openCapture } from './capture.js';

const WISHLIST_TYPE_MAP = new Map(WISHLIST_TYPES.map((t) => [t.id, t]));

let unsubEntries = null;
let unsubWishlist = null;

export function render(container) {
  container.innerHTML = `
    <div class="view home-view">
      <div class="home-hero">
        <div class="home-wave" aria-hidden="true">🌊</div>
        <p class="home-message">오늘도 파도가 밀려와요</p>
        <p class="home-surf-message">🏄 파도에 올라타 보세요</p>
      </div>
      <div id="home-pick" class="home-pick"></div>
      <h2 class="section-title">🎲 위시리스트에서</h2>
      <div id="home-wishlist-pick" class="home-wishlist-pick"></div>
    </div>
  `;

  const pickEl = container.querySelector('#home-pick');
  wireEntryDelete(pickEl, entries);
  wireEntryEdit(pickEl, (id) => {
    const entry = entries.getEntries().find((e) => e.id === id);
    if (!entry) return;
    openCapture({ editEntry: entry });
  });
  wireContentToggle(pickEl);
  wireLinkToggle(pickEl);

  paint(container);
  unsubEntries = entries.onChange(() => paint(container));
  unsubWishlist = wishlist.onChange(() => paint(container));
  return () => {
    if (unsubEntries) unsubEntries();
    if (unsubWishlist) unsubWishlist();
  };
}

function paint(container) {
  const pickEl = container.querySelector('#home-pick');
  if (pickEl) {
    const list = entries.getEntries();
    const [picked] = stats.pickResurfacedEntries(list, 1);
    if (!picked) {
      pickEl.innerHTML = '<div class="empty-state">아직 기록이 없어요. 첫 기록을 남기면 다음에 여기서 다시 만날 수 있어요.</div>';
    } else {
      const collectionsById = new Map(collections.getItems().map((it) => [it.id, it]));
      pickEl.innerHTML = entryCard(picked, collectionsById);
      applyContentClamp(pickEl);
    }
  }

  const wishlistPickEl = container.querySelector('#home-wishlist-pick');
  if (wishlistPickEl) {
    const wishlistItems = wishlist.getItems();
    const pickedWishlist = wishlistItems.length
      ? wishlistItems[Math.floor(Math.random() * wishlistItems.length)]
      : null;
    wishlistPickEl.innerHTML = pickedWishlist
      ? wishlistPickCardHtml(pickedWishlist)
      : '<div class="empty-state">아직 위시리스트가 비어있어요. 나중에 보고 싶은 걸 담아보세요.</div>';
  }
}

function wishlistPickCardHtml(item) {
  const typeInfo = WISHLIST_TYPE_MAP.get(item.type) || WISHLIST_TYPES[0];
  return `
    <div class="book-card home-wishlist-card">
      <div class="home-wishlist-emoji">${typeInfo.emoji}</div>
      <div class="home-wishlist-title">${escapeHtml(item.title)}</div>
      ${item.artist ? `<div class="home-wishlist-artist">${escapeHtml(item.artist)}</div>` : ''}
    </div>
  `;
}
