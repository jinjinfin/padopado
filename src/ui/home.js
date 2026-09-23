// 메인 화면: 헤더 로고를 누르면 오는 첫 화면. 맨 위엔 인사 메시지("오늘도
// 파도가 밀려와요")와 예전에 쓴 기록 중 하나를 무작위로 보여주고, 그 아래엔
// 같은 배열(이모지 위 + 문구 아래, 같은 글꼴)로 "파도에 올라타 보세요"와
// 위시리스트 중 하나를, 맨 아래엔 다시 같은 배열로 "파도 파도 끝이 없어요"와
// 아직 완독/완청 표시하지 않은 컬렉션 항목 중 하나를 무작위로 보여줍니다.
// 탭바에는 나타나지 않는 숨은 화면이라, 로고를 누르는 것이 유일한 진입 경로입니다.
import * as entries from '../entries.js';
import * as collections from '../collections.js';
import * as wishlist from '../wishlist.js';
import * as stats from '../stats.js';
import { WISHLIST_TYPES, COLLECTION_KINDS } from '../config.js';
import { entryCard, wireEntryDelete, wireEntryEdit, wireContentToggle, applyContentClamp, wireLinkToggle, wireCommentToggle, wireCommentActions, escapeHtml } from './shared.js';
import { openCapture } from './capture.js';

const WISHLIST_TYPE_MAP = new Map(WISHLIST_TYPES.map((t) => [t.id, t]));

let unsubEntries = null;
let unsubWishlist = null;
let unsubCollections = null;
// 홈 화면을 보고 있는 동안 각 섹션에서 뽑힌 항목을 고정해둡니다. 세 섹션 모두
// entries/wishlist/collections 중 아무 하나라도 바뀌면 다시 paint()가 통째로
// 불리는데, 그때마다 매번 새로 무작위로 뽑으면(예: 기록에 댓글만 하나 달아도)
// 상관없는 다른 섹션까지 다른 항목으로 튀어버립니다. 그래서 같은 화면에
// 머무는 동안은 각자 고른 항목을 계속 보여주고, 그 항목이 더 이상 조건에 맞지
// 않게 되면(삭제됨, 완독 표시됨 등) 그때만 다시 무작위로 뽑습니다. 홈에 새로
// 들어올 때(render())만 셋 다 초기화해서 다시 뽑히게 합니다.
let pickedEntryId = null;
let pickedWishlistId = null;
let pickedCollectionId = null;

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
      <div class="home-hero">
        <div class="home-wave" aria-hidden="true">🪏</div>
        <p class="home-message">파도 파도 끝이 없어요</p>
      </div>
      <div id="home-collection-pick" class="home-collection-pick"></div>
    </div>
  `;

  pickedEntryId = null;
  pickedWishlistId = null;
  pickedCollectionId = null;

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
  unsubCollections = collections.onChange(() => paint(container));
  return () => {
    if (unsubEntries) unsubEntries();
    if (unsubWishlist) unsubWishlist();
    if (unsubCollections) unsubCollections();
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
    let pickedWishlist = pickedWishlistId ? wishlistItems.find((it) => it.id === pickedWishlistId) : null;
    if (!pickedWishlist) {
      pickedWishlist = wishlistItems.length ? wishlistItems[Math.floor(Math.random() * wishlistItems.length)] : null;
      pickedWishlistId = pickedWishlist ? pickedWishlist.id : null;
    }
    wishlistPickEl.innerHTML = pickedWishlist
      ? wishlistPickCardHtml(pickedWishlist)
      : '<div class="empty-state">아직 위시리스트가 비어있어요. 나중에 보고 싶은 걸 담아보세요.</div>';
  }

  const collectionPickEl = container.querySelector('#home-collection-pick');
  if (collectionPickEl) {
    const unfinished = collections.getItems().filter((it) => !it.finished);
    let pickedCollection = pickedCollectionId ? unfinished.find((it) => it.id === pickedCollectionId) : null;
    if (!pickedCollection) {
      pickedCollection = unfinished.length ? unfinished[Math.floor(Math.random() * unfinished.length)] : null;
      pickedCollectionId = pickedCollection ? pickedCollection.id : null;
    }
    collectionPickEl.innerHTML = pickedCollection
      ? collectionPickCardHtml(pickedCollection)
      : '<div class="empty-state">아직 완독·완청 전인 컬렉션이 없어요. 책·영상·음악을 기록하면 자동으로 쌓여요.</div>';
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

function collectionPickCardHtml(item) {
  const kindInfo = COLLECTION_KINDS[item.kind] || COLLECTION_KINDS.book;
  return `
    <div class="book-card home-collection-card">
      <div class="home-collection-emoji">${kindInfo.icon}</div>
      <div class="home-collection-title">${escapeHtml(item.title)}</div>
      ${item.author ? `<div class="home-collection-author">${escapeHtml(item.author)}</div>` : ''}
    </div>
  `;
}
