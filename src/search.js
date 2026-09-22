// 클라이언트 사이드 전문 검색.
// 어절(띄어쓰기로 나뉜 단어) 단위가 아니라 글자 단위로 인덱싱합니다: 낱글자
// (1글자) 하나와, 연속된 두 글자(바이그램)를 모두 토큰으로 냅니다. 그래야
// - "농"처럼 한 글자만 쳐도 "농구"가 포함된 글을 찾고,
// - "주여"처럼 "제주 여행"에서 어절 경계를 넘나드는 부분 문자열로도 찾고,
// - "핀란드"처럼 3글자 이상인 검색어도 정확히 그 부분 문자열이 있는 글만 찾을 수
//   있어요(검색어를 낱글자+바이그램으로 쪼갠 뒤, 그 조각들이 전부 다 들어있는
//   문서만 찾습니다 — 조각이 전부 이어붙어 있어야 원래 문자열이 존재하므로,
//   사실상 부분 문자열 검색과 거의 같은 효과를 냅니다).
// 필드(본문/출처/저자/태그 등)는 서로 다른 필드끼리 조각이 섞이지 않도록
// 각각 따로 처리합니다.
import FlexSearch from './vendor/flexsearch.min.js';

let index = null;
let byId = new Map();

// 하나의 필드 텍스트에서 공백·구두점을 지운 순수 글자 스트림을 만들고, 낱글자
// 하나하나와 연속된 2글자(바이그램)를 전부 토큰으로 냅니다.
function fieldToTokens(text) {
  if (!text) return [];
  const stripped = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
  if (!stripped) return [];
  const tokens = new Set();
  for (let i = 0; i < stripped.length; i += 1) {
    tokens.add(stripped[i]);
    if (i < stripped.length - 1) tokens.add(stripped.slice(i, i + 2));
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
  // 검색어를 낱글자+바이그램 조각 여러 개로 쪼개서 하나의 문자열로 넘기면,
  // FlexSearch는 기본적으로 그 조각들이 전부 다 들어있는 문서만 찾습니다(AND).
  // 조각이 전부 있으려면 사실상 원래 검색어가 문서 안에 이어붙어 있어야 하므로,
  // 이게 바로 우리가 원하는 부분 문자열 검색 동작이에요.
  const ids = index.search(q, { limit });
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
