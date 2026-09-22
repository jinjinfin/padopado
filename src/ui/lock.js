// 설정 화면 잠금 상태를 이 앱 세션 동안 기억하는 공용 모듈.
// 글쓰기/수정/삭제는 더 이상 잠그지 않고, 설정 화면만 비밀번호로 보호합니다
// (settings.js의 renderLock()이 실제 잠금 화면 UI를 그립니다. 여기서는 그
// "이번 세션에는 이미 풀었다"는 상태만 공유해서, 한 번 풀면 설정 화면을 다시
// 들어가도 또 묻지 않게 합니다).
import { hasSettingsPin } from '../config.js';

let unlockedThisSession = false;

export function isUnlocked() {
  return !hasSettingsPin() || unlockedThisSession;
}

export function markUnlocked() {
  unlockedThisSession = true;
}
