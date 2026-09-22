// 빠른 기록 모달: 텍스트 입력 또는 사진 촬영(OCR) 두 가지 방식. 장벽을 최대한 낮춘 단일 폼.
// 회고 작성 시에는 그 기간 동안 쌓인 기록을 "재료"로 함께 보여줍니다.
// 글귀(책)나 영상/작품을 기록할 때는 "출처"에 적은 제목이 그대로 컬렉션 제목이 되어
// 자동으로 쌓입니다 (별도의 컬렉션 제목 입력칸은 두지 않습니다 - 출처와 중복이라 없앴습니다).
//
// 출처/저자/URL/태그는 모두 본문 바로 아래 항상 보이는 입력칸입니다.
// 회고 기록에는 이런 부가 속성이 필요 없으므로 아예 표시하지 않습니다.
import { ENTRY_TYPES, RETRO_PERIODS, TYPE_TO_COLLECTION_KIND } from '../config.js';
import * as entries from '../entries.js';
import * as collections from '../collections.js';
import { recognizeText } from '../ocr.js';
import { escapeHtml, formatDate } from './shared.js';

let modalEl = null;
let onSavedCallback = null;

/**
 * @param {object} opts
 * @param {string|null} opts.presetType - 미리 선택해둘 기록 유형
 * @param {string|null} opts.presetRetroPeriod - 회고 기간(week/month/quarter/year). 지정하면 "회고 전용" 화면으로 열립니다.
 * @param {string} opts.prefillContent - 텍스트 영역에 미리 채워둘 내용(회고 질문 템플릿 등)
 * @param {Array} opts.referenceEntries - 참고용으로 함께 보여줄 지난 기록들 (회고 재료)
 * @param {object|null} opts.editEntry - 지정하면 새 기록이 아니라 이 기존 기록을 "수정"하는 모드로 엽니다.
 *   내용/출처/저자/링크/태그/유형이 모두 미리 채워지고, 저장 시 addEntry가 아니라 updateEntry가 호출됩니다.
 * @param {Function} opts.onSaved - 저장 완료 후 콜백
 */
export function openCapture({
  presetType = null,
  presetRetroPeriod = null,
  prefillContent = '',
  referenceEntries = [],
  editEntry = null,
  onSaved = null,
} = {}) {
  onSavedCallback = onSaved;
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'capture-modal';
    modalEl.className = 'modal-backdrop';
    document.body.appendChild(modalEl);
  }
  // 수정 모드에서는 "미리 선택"해둘 값들을 수정할 기록 자체에서 가져옵니다.
  const effectivePresetType = editEntry ? editEntry.type : presetType;
  const effectivePresetRetroPeriod = editEntry ? editEntry.retroPeriod : presetRetroPeriod;
  const effectivePrefillContent = editEntry ? editEntry.content : prefillContent;
  const retroMode = Boolean(effectivePresetRetroPeriod);
  modalEl.innerHTML = renderModal({
    presetType: effectivePresetType,
    presetRetroPeriod: effectivePresetRetroPeriod,
    retroMode,
    referenceEntries,
    isEdit: Boolean(editEntry),
  });
  modalEl.classList.add('open');
  wireModal({
    presetType: effectivePresetType,
    presetRetroPeriod: effectivePresetRetroPeriod,
    retroMode,
    prefillContent: effectivePrefillContent,
    editEntry,
  });
}

function closeModal() {
  if (modalEl) {
    modalEl.classList.remove('open');
    modalEl.innerHTML = '';
  }
}

function retroLabel(period) {
  return RETRO_PERIODS.find((r) => r.id === period)?.label || '회고';
}

function collectionKindFor(type) {
  return TYPE_TO_COLLECTION_KIND[type] || null;
}

function renderModal({ presetType, presetRetroPeriod, retroMode, referenceEntries, isEdit = false }) {
  const chips = ENTRY_TYPES.map(
    (t) => `<button type="button" class="chip type-chip${presetType === t.id ? ' active' : ''}" data-type="${t.id}" title="${t.hint}">${t.emoji} ${t.label}</button>`
  ).join('');

  const referenceToggleBtn = referenceEntries.length
    ? `<button type="button" class="btn secondary" id="toggle-reference">📚 이 기간의 기록 보기 (${referenceEntries.length}개)</button>`
    : '';
  const referenceListPanel = referenceEntries.length
    ? `
      <div id="reference-list" class="entry-list reference-list" style="display:none">
        ${referenceEntries.map((e) => `
          <article class="entry-card reference-item">
            <div class="entry-meta"><span class="entry-time">${formatDate(e.createdAt)}</span></div>
            <p class="entry-content">${escapeHtml(e.content).replace(/\n/g, '<br/>')}</p>
          </article>
        `).join('')}
      </div>
    `
    : '';

  return `
    <div class="modal-sheet" role="dialog" aria-label="새 기록">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>${retroMode ? `🪞 ${retroLabel(presetRetroPeriod)} ${isEdit ? '수정' : '작성'}` : (isEdit ? '기록 수정' : '새로운 기록')}</h2>
        <button type="button" class="icon-btn" id="capture-close" aria-label="닫기">✕</button>
      </div>

      ${referenceToggleBtn ? `<div class="capture-actions-row">${referenceToggleBtn}</div>` : ''}
      ${referenceListPanel}

      ${retroMode ? '' : `<div class="chip-row" id="type-chips">${chips}</div>`}

      <textarea id="capture-content" placeholder="지금 기록하고 싶은 것을 적어보세요. 사진으로 찍으면 자동으로 글자를 인식해요." rows="8"></textarea>
      <div id="ocr-status" class="hint" style="display:none"></div>

      ${retroMode ? '' : `
        <input type="text" id="field-source" placeholder="출처 (책 제목 · 아티클 · 강연/회의명 · 영상 제목 등)" />
        <input type="text" id="field-author" placeholder="저자 / 감독·출연 (선택)" />
        <input type="url" id="field-url" placeholder="링크 URL (선택)" />
        <input type="text" id="field-tags" placeholder="태그 (쉼표로 구분, 예: 성장, 리더십)" />
      `}

      <div class="capture-actions-row">
        <label class="btn secondary" for="capture-photo">📷 사진으로 기록</label>
        <input type="file" id="capture-photo" accept="image/*" capture="environment" hidden />
      </div>

      <button type="button" class="btn primary" id="capture-save">${isEdit ? '수정 완료' : '저장하기'}</button>
    </div>
  `;
}

