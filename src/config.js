// 앱 전역 설정. GitHub 저장소 접속 정보와 로컬 저장 키를 관리합니다.
// 이 파일은 민감한 값을 담지 않습니다 (토큰은 localStorage에만 저장됨).

export const LS_KEYS = {
  owner: 'jot.gh.owner',
  repo: 'jot.gh.repo',
  branch: 'jot.gh.branch',
  token: 'jot.gh.token',
  vapidPublicKey: 'jot.push.vapidPublicKey',
  lastSyncedYears: 'jot.sync.years',
  settingsPinHash: 'jot.settings.pinHash',
  canWrite: 'jot.gh.canWrite',
  publicRepo: 'jot.share.publicRepo',
  shareSlug: 'jot.share.slug',
};

// '회고'는 여기 없습니다 — 일반 작성 모달의 유형 선택지가 아니라, 회고 탭에서만
// 시작하는 전용 흐름(기간별 질문 템플릿 + 그 기간 기록을 재료로 보여주기)이기 때문입니다.
export const ENTRY_TYPES = [
  { id: 'quote', label: '책/글', emoji: '📖', hint: '책·아티클에서 인상 깊었던 문장' },
  { id: 'insight', label: '인사이트', emoji: '💡', hint: '강연·회의에서 배운 것' },
  { id: 'link', label: '링크', emoji: '🔗', hint: '웹페이지 링크와 간단한 설명' },
  { id: 'thought', label: '생각', emoji: '✍️', hint: '지금 떠오른 내 생각' },
  { id: 'media', label: '영화/드라마', emoji: '🎬', hint: '영화·드라마·유튜브' },
  { id: 'word', label: '단어', emoji: '🔤', hint: '새로 알게 된 단어와 뜻' },
  { id: 'music', label: '음악', emoji: '🎵', hint: '요즘 듣는 노래·앨범' },
  { id: 'exhibition', label: '전시', emoji: '🖼️', hint: '전시·미술관에서 본 것' },
  { id: 'performance', label: '공연', emoji: '🎭', hint: '공연·연극·콘서트' },
  { id: 'copy', label: '카피', emoji: '📢', hint: '광고·제목 등에 쓰인 인상적인 카피' },
];

// 위시리스트: "아직 안 본/안 읽은/안 들은" 것들을 미리 담아두는 목록.
// 컬렉션과 달리 실제 기록(글)과는 연결되지 않고, 제목과 (선택) 아티스트만
// 가진 독립적인 항목입니다. 장소는 아티스트 칸에 건축가·디자이너를 적어도 됩니다.
export const WISHLIST_TYPES = [
  { id: 'book', label: '책', emoji: '📖', doneLabel: '다 읽었어요' },
  { id: 'movie', label: '영화', emoji: '🎬', doneLabel: '다 봤어요' },
  { id: 'drama', label: '드라마', emoji: '📺', doneLabel: '다 봤어요' },
  { id: 'video', label: '영상', emoji: '🎥', doneLabel: '다 봤어요' },
  { id: 'music', label: '음악', emoji: '🎵', doneLabel: '다 들었어요' },
  { id: 'writing', label: '글', emoji: '✍️', doneLabel: '다 읽었어요' },
  { id: 'place', label: '장소', emoji: '📍', doneLabel: '다녀왔어요' },
  { id: 'exhibition', label: '전시', emoji: '🖼️', doneLabel: '다녀왔어요' },
  { id: 'performance', label: '공연', emoji: '🎭', doneLabel: '다녀왔어요' },
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
  music: 'music',
};

export const COLLECTION_KINDS = {
  book: { label: '책', icon: '📖', doneIcon: '✅', doneLabel: '완독으로 표시', titlePlaceholder: '책 제목을 입력하면 자동으로 컬렉션에 쌓여요' },
  media: { label: '작품', icon: '🎬', doneIcon: '✅', doneLabel: '다 봤어요로 표시', titlePlaceholder: '영화·드라마 제목을 입력하면 자동으로 컬렉션에 쌓여요' },
  music: { label: '음악', icon: '🎵', doneIcon: '✅', doneLabel: '다 들었어요로 표시', titlePlaceholder: '앨범·곡 제목을 입력하면 자동으로 컬렉션에 쌓여요' },
};

