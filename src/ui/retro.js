// 회고: 주/월/분기/연 단위 회고를 쉽게 쓰도록 안내하고, 지난 회고를 달력으로 모아 봅니다.
// 회고를 쓸 때는 그 기간 동안 쌓인 기록들을 "재료"로 함께 열어볼 수 있습니다.
import * as entries from '../entries.js';
import { RETRO_PERIODS, canWrite } from '../config.js';
import { openCapture } from './capture.js';
import {
  formatDate,
  wireEntryDelete,
  wireEntryEdit,
  contentBlockHtml,
  wireContentToggle,
  applyContentClamp,
} from './shared.js';

let unsub = null;

// 달력에서 지금 보고 있는 연/월과, 선택된 날짜(있으면 그 날의 회고를 아래에 보여줍니다).
// 탭을 열 때마다(=render() 호출마다) 최근 회고가 있는 달로 다시 맞춰집니다.
let viewYear = null;
let viewMonth = null; // 0-11
let selectedDateKey = null; // 'YYYY-MM-DD'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

const PROMPTS = {
  week: ['이번 주 가장 기억에 남는 순간은?', '이번 주에 배운 것 하나는?', '다음 주에 다르게 해보고 싶은 것은?'],
  month: ['이번 달 가장 잘한 일은?', '이번 달 가장 아쉬웠던 일은?', '다음 달의 한 가지 목표는?'],
  quarter: ['이번 분기 나에게 있었던 가장 큰 변화는?', '이번 분기 쌓은 기록들을 보면 어떤 흐름이 보이나요?', '다음 분기에 집중하고 싶은 주제는?'],
  year: ['올해를 한 문장으로 표현한다면?', '올해 가장 성장했다고 느끼는 부분은?', '내년에 꼭 써보고 싶은 글의 주제는?'],
};

const PERIOD_DESC = {
  week: '지난 월요일부터 오늘까지',
  month: '이번 달 1일부터 오늘까지',
  quarter: '이번 분기 첫날부터 오늘까지',
  year: '올해 1월 1일부터 오늘까지',
};

function getPeriodRange(period, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const dayOfWeek = start.getDay(); // 0=일 ... 6=토
    const sinceMonday = (dayOfWeek + 6) % 7; // 월요일=0
    start.setDate(start.getDate() - sinceMonday);
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'quarter') {
    const qStartMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(qStartMonth, 1);
  } else if (period === 'year') {
    start.setMonth(0, 1);
  }
  return { start, end: now };
}

function buildPromptTemplate(period) {
  const prompts = PROMPTS[period] || [];
  return prompts.map((p) => `Q. ${p}\nA. `).join('\n\n');
}

