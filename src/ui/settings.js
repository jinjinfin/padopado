// 설정: GitHub 저장소 연결, 알림(웹 푸시) 켜기/끄기, 동기화 상태.
import { LS_KEYS, getSetting, setSetting, isConfigured } from '../config.js';
import * as gh from '../github.js';
import * as entriesMod from '../entries.js';
import * as collectionsMod from '../collections.js';
import * as push from '../push.js';

export function render(container) {
  container.innerHTML = `
    <div class="view settings-view">
      <h1 class="view-title">⚙️ 설정</h1>

      <section class="settings-section">
        <h2 class="section-title">GitHub 연결</h2>
        <p class="hint">개인 저장소를 "서버"처럼 사용합니다. Fine-grained Personal Access Token을 이 저장소의 Contents 읽기/쓰기 권한만으로 발급해서 입력해주세요.</p>
        <input type="text" id="gh-owner" placeholder="GitHub 사용자명 (예: jinryu)" value="${escapeAttr(getSetting(LS_KEYS.owner))}" />
        <input type="text" id="gh-repo" placeholder="저장소 이름 (예: my-jot)" value="${escapeAttr(getSetting(LS_KEYS.repo))}" />
        <input type="text" id="gh-branch" placeholder="브랜치 (기본: main)" value="${escapeAttr(getSetting(LS_KEYS.branch) || 'main')}" />
        <input type="password" id="gh-token" placeholder="Personal Access Token" value="${escapeAttr(getSetting(LS_KEYS.token))}" />
        <div class="btn-row">
          <button type="button" class="btn secondary" id="gh-test">연결 테스트</button>
          <button type="button" class="btn primary" id="gh-save">저장</button>
        </div>
        <div id="gh-status" class="hint"></div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">회고 알림 (웹 푸시)</h2>
        <p class="hint">아이폰은 홈 화면에 앱을 추가(공유 → 홈 화면에 추가)한 뒤에만 푸시 알림을 받을 수 있어요.</p>
        <input type="text" id="vapid-key" placeholder="VAPID 공개키 (README 안내 참고)" value="${escapeAttr(getSetting(LS_KEYS.vapidPublicKey))}" />
        <div class="btn-row">
          <button type="button" class="btn secondary" id="vapid-save">공개키 저장</button>
          <button type="button" class="btn primary" id="push-enable">알림 켜기</button>
          <button type="button" class="btn secondary" id="push-disable">알림 끄기</button>
        </div>
        <div id="push-status" class="hint"></div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">동기화</h2>
        <div id="sync-status" class="hint"></div>
        <button type="button" class="btn secondary" id="sync-now">지금 동기화</button>
      </section>
    </div>
  `;

  wireGithub(container);
  wirePush(container);
  wireSync(container);
}

function wireGithub(container) {
  const $ = (s) => container.querySelector(s);
  $('#gh-save').addEventListener('click', () => {
    setSetting(LS_KEYS.owner, $('#gh-owner').value.trim());
    setSetting(LS_KEYS.repo, $('#gh-repo').value.trim());
    setSetting(LS_KEYS.branch, $('#gh-branch').value.trim() || 'main');
    setSetting(LS_KEYS.token, $('#gh-token').value.trim());
    $('#gh-status').textContent = '저장했어요. 아래 "연결 테스트"로 확인해보세요.';
    if (isConfigured()) {
      entriesMod.init();
      collectionsMod.init();
    }
  });
  $('#gh-test').addEventListener('click', async () => {
    $('#gh-status').textContent = '확인 중...';
    try {
      const repo = await gh.testConnection();
      $('#gh-status').textContent = `연결 성공! (${repo.full_name}, private: ${repo.private})`;
    } catch (e) {
      $('#gh-status').textContent = `연결 실패: ${e.message}`;
    }
  });
}

function wirePush(container) {
  const $ = (s) => container.querySelector(s);
  $('#vapid-save').addEventListener('click', () => {
    setSetting(LS_KEYS.vapidPublicKey, $('#vapid-key').value.trim());
    $('#push-status').textContent = '공개키를 저장했어요.';
  });
  $('#push-enable').addEventListener('click', async () => {
    $('#push-status').textContent = '알림 등록 중...';
    try {
      await push.enablePush();
      $('#push-status').textContent = '알림이 켜졌어요! 🔔';
    } catch (e) {
      $('#push-status').textContent = `실패: ${e.message}`;
    }
  });
  $('#push-disable').addEventListener('click', async () => {
    try {
      await push.disablePush();
      $('#push-status').textContent = '알림을 껐어요.';
    } catch (e) {
      $('#push-status').textContent = `실패: ${e.message}`;
    }
  });
}

function wireSync(container) {
  const paint = () => {
    const el = container.querySelector('#sync-status');
    if (!el) return;
    const pending = entriesMod.pendingCount();
    el.textContent = pending > 0 ? `${pending}개 항목이 동기화를 기다리고 있어요.` : '모든 기록이 GitHub과 동기화되어 있어요.';
  };
  paint();
  entriesMod.onChange(paint);
  container.querySelector('#sync-now').addEventListener('click', async () => {
    const el = container.querySelector('#sync-status');
    el.textContent = '동기화 중...';
    try {
      await entriesMod.syncPending();
      await entriesMod.refreshFromRemote();
      paint();
    } catch (e) {
      el.textContent = `동기화 실패: ${e.message}`;
    }
  });
}

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
