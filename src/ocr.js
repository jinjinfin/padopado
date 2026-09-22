// 사진(손글씨/인쇄물) 속 텍스트를 브라우저에서 바로 인식합니다 (Tesseract.js, 서버 불필요).
// 언어 모델 파일은 최초 1회만 인터넷에서 내려받고, 이후에는 서비스워커 캐시로 오프라인 재사용됩니다.
const TESS_VERSION = '5.1.1';
const TESS_CDN = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/tesseract.esm.min.js`;

let workerPromise = null;
let loadAttempts = 0;

async function getWorker(onProgress) {
  if (!workerPromise) {
    const importUrl = loadAttempts === 0 ? TESS_CDN : `${TESS_CDN}?retry=${loadAttempts}`;
    loadAttempts += 1;
    workerPromise = (async () => {
      const mod = await import(/* webpackIgnore: true */ importUrl);
      const createWorker = mod.createWorker || mod.default?.createWorker;
      if (!createWorker) {
        throw new Error('OCR 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.');
      }
      const worker = await createWorker('kor+eng', 1, {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            onProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });
      return worker;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

export async function recognizeText(image, onProgress) {
  const worker = await getWorker(onProgress);
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
