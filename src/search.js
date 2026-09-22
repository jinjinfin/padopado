// 클라이언트 사이드 전문 검색. 한글은 토크나이저가 단어 단위로 잘 안 갈라지므로
// 글자 바이그램(bigram)을 함께 색인해 짧은 한글 키워드도 검색되게 합니다.
import FlexSearch from './vendor/flexsearch.min.js';

let index = null;
let byId = new Map();

const HANGUL_OR_CJK = /[ㄱ-ㆎ가-힣一-鿿]/;

export function toSearchTokens(text) {
  if (!text) return '';
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const tokens = new Set();
  for (const w of words) {
    tokens.add(w);
    if (HANGUL_OR_CJK.test(w) && w.length > 1) {
      for (let i = 0; i < w.length - 1; i += 1) {
        tokens.add(w.slice(i, i + 2));
      }
    }
  }
  return Array.from(tokens).join(' ');
}

function composeSearchable(entry, collectionTitle) {
  return [entry.content, entry.source, entry.author, collectionTitle, (entry.tags || []).join(' ')]
    .filter(Boolean)
    .join(' \n ');
}

export function buildIndex(entries, collectionsById = new Map()) {
  index = new FlexSearch.Index({ tokenize: 'strict' });
  byId = new Map();
  for (const entry of entries) {
    const collectionTitle = entry.collectionId && collectionsById.get(entry.collectionId)
      ? collectionsById.get(entry.collectionId).title
      : '';
    const composed = composeSearchable(entry, collectionTitle);
    index.add(entry.id, toSearchTokens(composed));
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