export const DATA_PATHS = {
  entriesDir: 'data/entries',
  entryYearFile: (year) => `data/entries/${year}.json`,
  collections: 'data/collections.json',
  wishlist: 'data/wishlist.json',
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

// 설정 화면 잠금: 같은 기기를 다른 사람도 쓸 수 있는 경우(가족 공용 컴퓨터,
// 잠깐 빌려준 폰 등)를 위해, 설정 화면을 열 때 비밀번호를 요구할 수 있게 합니다.
// 서버가 없는 앱이라 완벽한 보안은 아니고(기기 자체를 마음대로 조작할 수 있는
// 사람은 우회할 수 있음), "같이 쓰는 사람이 실수로/무심코 GitHub 연결이나
// 알림 설정을 건드리는 것"을 막는 정도의 가벼운 잠금입니다. 그래서 비밀번호를
// 그대로 저장하지 않고 SHA-256 해시만 저장합니다.
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasSettingsPin() {
  return Boolean(getSetting(LS_KEYS.settingsPinHash));
}

export async function setSettingsPin(pin) {
  setSetting(LS_KEYS.settingsPinHash, await sha256Hex(pin));
}

export function clearSettingsPin() {
  setSetting(LS_KEYS.settingsPinHash, '');
}

export async function verifySettingsPin(pin) {
  const stored = getSetting(LS_KEYS.settingsPinHash);
  if (!stored) return true; // 아직 비밀번호를 설정한 적 없으면 잠겨있지 않은 상태
  return (await sha256Hex(pin)) === stored;
}

// 읽기 전용 모드: 내 기록을 다른 사람이 자기 기기에서 "보기 전용"으로 볼 수
// 있게, 쓰기 권한이 없는(Contents: Read-only) GitHub 토큰을 나눠줄 수 있습니다.
// 그 토큰으로 연결하면 이 값이 false가 되고, 글쓰기/수정/삭제 버튼들이
// 화면에서 아예 숨겨집니다(어차피 GitHub이 저장을 거부하겠지만, 시도했다가
// 실패하는 것보다 처음부터 안 보이는 게 더 매끄러운 경험이라서요).
// 실제 쓰기 가능 여부 확인은 github.js가 GitHub API로 하고, 그 결과만 여기
// 저장해둡니다. 한 번도 확인한 적 없으면(과거 버전 등) 기본값은 "쓰기 가능"으로
// 간주해서, 기존 사용자의 화면이 갑자기 바뀌지 않도록 합니다.
export function canWrite() {
  return getSetting(LS_KEYS.canWrite) !== 'false';
}

export function setCanWrite(value) {
  setSetting(LS_KEYS.canWrite, value ? '' : 'false');
}

// 링크 공유 보기: "토큰 없이 링크만으로" 다른 사람이 내 기록을 읽기 전용으로
// 볼 수 있게, 지금 쓰고 있는 (쓰기 가능한) 토큰으로 공개 저장소(코드가 올라가
// 있는, 이미 GitHub Pages로 공개된 그 저장소)에 스냅샷 JSON을 올려두고, 그
// 파일 경로를 URL로 나눠줍니다. 데이터 저장소(padopado-data)는 여전히
// 비공개로 유지하면서, 공유하기로 한 스냅샷만 공개 저장소를 통해 노출되는
// 구조입니다 — 링크 자체가 추측하기 어려운 문자열이라는 점으로 보호되는
// 것이지, 비밀번호로 보호되는 건 아니라는 점을 설정 화면에서도 안내합니다.
export function getPublicRepoConfig() {
  return {
    owner: getSetting(LS_KEYS.owner), // 데이터 저장소와 같은 GitHub 계정이라고 가정
    repo: getSetting(LS_KEYS.publicRepo) || 'padopado',
    branch: 'main',
    token: getSetting(LS_KEYS.token),
  };
}
