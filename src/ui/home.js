// 메인 화면: 헤더 로고를 누르면 오는 첫 화면. 인사 메시지("오늘도 파도가
// 밀려와요")와 함께, 예전에 쓴 기록 중 하나를 무작위로 다시 보여줍니다.
// 탭바에는 나타나지 않는 숨은 화면이라, 로고를 누르는 것이 유일한 진입 경로입니다.
import * as entries from '../entries.js';
import * as collections from '../collections.js';
import * as stats from '../stats.js';
import { entryCard, wireEntryDelete, wireEntryEdit, wireContentToggle, applyContentClamp } from './shared.js';
import { openCapture } from './capture.js';

let unsub = null;

export function render(container) {
  container.innerHTML = `
    <div class="view home-view">
      <div class="home-hero">
        <div class="home-wave" aria-hidden="true">🌊</div>
        <p class="home-message">오늘도 파도가 밀려와요</p>
      </div>
      <h2 class="section-title">예전에 쓴 기록 한 조각</h2>
      <div id="home-pick" class="home-pick"></div>
    </div>
  `;

  const pickEl = container.querySelector('#home-pick');
  wireEntryDelete(pickEl, entries);
  wireEntryEdit(pickEl, (id) => {
    const entry = entries.getEntries().find((e) => e.id === id);
    if (!entry) return;
    openCapture({ editEntry: entry });
  });
  wireContentToggle(pickEl);

  paint(container);
  unsub = entries.onChange(() => paint(container));
  return () => { if (unsub) unsub(); };
}

function paint(container) {
  const pickEl = container.querySelector('#home-pick');
  if (!pickEl) return;
  const list = entries.getEntries();
  const [picked] = stats.pickResurfacedEntries(list, 1);
  if (!picked) {
    pickEl.innerHTML = '<div class="empty-state">아직 기록이 없어요. 첫 기록을 남기면 다음에 여기서 다시 만날 수 있어요.</div>';
    return;
  }
  const collectionsById = new Map(collections.getItems().map((it) => [it.id, it]));
  pickEl.innerHTML = entryCard(picked, collectionsById);
  applyContentClamp(pickEl);
}