function wireModal({ presetType, presetRetroPeriod, retroMode, prefillContent, editEntry = null }) {
  const $ = (sel) => modalEl.querySelector(sel);
  let selectedType = retroMode ? 'retro' : presetType;
  let selectedRetro = presetRetroPeriod;

  if (prefillContent) {
    $('#capture-content').value = prefillContent;
  }

  // 수정 모드: 회고가 아닌 일반 기록이면 출처/저자/링크/태그도 기존 값 그대로 채워둡니다.
  if (editEntry && !retroMode) {
    const fieldSource = $('#field-source');
    const fieldAuthor = $('#field-author');
    const fieldUrl = $('#field-url');
    const fieldTags = $('#field-tags');
    if (fieldSource) fieldSource.value = editEntry.source || '';
    if (fieldAuthor) fieldAuthor.value = editEntry.author || '';
    if (fieldUrl) fieldUrl.value = editEntry.url || '';
    if (fieldTags) fieldTags.value = (editEntry.tags || []).join(', ');
  }

  $('#capture-close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  if (!retroMode) {
    $('#type-chips').addEventListener('click', (e) => {
      const btn = e.target.closest('.type-chip');
      if (!btn) return;
      selectedType = selectedType === btn.dataset.type ? null : btn.dataset.type;
      modalEl.querySelectorAll('.type-chip').forEach((c) => c.classList.toggle('active', c === btn && selectedType));
    });
  }

  const refToggle = $('#toggle-reference');
  if (refToggle) {
    refToggle.addEventListener('click', () => {
      const panel = $('#reference-list');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  $('#capture-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = $('#ocr-status');
    status.style.display = 'block';
    status.textContent = '사진에서 글자를 인식하는 중... (처음 한 번은 시간이 조금 걸려요)';
    try {
      const text = await recognizeText(file, (pct) => {
        status.textContent = `인식 중... ${pct}%`;
      });
      const ta = $('#capture-content');
      ta.value = ta.value ? `${ta.value}\n${text}` : text;
      status.textContent = '인식 완료! 필요하면 내용을 고쳐주세요.';
      setTimeout(() => { status.style.display = 'none'; }, 2500);
    } catch (err) {
      status.textContent = `인식 실패: ${err.message}`;
    }
  });

  $('#capture-save').addEventListener('click', async () => {
    const content = $('#capture-content').value.trim();
    if (!content) {
      $('#capture-content').focus();
      return;
    }
    const saveBtn = $('#capture-save');
    saveBtn.disabled = true;
    saveBtn.textContent = editEntry ? '수정 중...' : '저장 중...';

    const fieldVal = (id) => $(id)?.value.trim() || '';
    const source = fieldVal('#field-source');
    const author = fieldVal('#field-author');
    const url = fieldVal('#field-url');
    const tags = fieldVal('#field-tags').split(',').map((t) => t.trim()).filter(Boolean);
    // 별도의 "컬렉션 제목" 입력칸은 없습니다 - 해당 유형(글귀/영상·작품)이면
    // 출처에 적은 제목이 그대로 컬렉션 제목이 되어 자동으로 쌓입니다.
    const finalType = selectedType || 'thought';
    const kind = collectionKindFor(finalType);

    let collectionId = null;
    if (source && kind) {
      const item = await collections.findOrCreateItem({ title: source, author, kind });
      collectionId = item.id;
    }

    if (editEntry) {
      // 수정: id와 원래 작성 시각(createdAt)은 그대로 두고 내용만 바꿉니다.
      await entries.updateEntry(editEntry.id, {
        type: finalType,
        content,
        source,
        author,
        url,
        tags,
        collectionId,
        retroPeriod: finalType === 'retro' ? (selectedRetro || editEntry.retroPeriod) : null,
      });
    } else {
      // createdAt은 항상 저장 시점으로 자동 기록됩니다. 사용자가 직접 날짜를 입력할 필요가 없어요.
      await entries.addEntry({
        type: finalType,
        content,
        source,
        author,
        url,
        tags,
        collectionId,
        retroPeriod: finalType === 'retro' ? selectedRetro : null,
      });
    }

    closeModal();
    if (onSavedCallback) onSavedCallback();
  });
}
