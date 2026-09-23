// GitHub Actions 크론이 매일 실행하는 스크립트.
// 1) 오늘이 금요일/월말/분기말/연말인지 (한국 시간 기준) 확인해서, 해당하는 회고 알림을
//    push-subscriptions.json 에 등록된 모든 기기로 웹 푸시 발송합니다.
// 2) 컬렉션(책/영상·작품) 중에 "완독" 표시가 안 됐는데 30일 넘게 새로운 기록이 안
//    붙은 항목이 있으면, "OO 아직 보고 있나요?" 알림을 보냅니다. 같은 항목을 매일
//    반복해서 알리지 않도록, 한 번 알린 뒤에는 그 항목에 새 기록이 다시 붙기 전까지는
//    조용히 있습니다(마음이 없어서 30일이 지나 있어도 스팸처럼 매일 오지 않게).
// 3) 위시리스트에서 "다녀왔어요/봤어요"로 체크된 항목 중, 체크한 지 7일이 지났는데도
//    영감 탭에 그 제목으로 된 새 기록이 하나도 없으면 "OO 어떠셨나요?" 알림을 보냅니다.
//    (2번과 마찬가지로 한 번 알리면 재체크하기 전까지는 반복하지 않습니다.)
//
// 기록 데이터(구독 목록, 컬렉션, 위시리스트, 기록 모두)는 앱 코드와는 별도의 Private
// 저장소에 보관합니다 (코드 저장소는 GitHub Pages 때문에 Public이어야 하는데, 실제
// 기록까지 Public이면 안 되니까요). 그래서 이 스크립트는 위치를 코드에 고정하지 않고
// SUBS_PATH / COLLECTIONS_PATH / WISHLIST_PATH / ENTRIES_DIR 환경변수로 받습니다
// (워크플로에서 데이터 저장소를 별도 경로에 체크아웃한 뒤 그 경로를 넘겨줍니다).
import fs from 'node:fs/promises';
import path from 'node:path';
import webpush from 'web-push';

const SUBS_PATH = path.resolve(process.env.SUBS_PATH || 'data/meta/push-subscriptions.json');
const COLLECTIONS_PATH = path.resolve(process.env.COLLECTIONS_PATH || 'data/collections.json');
const WISHLIST_PATH = path.resolve(process.env.WISHLIST_PATH || 'data/wishlist.json');
const ENTRIES_DIR = path.resolve(process.env.ENTRIES_DIR || 'data/entries');
const STALE_COLLECTION_DAYS = 30;
const STALE_WISHLIST_DAYS = 7;

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

