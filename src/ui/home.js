// 메인 화면: 헤더 로고를 누르면 오는 첫 화면. 맨 위엔 인사 메시지("오늘도
// 파도가 밀려와요")와 예전에 쓴 기록 중 하나를 무작위로 보여주고, 맨 아래엔
// 같은 배열(이모지 위 + 문구 아래, 같은 글꼴)로 "파도에 올라타 보세요"와
// 위시리스트 중 하나를 무작위로 다시 보여줍니다.
// 탭바에는 나타나지 않는 숨은 화면이라, 로고를 누르는 것이 유일한 진입 경로입니다.
import * as entries from '../entries.js';
import * as collections from '../collections.js';
import * as wishlist from '../wishlist.js';
import * as stats from '../stats.js';
import { WISHLIST_TYPES } from '../config.js';
import { entryCard, wireEntryDelete, wireEntryEdit, wireContentToggle, applyContentClamp, wireLinkToggle, wireCommentToggle, wireCommentActions, escapeHtml } from './shared.js';
import { openCapture } from './capture.js';

const WISHLIST_TYPE_MAP = new Map(WISHLIST_TYPES.map((t) => [t.id, t]));

let unsubEntries = null;
let unsubWishlist = null;
// 홈 화면을 보고 있는 동안 뽑힌 기록 하나를 고정해둡니다. 댓글을 남기는 등
// entries.onChange가 발생할 때마다 다른 기록으로 다시 뽑히면(원래
// pickResurfacedEntries는 호출할 때마다 무작위라서) 방금 단 댓글이 화면에서
// 사라진 것처럼 보이니, 같은 화면에 머무는 동안은 같은 기록을 계속 보여주고
// 그 안의 최신 내용(댓글 등)만 다시 그립니다. 홈에 새로 들어올 때(render())만
// 초기화해서 다시 무작위로 뽑히게 합니다.
let pickedEntryId = null;

export function render(container) {
  container.innerHTML = `
    <div class="view home-view">
      <div class="home-hero">
        <div class="home-wave" aria-hidden="true">🌊</div>
        <p class="home-message">오늘도 파도가 밀려와요</p>
      </div>
      <div id="home-pick" class="home-pick"></div>
      <div class="home-hero">
        <div class="home-wave" aria-hidden="true">🏄</div>
        <p class="home-message">파도에 올라타 보세요</p>
      </div>
      <div id="home-wishlist-pick" class="home-wishlist-pick"></div>
    </div>
  `;

  pickedEntryId = null;

  const pickEl = container.querySelector('#home-pick');
  wireEntryDelete(pickEl, entries);
  wireEntryEdit(pickEl, (id) => {
    const entry = entries.getEntries().find((e) => e.id === id);
    if (!entry) return;
    openCapture({ editEntry: entry });
  });
  wireContentToggle(pickEl);
  wireLinkToggle(pickEl);
  wireCommentToggle(pickEl);
  wireCommentActions(pickEl, entries);

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
    let picked = pickedEntryId ? list.find((e) => e.id === pickedEntryId) : null;
    if (!picked) {
      [picked] = stats.pickResurfacedEntries(list, 1);
      pickedEntryId = picked ? picked.id : null;
    }
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
