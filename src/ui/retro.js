// 회고: 주/월/분기/연 단위 회고를 쉽게 쓰도록 안내하고, 지난 회고를 모아 봅니다.
// 회고를 쓸 때는 그 기간 동안 쌓인 기록들을 "재료"로 함께 열어볼 수 있습니다.
import * as entries from '../entries.js';
import { RETRO_PERIODS, canWrite } from '../config.js';
import { openCapture } from './capture.js';
import { escapeHtml, formatDate, wireEntryDelete, wireEntryEdit } from './shared.js';

let unsub = null;

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
    onSaved: () => renderList(container),
  });
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
      <div id="retro-list" class="entry-list"></div>
    </div>
  `;

  container.querySelectorAll('.retro-start').forEach((btn) => {
    btn.addEventListener('click', () => startRetro(container, btn.dataset.period));
  });

  wireEntryDelete(container.querySelector('#retro-list'), entries);
  wireEntryEdit(container.querySelector('#retro-list'), (id) => {
    const entry = entries.getEntries().find((e) => e.id === id);
    if (!entry) return;
    openCapture({ editEntry: entry });
  });

  renderList(container);
  unsub = entries.onChange(() => renderList(container));
  return () => { if (unsub) unsub(); };
}

function renderList(container) {
  const listEl = container.querySelector('#retro-list');
  if (!listEl) return;
  const retros = entries.getEntries().filter((e) => e.type === 'retro');
  if (retros.length === 0) {
    listEl.innerHTML = '<div class="empty-state">아직 작성한 회고가 없어요.</div>';
    return;
  }
  const actionButtons = (id) => canWrite()
    ? `<button type="button" class="entry-edit" data-id="${id}" aria-label="수정">✎</button>
       <button type="button" class="entry-delete" data-id="${id}" aria-label="삭제">✕</button>`
    : '';
  listEl.innerHTML = retros.map((e) => {
    const label = RETRO_PERIODS.find((r) => r.id === e.retroPeriod)?.label || '회고';
    return `
      <article class="entry-card">
        <div class="entry-meta">
          <span class="entry-type">🪞 ${label}</span>
          <span class="entry-meta-right">
            <span class="entry-time">${formatDate(e.createdAt)}</span>
            ${actionButtons(e.id)}
          </span>
        </div>
        <p class="entry-content">${escapeHtml(e.content).replace(/\n/g, '<br/>')}</p>
      </article>
    `;
  }).join('');
}
