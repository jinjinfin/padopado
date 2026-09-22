// 앱 진입점: 라우팅, 탭바, 플로팅 기록 버튼을 구성합니다.
import * as entries from './entries.js';
import * as collections from './collections.js';
import * as gh from './github.js';
import * as feed from './ui/feed.js';
import * as collectionUi from './ui/collection.js';
import * as retroUi from './ui/retro.js';
import * as dashboardUi from './ui/dashboard.js';
import * as settingsUi from './ui/settings.js';
import * as homeUi from './ui/home.js';
import { openCapture } from './ui/capture.js';
import { renderViewer } from './ui/viewer.js';
import { isConfigured, canWrite, setCanWrite } from './config.js';

// 메인 화면(#/home)은 앱을 열었을 때 가장 먼저 보이는 랜딩 페이지입니다.
// 탭바의 5개 탭과는 별개라 hidden: true로 표시해 탭바에는 안 그려지고,
// 헤더 로고를 눌러서 언제든 다시 돌아올 수 있습니다.
const ROUTES = {
  '#/home': { render: homeUi.render, hidden: true },
  '#/': { render: feed.render, label: '영감', icon: '✨' },
  '#/collection': { render: collectionUi.render, label: '컬렉션', icon: '🗃️' },
  '#/retro': { render: retroUi.render, label: '회고', icon: '🪞' },
  '#/dashboard': { render: dashboardUi.render, label: '대시보드', icon: '📊' },
  '#/settings': { render: settingsUi.render, label: '설정', icon: '⚙️' },
};

let currentCleanup = null;

function currentRoute() {
  return ROUTES[location.hash] ? location.hash : '#/home';
}

// 공유 보기 링크(#/view/<슬러그>)는 일반 앱 화면(탭바/+ 버튼/설정)이 전혀
// 필요 없는, 완전히 별도의 읽기 전용 화면입니다. GitHub 연결이 안 되어 있는
// 기기(링크만 받은 다른 사람)에서 열리는 게 정상이므로, isConfigured() 체크나
// entries/collections 초기화보다 먼저 걸러냅니다.
function viewerSlugFromHash(hash) {
  const m = /^#\/view\/([A-Za-z0-9_-]+)$/.exec(hash || '');
  return m ? m[1] : null;
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
// 읽기 전용 토큰으로 연결된 경우(다른 사람에게 "보기 전용"으로 내 기록을
// 보여줄 때)는 애초에 쓸 수 없으므로 어떤 탭에서도 보이지 않습니다.
function updateFabVisibility(hash) {
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = (hash === '#/' && canWrite()) ? '' : 'none';
}

function renderTabbar(activeHash) {
  const bar = document.getElementById('tabbar');
  bar.innerHTML = Object.entries(ROUTES)
    .filter(([, r]) => !r.hidden)
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
      <button type="button" id="logo-btn" aria-label="메인 화면으로">
        <img class="wordmark wordmark-light" src="./assets/brand/wordmark-light.png" alt="파도파도" />
        <img class="wordmark wordmark-dark" src="./assets/brand/wordmark-dark.png" alt="파도파도" />
      </button>
      <span id="offline-badge" class="offline-badge" style="display:none">오프라인</span>
    </header>
    <main id="view-root"></main>
    <button type="button" id="fab" aria-label="새 기록">＋</button>
    <nav id="tabbar"></nav>
  `;
  document.getElementById('fab').addEventListener('click', () => openCapture({ onSaved: () => {} }));
  document.getElementById('logo-btn').addEventListener('click', () => { location.hash = '#/home'; });
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

// 지금 연결된 토큰이 "쓰기" 권한이 있는지 GitHub에 확인합니다. 다른 사람에게
// 읽기 전용 토큰을 나눠준 경우를 감지해서, 그 사람 화면에서는 글쓰기/수정/
// 삭제 버튼이 아예 안 보이게 하기 위함입니다. 확인이 실패해도(오프라인 등)
// 이전에 저장해둔 값을 그대로 쓰므로 앱이 멈추지 않습니다.
async function refreshWriteAccess() {
  if (!isConfigured() || !navigator.onLine) return;
  try {
    setCanWrite(await gh.checkWriteAccess());
  } catch (e) {
    console.warn('쓰기 권한 확인 실패(오프라인일 수 있음):', e.message);
  }
}

async function boot() {
  const initialSlug = viewerSlugFromHash(location.hash);
  if (initialSlug) {
    document.getElementById('app').innerHTML = '<main id="view-root"></main>';
    await renderViewer(document.getElementById('view-root'), initialSlug);
    window.addEventListener('hashchange', () => {
      const slug = viewerSlugFromHash(location.hash);
      if (slug) {
        renderViewer(document.getElementById('view-root'), slug);
      } else {
        // 공유 링크에서 벗어나 일반 앱 경로로 이동하면, 그때부터는 앱 셸/설정/
        // 동기화가 모두 필요하므로 깔끔하게 다시 시작합니다.
        location.reload();
      }
    });
    return;
  }

  renderShell();
  if (!location.hash) location.hash = '#/home';
  if (!isConfigured()) {
    location.hash = '#/settings';
  }
  await Promise.all([entries.init(), collections.init()]);
  await refreshWriteAccess();
  renderRoute();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('서비스워커 등록 실패:', e));
  }
}

boot();
