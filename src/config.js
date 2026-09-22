// 앱 전역 설정. GitHub 저장소 접속 정보와 로컬 저장 키를 관리합니다.
// 이 파일은 민감한 값을 담지 않습니다 (토큰은 localStorage에만 저장됨).

export const LS_KEYS = {
  owner: 'jot.gh.owner',
  repo: 'jot.gh.repo',
  branch: 'jot.gh.branch',
  token: 'jot.gh.token',
  vapidPublicKey: 'jot.push.vapidPublicKey',
  lastSyncedYears: 'jot.sync.years',
};

// '회고'는 여기 없습니다 — 일반 작성 모달의 유형 선택지가 아니라, 회고 탭에서만
// 시작하는 전용 흐름(기간별 질문 템플릿 + 그 기간 기록을 재료로 보여주기)이기 때문입니다.
export const ENTRY_TYPES = [
  { id: 'quote', label: '글귀', emoji: '📖', hint: '책·아티클에서 인상 깊었던 문장' },
  { id: 'insight', label: '인사이트', emoji: '💡', hint: '강연·회의에서 배운 것' },
  { id: 'link', label: '링크', emoji: '🔗', hint: '웹페이지 링크와 간단한 설명' },
  { id: 'thought', label: '생각', emoji: '✍️', hint: '지금 떠오른 내 생각' },
  { id: 'media', label: '영상/작품', emoji: '🎬', hint: '영화·드라마·유튜브' },
];

export const RETRO_PERIODS = [
  { id: 'week', label: '주간 회고' },
  { id: 'month', label: '월간 회고' },
  { id: 'quarter', label: '분기 회고' },
  { id: 'year', label: '연간 회고' },
];

// 컬렉션: 책, 영화/드라마/영상 등 "작품 단위"로 쌓이는 아카이브.
// 어떤 기록 유형이 컬렉션과 연결되는지, 그리고 각 종류를 어떻게 표시할지 정의합니다.
export const TYPE_TO_COLLECTION_KIND = {
  quote: 'book',
  media: 'media',
};

export const COLLECTION_KINDS = {
  book: { label: '책', icon: '📖', doneIcon: '✅', doneLabel: '완독으로 표시', titlePlaceholder: '책 제목을 입력하면 자동으로 컬렉션에 쌓여요' },
  media: { label: '작품', icon: '🎬', doneIcon: '✅', doneLabel: '다 봤어요로 표시', titlePlaceholder: '영화·드라마 제목을 입력하면 자동으로 컬렉션에 쌓여요' },
};

export const DATA_PATHS = {
  entriesDir: 'data/entries',
  entryYearFile: (year) => `data/entries/${year}.json`,
  collections: 'data/collections.json',
  pushSubs: 'data/meta/push-subscriptions.json',
  stats: 'data/meta/stats-cache.json',
};

export function getSetting(key) {
  return localStorage.getItem(key) || '';
}

export function setSetting(key, value) {
  if (value === null || value === undefined || value === '') {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, value);
  }
}

export function isConfigured() {
  return Boolean(getSetting(LS_KEYS.owner) && getSetting(LS_KEYS.repo) && getSetting(LS_KEYS.token));
}

export function getRepoConfig() {
  return {
    owner: getSetting(LS_KEYS.owner),
    repo: getSetting(LS_KEYS.repo),
    branch: getSetting(LS_KEYS.branch) || 'main',
    token: getSetting(LS_KEYS.token),
  };
}
