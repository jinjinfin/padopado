// 사진(손글씨/인쇄물) 속 텍스트를 브라우저에서 바로 인식합니다 (Tesseract.js, 서버 불필요).
// 언어 모델 파일은 최초 1회만 인터넷에서 내려받고, 이후에는 서비스워커 캐시로 오프라인 재사용됩니다.
const TESS_VERSION = '5.1.1';
const TESS_CDN = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/tesseract.esm.min.js`;

let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import(/* webpackIgnore: true */ TESS_CDN);
      const worker = await createWorker('kor+eng', 1, {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            onProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * 이미지(File/Blob/dataURL)에서 텍스트를 추출합니다.
 * @param {File|Blob|string} image
 * @param {(percent:number)=>void} onProgress
 * @returns {Promise<string>}
 */
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
