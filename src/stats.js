// 동기부여를 위한 통계: 연속 기록일, 히트맵, 마일스톤, 키워드 빈도, 랜덤 회상, 유형별 분포.
import { ENTRY_TYPES } from './config.js';

// '회고'는 ENTRY_TYPES에 없어서(전용 탭에서만 다루는 별도 흐름이라) 따로 추가합니다.
const TYPE_META = [...ENTRY_TYPES, { id: 'retro', label: '회고', emoji: '🪞' }];
//
// 마일스톤 간격 설계:
// - 초반(1~150)에는 어차피 의욕이 높아 목표가 쉽게쉽게 달성되므로 간격이 다소 벌어져도 괜찮음.
// - 100~340 구간(보통 습관 형성 중 흥미가 꺾이기 쉬운 시기)에서 간격이 가장 넓어졌다가,
// - 그 이후부터는 총 기록 수가 커질수록(=꾸준함을 유지하기 어려워질수록) 오히려 간격을 좁혀서
//   더 자주 성취감을 주도록 함.
// - 마지막 고정값(400) 이후로는 TAIL_GAP(50)씩 계속 새로운 목표가 생성되어, 기록이 수천 개가
//   쌓여도 "다음 목표"가 끊기지 않음 — 평생 기록 아카이브라는 취지에 맞춤.
const MILESTONES = [1, 10, 30, 60, 100, 150, 210, 275, 340, 400];
const TAIL_GAP = 50;

function tailMilestoneAfter(total) {
  // MILESTONES 배열의 마지막 값 이후, TAIL_GAP 간격으로 목표를 계속 생성.
  const last = MILESTONES[MILESTONES.length - 1];
  if (total < last) return last;
  const steps = Math.floor((total - last) / TAIL_GAP) + 1;
  return last + steps * TAIL_GAP;
}

// 기록 시각(createdAt)은 UTC로 저장되지만, 스트릭/히트맵은 "사용자가 보는 그 날짜"
// 기준이어야 하므로 항상 기기의 로컬 시간대로 날짜를 계산합니다.
function dayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeStreak(entries) {
  const days = new Set(entries.map((e) => dayKey(e.createdAt)));
  let cursor = new Date();
  let streak = 0;
  // 오늘 기록이 없으면 "어제까지의 연속"을 보여주되, 오늘 안 늦었다는 걸 표시하기 위해 today 포함 여부 반환
  const todayKey = dayKey(cursor);
  let hasToday = days.has(todayKey);
  if (!hasToday) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  let longest = 0;
  const sortedDays = Array.from(days).sort();
  let run = 0;
  let prev = null;
  for (const d of sortedDays) {
    if (prev) {
      const prevDate = new Date(prev);
      prevDate.setDate(prevDate.getDate() + 1);
      const contiguous = dayKey(prevDate) === d;
      run = contiguous ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current: streak, longest, hasToday };
}

export function computeHeatmap(entries, weeks = 26) {
  const counts = new Map();
  for (const e of entries) {
    const k = dayKey(e.createdAt);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const days = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - weeks * 7 + 1);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    days.push({ date: k, count: counts.get(k) || 0 });
  }
  return days;
}

export function computeMilestones(entries) {
  const total = entries.length;
  const reached = MILESTONES.filter((m) => total >= m);
  const last = MILESTONES[MILESTONES.length - 1];
  if (total >= last) {
    // 고정 목록을 넘어선 뒤에도 TAIL_GAP 간격으로 계속 달성 뱃지를 쌓음.
    for (let m = last + TAIL_GAP; m <= total; m += TAIL_GAP) reached.push(m);
  }
  const next = total < last ? MILESTONES.find((m) => total < m) : tailMilestoneAfter(total);
  return { total, reached, next };
}

const STOPWORDS = new Set(['그리고', '그런데', '하지만', '그래서', '이것', '저것', '것은', '것을', '나는', '내가', 'the', 'and', 'this', 'that', 'for', 'with']);

// 아주 간단한 조사 제거: 진짜 형태소 분석기 없이도, 자주 붙는 조사(은/는/이/가/을/를/
// 에서/으로/이라고 등)를 알려진 목록으로 하나 떼어냅니다. 그래야 "여행을"·"여행은"·
// "여행에서"가 전부 그냥 "여행"이라는 같은 키워드로 합쳐집니다 — 조사가 붙은 채로
// 어절 그대로 세면 같은 단어인데도 매번 다른 키워드처럼 따로 집계되거든요.
// 완벽하진 않습니다(드물게 "사진가"처럼 우연히 조사와 같은 글자로 끝나는 단어가
// 잘못 잘릴 수 있음) — 하지만 일기 키워드 뽑기엔 이 정도로도 훨씬 깔끔해집니다.
const JOSA_SUFFIXES = [
  '으로부터', '에서부터', '에게서', '한테서',
  '이라고', '이라는', '이지만', '이니까', '으로는', '에서는', '에게는', '한테는',
  '라고', '라는', '지만', '니까',
  '으로', '에서', '에게', '한테', '까지', '부터', '이나', '이랑', '보다', '처럼', '만큼',
  '와', '과', '도', '만', '뿐', '나', '랑', '께',
  '은', '는', '이', '가', '을', '를', '의', '에',
].sort((a, b) => b.length - a.length);

function stripJosa(word) {
  for (const suf of JOSA_SUFFIXES) {
    if (word.length > suf.length && word.endsWith(suf)) {
      return word.slice(0, -suf.length);
    }
  }
  return word;
}

export function computeKeywordFrequency(entries, { since = null, limit = 12 } = {}) {
  const freq = new Map();
  for (const e of entries) {
    if (since && new Date(e.createdAt) < since) continue;
    const words = (e.content || '')
      .normalize('NFKC')
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => w.trim())
      .filter(Boolean)
      .map(stripJosa)
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()));
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    for (const t of e.tags || []) {
      freq.set(t, (freq.get(t) || 0) + 3); // 태그는 가중치를 더 줌
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function pickResurfacedEntries(entries, count = 3) {
  if (entries.length === 0) return [];
  const old = entries.filter((e) => {
    const days = (Date.now() - new Date(e.createdAt).getTime()) / 86400000;
    return days >= 14; // 2주 이상 지난 기록 중에서 회상
  });
  const pool = old.length > 0 ? old : entries;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// 전체 기록을 유형별(글귀/인사이트/링크/생각/영상·작품/단어/회고)로 몇 개씩
// 썼는지 셉니다. 기록이 하나도 없는 유형도 0개로 포함해서 반환하고, 많이 쓴
// 순서로 정렬합니다 — "어떤 유형을 많이 남겼는지" 한눈에 보기 위함입니다.
export function computeTypeCounts(entries) {
  const counts = new Map(TYPE_META.map((t) => [t.id, 0]));
  for (const e of entries) {
    if (counts.has(e.type)) counts.set(e.type, counts.get(e.type) + 1);
  }
  return TYPE_META
    .map((t) => ({ id: t.id, label: t.label, emoji: t.emoji, count: counts.get(t.id) || 0 }))
    .sort((a, b) => b.count - a.count);
}

export function periodCounts(entries) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  return {
    thisWeek: entries.filter((e) => new Date(e.createdAt) >= weekAgo).length,
    thisMonth: entries.filter((e) => new Date(e.createdAt) >= monthAgo).length,
    total: entries.length,
  };
}