async function loadCollections() {
  try {
    const raw = await fs.readFile(COLLECTIONS_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function loadWishlist() {
  try {
    const raw = await fs.readFile(WISHLIST_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function loadAllEntries() {
  let files;
  try {
    files = await fs.readdir(ENTRIES_DIR);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const all = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(ENTRIES_DIR, file), 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) all.push(...data);
    } catch (e) {
      console.warn(`기록 파일을 읽지 못했습니다 (${file}): ${e.message}`);
    }
  }
  return all;
}

/**
 * "완독" 표시가 안 된 컬렉션 항목 중, 그 항목에 걸린 기록(글귀/영상 등)의
 * 가장 최근 작성일로부터 30일이 지난 것들을 찾습니다. 아직 기록이 하나도
 * 안 붙어 있으면(이론상 거의 없지만) 항목이 만들어진 날짜를 기준으로 삼습니다.
 * 이미 알림을 보낸 적이 있는데 그 이후로 새 기록이 없었다면, 매일 반복해서
 * 알리지 않도록 건너뜁니다.
 */
function findStaleCollectionItems(items, entries) {
  const lastActivityByItem = new Map();
  for (const e of entries) {
    if (!e.collectionId) continue;
    const t = new Date(e.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    const prev = lastActivityByItem.get(e.collectionId);
    if (prev === undefined || t > prev) lastActivityByItem.set(e.collectionId, t);
  }

  const now = Date.now();
  const stale = [];
  for (const item of items) {
    if (item.finished) continue;
    const lastActivity = lastActivityByItem.has(item.id)
      ? lastActivityByItem.get(item.id)
      : new Date(item.createdAt).getTime();
    if (Number.isNaN(lastActivity)) continue;
    const daysSince = (now - lastActivity) / (1000 * 60 * 60 * 24);
    if (daysSince < STALE_COLLECTION_DAYS) continue;
    const notifiedAt = item.staleReminderSentAt ? new Date(item.staleReminderSentAt).getTime() : null;
    if (notifiedAt !== null && notifiedAt >= lastActivity) continue; // 이미 이 "멈춤"에 대해 알렸음
    stale.push(item);
  }
  return stale;
}

function staleReminderFor(item) {
  const verb = item.kind === 'media' ? '보고' : '읽고';
  return {
    title: `📚 "${item.title}" 아직 ${verb} 있나요?`,
    body: '30일 넘게 새로운 기록이 없어요. 다 봤다면 컬렉션에서 완독으로 표시해보세요.',
    url: './index.html#/collection',
  };
}

/**
 * 위시리스트에서 "다녀왔어요/봤어요"로 체크됐는데, 체크한 시점(visitedAt) 이후로
 * 영감 탭에 그 제목(source)으로 된 새 기록이 하나도 없는 채로 7일이 지난 항목을
 * 찾습니다. 제목 매칭은 컬렉션 자동 연결과 같은 방식(대소문자/공백 무시한 정확
 * 일치)이라, 기록의 출처란에 위시리스트와 똑같은 제목을 적어야 "글을 남겼다"고
 * 인식합니다. 이미 알림을 보낸 적이 있는데 그 이후로 관련 기록이 여전히 없다면,
 * 매일 반복해서 알리지 않도록 건너뜁니다(체크를 다시 하기 전까지는 조용히 있음).
 */
function findStaleVisitedWishlistItems(items, entries) {
  const norm = (s) => (s || '').trim().toLowerCase();
  const lastActivityByTitle = new Map();
  for (const e of entries) {
    const key = norm(e.source);
    if (!key) continue;
    const t = new Date(e.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    const prev = lastActivityByTitle.get(key);
    if (prev === undefined || t > prev) lastActivityByTitle.set(key, t);
  }

  const now = Date.now();
  const stale = [];
  for (const item of items) {
    if (!item.visited) continue;
    const visitedAt = new Date(item.visitedAt || item.createdAt).getTime();
    if (Number.isNaN(visitedAt)) continue;
    const lastActivity = lastActivityByTitle.get(norm(item.title));
    if (lastActivity !== undefined && lastActivity > visitedAt) continue; // 체크 이후 이미 글을 남겼음
    const daysSince = (now - visitedAt) / (1000 * 60 * 60 * 24);
    if (daysSince < STALE_WISHLIST_DAYS) continue;
    const notifiedAt = item.visitedReminderSentAt ? new Date(item.visitedReminderSentAt).getTime() : null;
    if (notifiedAt !== null && notifiedAt >= visitedAt) continue; // 이미 이 체크에 대해 알렸음
    stale.push(item);
  }
  return stale;
}

function visitedReminderFor(item) {
  return {
    title: `⭐ "${item.title}" 어떠셨나요?`,
    body: '위시리스트에서 체크했는데, 영감 탭에 아직 기록을 남기지 않으셨네요.',
    url: './index.html#/',
  };
}

async function main() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('VAPID 키가 설정되지 않아 알림을 건너뜁니다. (Actions Secrets를 확인하세요)');
    return;
  }
  const reminders = buildTodaysReminders();

  const [collectionsData, wishlistData, entriesData] = await Promise.all([
    loadCollections(),
    loadWishlist(),
    loadAllEntries(),
  ]);
  const staleItems = findStaleCollectionItems(collectionsData, entriesData);
  for (const item of staleItems) reminders.push(staleReminderFor(item));

  const staleWishlistItems = findStaleVisitedWishlistItems(wishlistData, entriesData);
  for (const item of staleWishlistItems) reminders.push(visitedReminderFor(item));

  if (reminders.length === 0) {
    console.log('오늘은 보낼 알림이 없습니다.');
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

  // 방금 "아직 보고 있나요?" 알림을 보낸 컬렉션 항목들은, 그 뒤로 새 기록이
  // 다시 붙기 전까지는 내일 또 알리지 않도록 표시해서 데이터 저장소에 저장합니다.
  if (staleItems.length > 0) {
    const notifiedIds = new Set(staleItems.map((it) => it.id));
    const now = new Date().toISOString();
    const updatedCollections = collectionsData.map((it) =>
      notifiedIds.has(it.id) ? { ...it, staleReminderSentAt: now } : it
    );
    await fs.writeFile(COLLECTIONS_PATH, JSON.stringify(updatedCollections, null, 2) + '\n', 'utf-8');
    console.log(`오래 멈춰있는 컬렉션 항목 ${staleItems.length}개에 알림을 보냈습니다.`);
  }

  // 방금 "어떠셨나요?" 알림을 보낸 위시리스트 항목들도, 재체크하기 전까지는
  // 내일 또 알리지 않도록 표시해서 데이터 저장소에 저장합니다.
  if (staleWishlistItems.length > 0) {
    const notifiedIds = new Set(staleWishlistItems.map((it) => it.id));
    const now = new Date().toISOString();
    const updatedWishlist = wishlistData.map((it) =>
      notifiedIds.has(it.id) ? { ...it, visitedReminderSentAt: now } : it
    );
    await fs.writeFile(WISHLIST_PATH, JSON.stringify(updatedWishlist, null, 2) + '\n', 'utf-8');
    console.log(`체크 후 조용한 위시리스트 항목 ${staleWishlistItems.length}개에 알림을 보냈습니다.`);
  }
}

// `node scripts/send-reminders.mjs`(또는 npm run reminders)로 직접 실행했을 때만
// 자동으로 돕니다. 다른 스크립트(테스트 등)가 순수 함수들만 가져다 쓰려고
// import할 때는 실행되지 않습니다.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  buildTodaysReminders,
  findStaleCollectionItems,
  staleReminderFor,
  findStaleVisitedWishlistItems,
  visitedReminderFor,
};
