// 웹 푸시 구독 관리. 실제 발송은 GitHub Actions 크론(scripts/send-reminders.mjs)이 담당하고,
// 여기서는 "이 기기가 알림을 받겠다"는 구독 정보를 저장소에 등록/해제만 합니다.
import * as gh from './github.js';
import { DATA_PATHS, getSetting, LS_KEYS, isConfigured } from './config.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function getSubscriptionState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false };
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return { supported: true, permission: Notification.permission, subscribed: Boolean(sub), subscription: sub };
}

export async function enablePush(deviceLabel) {
  const vapidKey = getSetting(LS_KEYS.vapidPublicKey);
  if (!vapidKey) throw new Error('VAPID 공개키가 설정되지 않았습니다. 설정 화면에서 입력해주세요.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  if (isConfigured()) {
    await gh.putJSONFile(
      DATA_PATHS.pushSubs,
      (current) => {
        const arr = Array.isArray(current) ? current : [];
        const filtered = arr.filter((s) => s.endpoint !== sub.endpoint);
        filtered.push({ ...sub.toJSON(), deviceLabel: deviceLabel || guessDeviceLabel(), addedAt: new Date().toISOString() });
        return filtered;
      },
      `push: 기기 알림 구독 추가 (${deviceLabel || guessDeviceLabel()})`
    );
  }
  return sub;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  if (isConfigured()) {
    await gh.putJSONFile(
      DATA_PATHS.pushSubs,
      (current) => (Array.isArray(current) ? current.filter((s) => s.endpoint !== endpoint) : []),
      'push: 기기 알림 구독 해제'
    );
  }
}

function guessDeviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'MacBook';
  return '내 기기';
}
