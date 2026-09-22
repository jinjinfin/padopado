// 앱 진입점: 라우팅, 탭바, 플로팅 기록 버튼을 구성합니다.
import * as entries from './entries.js';
import * as collections from './collections.js';
import * as feed from './ui/feed.js';
import * as collectionUi from './ui/collection.js';
import * as retroUi from './ui/retro.js';
import * as dashboardUi from './ui/dashboard.js';
import * as settingsUi from './ui/settings.js';
import { openCapture } from './ui/capture.js';
import { withUnlock } from './ui/lock.js';
import { isConfigured } from './config.js';

const ROUTES = {
  '#/': { render: feed.render, label: '영감', icon: '✨' },
  '#/collection': { render: collectionUi.render, label: '컬렉션', icon: '🗃️' },
  '#/retro': { render: retroUi.render, label: '회고', icon: '🪞' },
  '#/dashboard': { render: dashboardUi.render, label: '대시보드', icon: '📊' },
  '#/settings': { render: settingsUi.render, label: '설정', icon: '⚙️' },
};

let currentCleanup = null;

function currentRoute() {
  return ROUTES[location.hash] ? location.hash : '#/';
}

function renderRoute() {
  const hash = currentRoute();
  const view = document.getElementById('view-root');
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  const cleanup = ROUTES[hash].render(view);
  if (typeof cleanup === 'function') currentCleanup = cleanup;
  renderTabbar(hash);
  updateFabVisibility(hash);
}

// + 버튼(새 기록 작성)은 영감 탭에서만 보이도록 합니다. 다른 탭에서는 각 탭에 맞는
// 자체 진입점(회고 시작 버튼, 컬렉션 안내 등)이 있으므로 전역 + 버튼은 숨깁니다.
function updateFabVisibility(hash) {
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = hash === '#/' ? '' : 'none';
}

function renderTabbar(activeHash) {
  const bar = document.getElementById('tabbar');
  bar.innerHTML = Object.entries(ROUTES)
    .map(
      ([hash, r]) => `
      <a href="${hash}" class="tab ${hash === activeHash ? 'active' : ''}">
        <span class="tab-icon">${r.icon}</span>
        <span class="tab-label">${r.label}</span>
      </a>`
    )
    .join('');
}

function renderShell() {
  document.getElementById('app').innerHTML = `
    <header id="app-header">
      <img class="wordmark wordmark-light" src="./assets/brand/wordmark-light.png" alt="파도파도" />
      <img class="wordmark wordmark-dark" src="./assets/brand/wordmark-dark.png" alt="파도파도" />
      <span id="offline-badge" class="offline-badge" style="display:none">오프라인</span>
    </header>
    <main id="view-root"></main>
    <button type="button" id="fab" aria-label="새 기록">＋</button>
    <nav id="tabbar"></nav>
  `;
  document.getElementById('fab').addEventListener('click', () => withUnlock(() => openCapture({ onSaved: () => {} })));
  window.addEventListener('hashchange', renderRoute);
  updateOfflineBadge();
  window.addEventListener('online', updateOfflineBadge);
  window.addEventListener('offline', updateOfflineBadge);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') autoRefreshFromRemote();
  });
  window.addEventListener('focus', autoRefreshFromRemote);
}

function updateOfflineBadge() {
  const badge = document.getElementById('offline-badge');
  if (badge) badge.style.display = navigator.onLine ? 'none' : 'inline-block';
}

// 다른 기기(예: 모바일)에서 쓴 글을 이 화면에서도 보이게 하려면, 이 앱을 다시
// 볼 때마다("다른 탭/앱에 갔다가 돌아옴") GitHub에서 최신 내용을 받아와야 합니다.
// 그렇지 않으면 앱을 처음 켰을 때 딱 한 번만 받아오고, 그 뒤로는 "설정 > 지금
// 동기화"를 직접 누르기 전까지 다른 기기에서 쓴 글이 계속 안 보이게 됩니다.
let lastAutoRefresh = 0;
const AUTO_REFRESH_MIN_INTERVAL_MS = 15000; // 너무 자주(탭을 빠르게 왔다갔다) 반복 호출하지 않도록

async function autoRefreshFromRemote() {
  if (!isConfigured() || !navigator.onLine) return;
  const now = Date.now();
  if (now - lastAutoRefresh < AUTO_REFRESH_MIN_INTERVAL_MS) return;
  lastAutoRefresh = now;
  try {
    await Promise.all([entries.refreshFromRemote(), collections.refreshFromRemote()]);
  } catch (e) {
    console.warn('화면 복귀 시 원격 동기화 실패(오프라인일 수 있음):', e.message);
  }
}

async function boot() {
  renderShell();
  if (!location.hash) location.hash = '#/';
  if (!isConfigured()) {
    location.hash = '#/settings';
  }
  await Promise.all([entries.init(), collections.init()]);
  renderRoute();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('서비스워커 등록 실패:', e));
  }
}

boot();
