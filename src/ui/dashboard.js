// 대시보드: 내적 동기부여를 위한 시각화 - 스트릭, 히트맵, 마일스톤, 키워드, 유형별 분포.
// ("다시 꺼내보는 기록"은 메인 화면(로고 클릭)에서 같은 역할을 하므로 여기선 뺐습니다.)
import * as entries from '../entries.js';
import * as stats from '../stats.js';
import { escapeHtml } from './shared.js';

let unsub = null;

export function render(container) {
  container.innerHTML = `<div class="view dashboard-view" id="dash-body"></div>`;
  paint(container);
  unsub = entries.onChange(() => paint(container));
  return () => { if (unsub) unsub(); };
}

function paint(container) {
  const list = entries.getEntries();
  const body = container.querySelector('#dash-body');
  if (!body) return;

  const streak = stats.computeStreak(list);
  const heatmap = stats.computeHeatmap(list, 20);
  const milestones = stats.computeMilestones(list);
  const keywords = stats.computeKeywordFrequency(list, { since: monthsAgo(1) });
  const typeCounts = stats.computeTypeCounts(list);
  const periods = stats.periodCounts(list);

  body.innerHTML = `
    <h1 class="view-title">📊 나의 기록 여정</h1>

    <div class="stat-row">
      <div class="stat-box big">
        <div class="stat-num">${streak.current}</div>
        <div class="stat-label">일 연속 기록${streak.hasToday ? '' : ' (오늘 아직 안 씀)'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${streak.longest}</div>
        <div class="stat-label">최장 연속</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${milestones.total}</div>
        <div class="stat-label">전체 기록</div>
      </div>
    </div>

    <h2 class="section-title">최근 20주</h2>
    <div class="heatmap">${renderHeatmap(heatmap)}</div>

    <h2 class="section-title">이번 주 / 이번 달</h2>
    <div class="stat-row">
      <div class="stat-box"><div class="stat-num">${periods.thisWeek}</div><div class="stat-label">이번 주</div></div>
      <div class="stat-box"><div class="stat-num">${periods.thisMonth}</div><div class="stat-label">이번 달</div></div>
    </div>

    <h2 class="section-title">기록 뱃지 🏅</h2>
    <div class="badge-row">
      ${milestones.reached.map((m) => `<span class="badge">🏅 ${m}개 달성</span>`).join('') || '<span class="hint">첫 기록을 남기면 뱃지가 시작돼요.</span>'}
      ${milestones.next ? `<span class="badge next">다음 목표: ${milestones.next}개</span>` : ''}
    </div>

    <h2 class="section-title">최근 한 달의 키워드</h2>
    <div class="keyword-cloud">
      ${keywords.map((k) => `<span class="keyword" style="font-size:${12 + Math.min(k.count, 10)}px">${escapeHtml(k.word)}</span>`).join('') || '<span class="hint">아직 분석할 만큼의 기록이 없어요.</span>'}
    </div>

    <h2 class="section-title">유형별 기록</h2>
    <div class="type-dist">
      ${list.length === 0 ? '<span class="hint">아직 기록이 없어요.</span>' : renderTypeDist(typeCounts)}
    </div>
  `;
}

// 유형별로 몇 개씩 남겼는지 가로 막대로 보여줍니다. 가장 많이 쓴 유형의 개수를
// 100%로 잡고, 나머지는 그 비율로 막대 길이를 정합니다.
function renderTypeDist(typeCounts) {
  const max = Math.max(1, ...typeCounts.map((t) => t.count));
  return typeCounts.map((t) => `
    <div class="type-dist-row">
      <span class="type-dist-label">${t.emoji} ${t.label}</span>
      <div class="type-dist-bar-track"><div class="type-dist-bar" style="width:${(t.count / max) * 100}%"></div></div>
      <span class="type-dist-count">${t.count}</span>
    </div>
  `).join('');
}

function renderHeatmap(days) {
  // 7일씩 끊어 주 단위 컬럼으로.
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return `<div class="heatmap-grid">${weeks.map((week) => `
    <div class="heatmap-col">${week.map((d) => `<div class="heatmap-cell level-${levelOf(d.count)}" title="${d.date}: ${d.count}개"></div>`).join('')}</div>
  `).join('')}</div>`;
}

function levelOf(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}
