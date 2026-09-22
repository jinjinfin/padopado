// GitHub REST API(Contents API)를 "서버" 대신 사용하는 얇은 클라이언트.
// 별도 백엔드 없이, 브라우저에서 개인 액세스 토�큰(PAT)으로 직접 저장소 파일을 읽고 씁니다.
import { getRepoConfig } from './config.js';

const API_BASE = 'https://api.github.com';

class GitHubError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function apiRequest(path, options = {}) {
  const { token } = getRepoConfig();
  if (!token) throw new GitHubError('GitHub 토큰이 설정되지 않았습니다. 설정 화면에서 먼저 연결해주세요.', 0);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  return res;
}

/**
 * 저장소의 파일 하나를 읽습니다.
 * 반환값: { data: <파싱된 JSON, 없으면 null>, sha: <있으면 문자열, 없으면 null>, exists: bool }
 */
export async function getJSONFile(path) {
  const { owner, repo, branch } = getRepoConfig();
  const res = await apiRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) {
    return { data: null, sha: null, exists: false };
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub에서 ${path} 읽기 실패 (${res.status})`, res.status, await safeText(res));
  }
  const json = await res.json();
  const text = base64ToUtf8(json.content);
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new GitHubError(`${path} 파일의 JSON 형식이 올바르지 않습니다.`, 0);
  }
  return { data, sha: json.sha, exists: true };
}

/**
 * 저장소 안 디렉터리 목록을 가져옵니다. (없으면 빈 배열)
 */
export async function listDir(path) {
  const { owner, repo, branch } = getRepoConfig();
  const res = await apiRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new GitHubError(`GitHub 디렉터리 조회 실패: ${path} (${res.status})`, res.status, await safeText(res));
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

/**
 * 파일을 생성하거나 갱신합니다. sha 충돌(409/422) 시 최신 내용을 다시 읽어
 * updater 콜백으로 병합한 뒤 재시도합니다. (동시 기기 사용 시 데이터 유실 방지)
 */
export async function putJSONFile(path, updater, message, { maxRetries = 3 } = {}) {
  const { owner, repo, branch } = getRepoConfig();
  let attempt = 0;
  let current = await getJSONFile(path);

  while (attempt <= maxRetries) {
    const nextData = await updater(current.data, current);
    const body = {
      message,
      content: utf8ToBase64(JSON.stringify(nextData, null, 2)),
      branch,
      ...(current.sha ? { sha: current.sha } : {}),
    };
    const res = await apiRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      return { data: nextData, sha: json.content.sha };
    }
    if (res.status === 409 || res.status === 422) {
      // 다른 기기가 먼저 저장한 경우: 최신본을 다시 받아서 재병합
      attempt += 1;
      current = await getJSONFile(path);
      continue;
    }
    throw new GitHubError(`GitHub 저장 실패: ${path} (${res.status})`, res.status, await safeText(res));
  }
  throw new GitHubError(`GitHub 저장 충돌을 해결하지 못했습니다: ${path}`, 409);
}

export async function testConnection() {
  const { owner, repo } = getRepoConfig();
  const res = await apiRequest(`/repos/${owner}/${repo}`);
  if (!res.ok) {
    throw new GitHubError(`저장소에 연결할 수 없습니다 (${res.status}). owner/repo/토큰 권한을 확인하세요.`, res.status, await safeText(res));
  }
  return res.json();
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

export { GitHubError };
