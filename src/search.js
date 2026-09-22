// 클라이언트 사이드 전문 검색.
// 어절(띄어쓰기로 나뉜 단어) 단위가 아니라 글자 바이그램(연속된 두 글자) 기준으로
// 인덱싱합니다. 그래야 "제주 여행"에서 "주여"처럼 어절 경계를 넘나드는 짧은
// 부분 문자열로 검색해도 찾을 수 있어요. 필드(본문/출처/저자/태그 등)는 서로
// 다른 필드끼리 바이그램이 섞이지 않도록 각각 따로 처리합니다.
import FlexSearch from './vendor/flexsearch.min.js';

let index = null;
let byId = new Map();

// 하나의 필드 텍스트에서 공백·구두점을 지운 순수 글자 스트림을 만들고, 그
// 전체 문자열과 모든 2글자 바이그램을 토큰으로 냅니다.
function fieldToTokens(text) {
  if (!text) return [];
  const stripped = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
  if (!stripped) return [];
  const tokens = new Set([stripped]);
  for (let i = 0; i < stripped.length - 1; i += 1) {
    tokens.add(stripped.slice(i, i + 2));
  }
  return Array.from(tokens);
}

export function toSearchTokens(text) {
  return fieldToTokens(text).join(' ');
}

function composeSearchable(entry, collectionTitle) {
  const fields = [entry.content, entry.source, entry.author, collectionTitle, ...(entry.tags || [])];
  const tokens = new Set();
  for (const field of fields) {
    for (const t of fieldToTokens(field)) tokens.add(t);
  }
  return Array.from(tokens).join(' ');
}

export function buildIndex(entries, collectionsById = new Map()) {
  index = new FlexSearch.Index({ tokenize: 'strict' });
  byId = new Map();
  for (const entry of entries) {
    const collectionTitle = entry.collectionId && collectionsById.get(entry.collectionId)
      ? collectionsById.get(entry.collectionId).title
      : '';
    index.add(entry.id, composeSearchable(entry, collectionTitle));
    byId.set(entry.id, entry);
  }
}

export function search(query, { limit = 100 } = {}) {
  if (!index) return [];
  const q = toSearchTokens(query);
  if (!q.trim()) return [];
  const ids = index.search(q, { bool: 'or', limit });
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
