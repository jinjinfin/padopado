// 사진(손글씨/인쇄물) 속 텍스트를 브라우저에서 바로 인식합니다 (Tesseract.js, 서버 불필요).
// 언어 모델 파일은 최초 1회만 인터넷에서 내려받고, 이후에는 서비스워커 캐시로 오프라인 재사용됩니다.
const TESS_VERSION = '5.1.1';
const TESS_CDN = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/tesseract.esm.min.js`;

// 기본 언어는 한국어 단독입니다. Tesseract는 여러 언어를 섞어서(kor+eng)
// 인식시키면 애매한 글자를 영어 사전 쪽으로 잘못 끌어당기는 경우가 많아서,
// "한국어가 기본이 아닌 것처럼" 느껴질 정도로 한글 인식률이 떨어질 수 있습니다.
// 그래서 평소엔 한국어만 쓰고, 사진에 영어도 섞여 있을 때만 사용자가 직접
// 켤 수 있게 합니다 (capture.js의 "영어도 섞여 있어요" 체크박스).
const DEFAULT_LANG = 'kor';

let workerPromise = null;
let currentLang = null;
// 같은 페이지가 열려 있는 동안 몇 번째 시도인지 셉니다. 브라우저는 특정 URL의
// import()가 한 번 실패(네트워크 오류 등)하면 그 실패 자체를 내부적으로 캐싱해서,
// 완전히 같은 URL로 다시 import()해도 재요청 없이 곧바로 같은 실패를 돌려줍니다
// (새로고침 전까지는 절대 재시도가 안 됨 — 아래 loadAttempts가 이걸 우회하는 이유).
let loadAttempts = 0;

async function createFreshWorker(lang, onProgress) {
  // 첫 시도는 캐시(서비스워커의 CDN 캐시 포함)를 그대로 타도록 물음표 없는 원래
  // 주소를 쓰고, 이전 시도가 실패했을 때만 매번 다른 쿼리스트링을 붙입니다.
  // 이렇게 해야 브라우저가 "이 URL은 이미 실패한 적 있다"며 재요청 자체를
  // 건너뛰지 않고, 진짜로 네트워크에 다시 물어봅니다.
  const importUrl = loadAttempts === 0 ? TESS_CDN : `${TESS_CDN}?retry=${loadAttempts}`;
  loadAttempts += 1;
  // 이 CDN 빌드(tesseract.esm.min.js)는 named export가 아니라 default export
  // 하나에 createWorker 등 API를 전부 묶어서 내보냅니다. `const { createWorker } =
  // await import(...)`처럼 바로 구조분해하면 항상 undefined가 되어
  // "createWorker is not a function" 에러가 나므로, default를 먼저 꺼내야 합니다.
  const mod = await import(/* webpackIgnore: true */ importUrl);
  const createWorker = mod.createWorker || mod.default?.createWorker;
  if (!createWorker) {
    throw new Error('OCR 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.');
  }
  return createWorker(lang, 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });
}

async function getWorker(onProgress, lang) {
  if (!workerPromise) {
    workerPromise = createFreshWorker(lang, onProgress);
    currentLang = lang;
    // 위 과정 중 하나라도 실패하면(네트워크 문제, CDN 응답 형태 문제 등) workerPromise에
    // "실패한 약속"이 그대로 남아버립니다. 그러면 이 if문의 `!workerPromise` 검사가
    // 더 이상 통과하지 않아서, 페이지를 새로고침하기 전까지는 다시 시도조차 할 수 없게
    // 됩니다 (한 번 실패하면 그 세션 내내 OCR이 영구적으로 고장). 그래서 실패 시엔
    // workerPromise를 다시 비워서, 다음번 recognizeText() 호출이 처음부터 재시도할 수
    // 있게 합니다.
    workerPromise.catch(() => {
      workerPromise = null;
      currentLang = null;
    });
    return workerPromise;
  }
  const worker = await workerPromise;
  // 이미 만들어둔 워커가 있지만 요청한 언어가 다르면(예: 한국어만 쓰다가 이번
  // 사진엔 "영어도 섞여 있어요"를 체크한 경우), 워커를 새로 만들지 않고
  // reinitialize로 언어만 바꿔서 재사용합니다.
  if (lang !== currentLang) {
    await worker.reinitialize(lang);
    currentLang = lang;
  }
  return worker;
}

/**
 * 이미지(File/Blob/dataURL)에서 텍스트를 추출합니다.
 * @param {File|Blob|string} image
 * @param {(percent:number)=>void} onProgress
 * @param {string} lang - Tesseract 언어 코드. 기본은 한국어 단독('kor').
 *   영어가 섞인 사진이면 'kor+eng'를 넘겨주세요.
 * @returns {Promise<string>}
 */
export async function recognizeText(image, onProgress, lang = DEFAULT_LANG) {
  const worker = await getWorker(onProgress, lang);
  const { data } = await worker.recognize(image);
  return (data.text || '').trim();
}

export async function terminateWorker() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
