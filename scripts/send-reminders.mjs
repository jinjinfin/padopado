// GitHub Actions 크론이 매일 실행하는 스크립트.
// 오늘이 금요일/월말/분기말/연말인지 (한국 시간 기준) 확인해서, 해당하는 회고 알림을
// data/meta/push-subscriptions.json 에 등록된 모든 기기로 웹 푸시 발송합니다.
// 이 스크립트는 저장소 안에서 직접 실행되므로(actions/checkout) 파일을 그냥 읽고 씁니다.
import fs from 'node:fs/promises';
import path from 'node:path';
import webpush from 'web-push';

const SUBS_PATH = path.resolve('data/meta/push-subscriptions.json');

function kstParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month), // 1-12
    day: Number(parts.day),
    weekday: parts.weekday, // 'Mon', 'Tue', ...
  };
}

function isLastDayOfMonth({ year, month, day }) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day === lastDay;
}

function buildTodaysReminders() {
  const now = kstParts();
  const reminders = [];

  if (now.weekday === 'Fri') {
    reminders.push({
      title: '🪞 주간 회고 시간이에요',
      body: '이번 주 기록들을 돌아보고 짧게 남겨볼까요?',
      url: './index.html#/retro',
    });
  }
  if (isLastDayOfMonth(now)) {
    reminders.push({
      title: '📅 이번 달을 정리해봐요',
      body: '월간 회고를 쓰면서 한 달의 흐름을 되짚어보세요.',
      url: './index.html#/retro',
    });
  }
  if (isLastDayOfMonth(now) && [3, 6, 9, 12].includes(now.month)) {
    reminders.push({
      title: '🧭 분기 회고를 남겨보세요',
      body: '지난 분기 동안 쌓인 기록을 훑어보면 새로운 글감이 보일 거예요.',
      url: './index.html#/retro',
    });
  }
  if (now.month === 12 && now.day === 31) {
    reminders.push({
      title: '✨ 한 해를 마무리하는 회고',
      body: '올 한 해의 기록을 돌아보고, 나만의 글로 남겨보세요.',
      url: './index.html#/retro',
    });
  }
  return reminders;
}

async function loadSubscriptions() {
  try {
    const raw = await fs.readFile(SUBS_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function main() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('VAPID 키가 설정되지 않아 알림을 건너뜁니다. (Actions Secrets를 확인하세요)');
    return;
  }
  const reminders = buildTodaysReminders();
  if (reminders.length === 0) {
    console.log('오늘은 예정된 회고 알림이 없습니다.');
    return;
  }

  const subscriptions = await loadSubscriptions();
  if (subscriptions.length === 0) {
    console.log('등록된 알림 구독이 없습니다. 앱 설정에서 알림을 켜주세요.');
    return;
  }

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:example@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const stillValid = [];
  for (const sub of subscriptions) {
    let keepSub = true;
    for (const reminder of reminders) {
      try {
        await webpush.sendNotification(sub, JSON.stringify(reminder));
        console.log(`발송 성공: ${sub.deviceLabel || sub.endpoint} <- ${reminder.title}`);
      } catch (err) {
        console.warn(`발송 실패 (${sub.deviceLabel || sub.endpoint}): ${err.statusCode || err.message}`);
        if (err.statusCode === 404 || err.statusCode === 410) {
          keepSub = false; // 더 이상 유효하지 않은 구독 (기기에서 알림 끔/앱 삭제 등)
        }
      }
    }
    if (keepSub) stillValid.push(sub);
  }

  if (stillValid.length !== subscriptions.length) {
    await fs.writeFile(SUBS_PATH, JSON.stringify(stillValid, null, 2) + '\n', 'utf-8');
    console.log(`만료된 구독 ${subscriptions.length - stillValid.length}개를 정리했습니다.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