function startRetro(container, period) {
  const { start, end } = getPeriodRange(period);
  const referenceEntries = entries
    .getEntries()
    .filter((e) => e.type !== 'retro')
    .filter((e) => {
      const t = new Date(e.createdAt);
      return t >= start && t <= end;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); // 시간 순서대로(과거 -> 현재) 읽기 좋게

  openCapture({
    presetType: 'retro',
    presetRetroPeriod: period,
    prefillContent: buildPromptTemplate(period),
    referenceEntries,
    onSaved: () => refreshCalendar(container, { keepView: true }),
  });
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function retrosByDateKey(retros) {
  const map = new Map();
  for (const e of retros) {
    const key = dateKey(new Date(e.createdAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}

function buildCalendarCells(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  return cells;
}

export function render(container) {
  // 읽기 전용 연결(다른 사람에게 보기 전용으로 나눠준 토큰)이면 회고를 새로
  // 쓸 수 없으니, 시작 버튼 대신 안내 문구만 보여줍니다.
  const retroButtonsHtml = canWrite()
    ? `<div class="retro-buttons">
        ${RETRO_PERIODS.map((r) => `
          <button type="button" class="btn secondary retro-start" data-period="${r.id}">
            ${r.label} 쓰기
            <span class="retro-btn-desc">${PERIOD_DESC[r.id]}</span>
          </button>
        `).join('')}
      </div>`
    : '<p class="hint">읽기 전용으로 연결되어 있어서 새 회고를 쓸 수 없어요.</p>';

  container.innerHTML = `
    <div class="view retro-view">
      <h1 class="view-title">🪞 회고</h1>
      <p class="view-subtitle">쌓인 기록들을 재료 삼아 돌아보고, 나만의 글로 정리해보세요.</p>
      ${retroButtonsHtml}
      <h2 class="section-title">지난 회고</h2>
      <div id="retro-calendar" class="retro-calendar"></div>
      <div id="retro-day-list" class="entry-list"></div>
    </div>
  `;

  container.querySelectorAll('.retro-start').forEach((btn) => {
    btn.addEventListener('click', () => startRetro(container, btn.dataset.period));
  });

  const dayListEl = container.querySelector('#retro-day-list');
  wireEntryDelete(dayListEl, entries);
  wireEntryEdit(dayListEl, (id) => {
    const entry = entries.getEntries().find((e) => e.id === id);
    if (!entry) return;
    openCapture({ editEntry: entry });
  });
  wireContentToggle(dayListEl);

  // 탭을 열 때마다 "가장 최근 회고가 있는 달"로 맞춰서 보여줍니다. 회고가 하나도
  // 없으면 이번 달을 보여줍니다.
  const retros = entries.getEntries().filter((e) => e.type === 'retro');
  const mostRecent = retros.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] || null;
  const initialDate = mostRecent ? new Date(mostRecent.createdAt) : new Date();
  viewYear = initialDate.getFullYear();
  viewMonth = initialDate.getMonth();
  selectedDateKey = mostRecent ? dateKey(initialDate) : null;

  renderCalendar(container);
  renderDayList(container);

  unsub = entries.onChange(() => refreshCalendar(container, { keepView: true }));
  return () => { if (unsub) unsub(); };
}

// 데이터가 바뀌었을 때(새 회고 저장, 수정, 삭제) 달력과 선택된 날짜의 목록을
// 다시 그립니다. keepView가 true면 지금 보고 있는 연/월과 선택된 날짜를 그대로
// 유지합니다(다른 달을 보던 중에 뭔가 바뀌었다고 갑자기 최근 달로 튀지 않도록).
function refreshCalendar(container, { keepView = false } = {}) {
  if (!keepView) {
    viewYear = null;
    viewMonth = null;
    selectedDateKey = null;
  }
  if (viewYear === null) {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
  }
  renderCalendar(container);
  renderDayList(container);
}

function renderCalendar(container) {
  const calEl = container.querySelector('#retro-calendar');
  if (!calEl) return;
  const retros = entries.getEntries().filter((e) => e.type === 'retro');
  const byDate = retrosByDateKey(retros);
  const cells = buildCalendarCells(viewYear, viewMonth);
  const todayKey = dateKey(new Date());

  const weekdayRow = WEEKDAY_KO.map((w) => `<div class="cal-weekday">${w}</div>`).join('');
  const dayCells = cells.map((day) => {
    if (day === null) return '<div class="cal-day empty"></div>';
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayRetros = byDate.get(key) || [];
    const classes = ['cal-day'];
    if (key === todayKey) classes.push('today');
    if (key === selectedDateKey) classes.push('selected');
    if (dayRetros.length > 0) classes.push('has-retro');
    const dots = dayRetros.map(() => '<span class="cal-dot"></span>').join('');
    return `
      <button type="button" class="${classes.join(' ')}" data-date="${key}" ${dayRetros.length ? '' : 'disabled'}>
        <span class="cal-day-num">${day}</span>
        <span class="cal-dots">${dots}</span>
      </button>
    `;
  }).join('');

  calEl.innerHTML = `
    <div class="cal-header">
      <button type="button" class="icon-btn" id="cal-prev" aria-label="이전 달">‹</button>
      <span class="cal-title">${viewYear}년 ${viewMonth + 1}월</span>
      <button type="button" class="icon-btn" id="cal-next" aria-label="다음 달">›</button>
    </div>
    <div class="cal-grid cal-weekdays">${weekdayRow}</div>
    <div class="cal-grid">${dayCells}</div>
  `;

  calEl.querySelector('#cal-prev').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar(container);
  });
  calEl.querySelector('#cal-next').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar(container);
  });
  calEl.querySelectorAll('.cal-day.has-retro').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDateKey = btn.dataset.date === selectedDateKey ? null : btn.dataset.date;
      renderCalendar(container);
      renderDayList(container);
    });
  });
}

function renderDayList(container) {
  const listEl = container.querySelector('#retro-day-list');
  if (!listEl) return;
  const retros = entries.getEntries().filter((e) => e.type === 'retro');
  if (retros.length === 0) {
    listEl.innerHTML = '<div class="empty-state">아직 작성한 회고가 없어요.</div>';
    return;
  }
  if (!selectedDateKey) {
    listEl.innerHTML = '<div class="empty-state">달력에서 점이 있는 날짜를 선택하면 그날 쓴 회고를 볼 수 있어요.</div>';
    return;
  }
  const dayRetros = retros
    .filter((e) => dateKey(new Date(e.createdAt)) === selectedDateKey)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  if (dayRetros.length === 0) {
    listEl.innerHTML = '<div class="empty-state">이 날짜에는 회고가 없어요.</div>';
    return;
  }
  const actionButtons = (id) => canWrite()
    ? `<button type="button" class="entry-edit" data-id="${id}" aria-label="수정">✎</button>
       <button type="button" class="entry-delete" data-id="${id}" aria-label="삭제">✕</button>`
    : '';
  listEl.innerHTML = dayRetros.map((e) => {
    const label = RETRO_PERIODS.find((r) => r.id === e.retroPeriod)?.label || '회고';
    return `
      <article class="entry-card" data-id="${e.id}">
        <div class="entry-meta">
          <span class="entry-type">🪞 ${label}</span>
          <span class="entry-meta-right">
            <span class="entry-time">${formatDate(e.createdAt)}</span>
            ${actionButtons(e.id)}
          </span>
        </div>
        ${contentBlockHtml(e.content)}
      </article>
    `;
  }).join('');
  applyContentClamp(listEl);
}
