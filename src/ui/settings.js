// 설정: GitHub 저장소 연결, 알림(웹 푸시) 켜기/끄기, 동기화 상태, 화면 잠금.
import {
  LS_KEYS,
  getSetting,
  setSetting,
  isConfigured,
  hasSettingsPin,
  setSettingsPin,
  clearSettingsPin,
  verifySettingsPin,
} from '../config.js';
import * as gh from '../github.js';
import * as entriesMod from '../entries.js';
import * as collectionsMod from '../collections.js';
import * as push from '../push.js';
import { isUnlocked, markUnlocked } from './lock.js';

// 잠금 해제 상태는 lock.js가 앱 전체(설정 화면 + 글쓰기/수정/삭제)에서
// 공통으로 관리합니다. 여기서 한 번 풀면 다른 곳에서도 다시 묻지 않고,
// 반대로 글쓰기 쪽에서 먼저 풀었다면 설정 화면도 곧바로 열립니다.
export function render(container) {
  if (!isUnlocked()) {
    renderLock(container);
    return;
  }
  renderSettings(container);
}

function renderLock(container) {
  container.innerHTML = `
    <div class="view settings-view settings-lock-view">
      <h1 class="view-title">⚙️ 설정</h1>
      <p class="hint">이 화면은 비밀번호로 잠겨 있어요.</p>
      <input type="password" id="settings-pin-input" placeholder="비밀번호" autocomplete="off" />
      <div class="btn-row">
        <button type="button" class="btn primary" id="settings-unlock">잠금 해제</button>
      </div>
      <div id="settings-lock-status" class="hint"></div>
    </div>
  `;
  const $ = (s) => container.querySelector(s);
  const tryUnlock = async () => {
    const pin = $('#settings-pin-input').value;
    if (!pin) return;
    const ok = await verifySettingsPin(pin);
    if (ok) {
      markUnlocked();
      renderSettings(container);
    } else {
      $('#settings-lock-status').textContent = '비밀번호가 맞지 않아요.';
      $('#settings-pin-input').value = '';
      $('#settings-pin-input').focus();
    }
  };
  $('#settings-unlock').addEventListener('click', tryUnlock);
  $('#settings-pin-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });
}

function renderSettings(container) {
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

      <section class="settings-section">
        <h2 class="section-title">🔒 설정 화면 잠금</h2>
        <p class="hint">${hasSettingsPin()
          ? '비밀번호가 설정되어 있어요. 이 기기를 다른 사람과 같이 쓰더라도, 이 설정 화면은 비밀번호를 입력해야 볼 수 있어요.'
          : '이 기기를 다른 사람과 같이 쓴다면, 비밀번호를 설정해서 설정 화면을 보호할 수 있어요. (완벽한 보안은 아니고, 같이 쓰는 사람이 실수로 건드리는 걸 막는 정도예요.)'}</p>
        <input type="password" id="settings-pin-new" placeholder="${hasSettingsPin() ? '새 비밀번호로 변경' : '설정할 비밀번호'}" autocomplete="off" />
        <div class="btn-row">
          <button type="button" class="btn primary" id="settings-pin-save">${hasSettingsPin() ? '비밀번호 변경' : '비밀번호 설정'}</button>
          ${hasSettingsPin() ? '<button type="button" class="btn secondary" id="settings-pin-clear">잠금 끄기</button>' : ''}
        </div>
        <div id="settings-pin-status" class="hint"></div>
      </section>
    </div>
  `;

  wireGithub(container);
  wirePush(container);
  wireSync(container);
  wireLockSettings(container);
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

function wireLockSettings(container) {
  const $ = (s) => container.querySelector(s);
  $('#settings-pin-save').addEventListener('click', async () => {
    const pin = $('#settings-pin-new').value;
    if (!pin || pin.length < 4) {
      $('#settings-pin-status').textContent = '비밀번호는 4자리 이상으로 설정해주세요.';
      return;
    }
    await setSettingsPin(pin);
    markUnlocked(); // 방금 내가 설정했으니 바로 다시 잠글 필요는 없음
    renderSettings(container);
  });
  const clearBtn = $('#settings-pin-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!window.confirm('설정 화면 잠금을 끌까요?')) return;
      clearSettingsPin();
      renderSettings(container);
    });
  }
}

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
