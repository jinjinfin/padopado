// 앱 잠금: 설정 화면 잠금과 완전히 같은 비밀번호를 "기록 쓰기/수정/삭제"에도
// 적용합니다. 같은 기기를 다른 사람과 같이 쓰는 경우, 그 사람이 실수로(혹은
// 장난으로) 기록을 쓰거나 고치거나 지우는 것까지 막기 위함입니다.
// 비밀번호를 한 번 맞히면 이 앱을 새로 열기(새로고침) 전까지는 설정 화면과
// 글쓰기/수정/삭제 모두 다시 묻지 않습니다 — 매번 입력해야 하면 정작
// 본인이 쓰기 불편해지므로, "세션당 한 번"으로 균형을 맞췄습니다.
import { hasSettingsPin, verifySettingsPin } from '../config.js';

let unlockedThisSession = false;
let modalEl = null;

export function isUnlocked() {
  return !hasSettingsPin() || unlockedThisSession;
}

export function markUnlocked() {
  unlockedThisSession = true;
}

/**
 * 잠겨 있으면(비밀번호가 설정되어 있고 아직 이 세션에서 풀지 않았다면) 비밀번호
 * 입력 모달을 띄우고, 맞으면 action()을 실행합니다. 이미 풀려 있으면 곧바로
 * action()을 실행합니다. 취소하거나 닫으면 action()은 실행되지 않습니다.
 * @param {Function} action
 */
export function withUnlock(action) {
  if (isUnlocked()) {
    action();
    return;
  }
  showLockModal(action);
}

function closeModal() {
  if (modalEl) {
    modalEl.classList.remove('open');
    modalEl.innerHTML = '';
  }
}

function showLockModal(action) {
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'app-lock-modal';
    modalEl.className = 'modal-backdrop';
    document.body.appendChild(modalEl);
  }
  modalEl.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-label="잠금 해제">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>🔒 잠겨 있어요</h2>
        <button type="button" class="icon-btn" id="lock-close" aria-label="닫기">✕</button>
      </div>
      <p class="hint">비밀번호를 입력하면 계속할 수 있어요.</p>
      <input type="password" id="lock-pin-input" placeholder="비밀번호" autocomplete="off" />
      <div id="lock-status" class="hint"></div>
      <button type="button" class="btn primary" id="lock-unlock">확인</button>
    </div>
  `;
  modalEl.classList.add('open');

  const $ = (s) => modalEl.querySelector(s);
  const input = $('#lock-pin-input');
  input.focus();

  const tryUnlock = async () => {
    const pin = input.value;
    if (!pin) return;
    const ok = await verifySettingsPin(pin);
    if (ok) {
      markUnlocked();
      closeModal();
      action();
    } else {
      $('#lock-status').textContent = '비밀번호가 맞지 않아요.';
      input.value = '';
      input.focus();
    }
  };
  $('#lock-unlock').addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });
  $('#lock-close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });
}
