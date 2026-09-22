// 공유 보기: 내 실제 기록을 "링크만으로" 다른 사람이 읽기 전용으로 볼 수 있게
// 합니다. 데이터 저장소(padopado-data)는 계속 비공개로 두고, 지금 쓴 기록의
// 스냅샷 JSON만 공개 저장소(앱 코드가 있는, GitHub Pages로 이미 공개된 그
// 저장소)의 잘 추측할 수 없는 경로에 올려둡니다. 그 경로를 아는 사람은
// 로그인 없이 열어볼 수 있으니, 비밀번호가 아니라 "URL을 아는 사람만"이라는
// 점을 항상 유진님께 안내해야 합니다.
import * as gh from './github.js';
import * as entriesMod from './entries.js';
import * as collectionsMod from './collections.js';
import { LS_KEYS, getSetting, setSetting, getPublicRepoConfig } from './config.js';

function shareFilePath(slug) {
  return `data-share/${slug}.json`;
}

function genSlug() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  let s = '';
  for (let i = 0; i < 32; i += 1) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function getShareSlug() {
  return getSetting(LS_KEYS.shareSlug);
}

export function getShareUrl() {
  const slug = getShareSlug();
  const { owner, repo } = getPublicRepoConfig();
  if (!slug || !owner || !repo) return '';
  return `https://${owner}.github.io/${repo}/#/view/${slug}`;
}

function buildSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    entries: entriesMod.getEntries(),
    collections: collectionsMod.getItems(),
  };
}

/**
 * 지금 기록들의 스냅샷을 공개 저장소에 올리고(없으면 새로 만들고, 있으면
 * 최신 내용으로 덮어쓰고) 공유 링크를 돌려줍니다.
 */
export async function publishShare() {
  const slug = getShareSlug() || genSlug();
  const repoOverride = getPublicRepoConfig();
  if (!repoOverride.owner || !repoOverride.repo) {
    throw new Error('공개 저장소 정보가 없어요. GitHub 연결과 공개 저장소 이름을 먼저 확인해주세요.');
  }
  const snapshot = buildSnapshot();
  await gh.putJSONFile(shareFilePath(slug), () => snapshot, '공유 보기 스냅샷 갱신', { repoOverride });
  setSetting(LS_KEYS.shareSlug, slug);
  return getShareUrl();
}

/**
 * 공유를 끕니다: 올려둔 스냅샷 파일을 지우고, 링크를 무효화합니다.
 * (같은 슬러그로 다시 켜더라도 URL이 재사용되지 않도록, 슬러그 자체도 비웁니다.)
 */
export async function revokeShare() {
  const slug = getShareSlug();
  if (!slug) return;
  const repoOverride = getPublicRepoConfig();
  try {
    const { sha, exists } = await gh.getJSONFile(shareFilePath(slug), repoOverride);
    if (exists) {
      await gh.deleteFile(shareFilePath(slug), sha, '공유 보기 링크 해제', repoOverride);
    }
  } finally {
    setSetting(LS_KEYS.shareSlug, '');
  }
}
