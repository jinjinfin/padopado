# 파도파도

책 속 글귀, 강연/회의 인사이트, 웹 링크, 내 생각, 영화·드라마·유튜브, 정기 회고까지
**하나의 흐름으로** 기록하고 검색할 수 있는 개인 아카이브 PWA입니다.

아이폰과 맥북에서 모두 쓸 수 있고, 별도 서버 없이 **GitHub 저장소를 데이터베이스처럼** 사용합니다.

- 정적 파일(앱 화면)은 GitHub Pages로 호스팅 — 이건 **Public 저장소**여야 무료로 됩니다.
- 실제 기록 데이터는 그것과는 **별도의 Private 저장소**에 JSON으로 저장 (GitHub API로 직접 읽고 씀)
- 회고 알림(금요일/월말/분기말/연말)은 GitHub Actions의 예약 실행(cron)이 웹 푸시로 발송
- 손글씨·인쇄물 사진 인식(OCR)은 브라우저 안에서 전부 처리 (Tesseract.js, 서버 불필요)

즉, 이 앱을 위해 따로 결제하거나 운영해야 하는 서버가 없습니다.

> 왜 저장소가 2개일까요? GitHub Free 요금제는 **Public 저장소에서만 Pages(사이트 호스팅)를 무료로 지원**합니다. 그런데 기록 데이터까지 그 저장소에 넣으면, Public 저장소 안 내용은 누구나 볼 수 있으니 개인 기록이 그대로 공개돼버려요. 그래서 앱 코드(공개돼도 상관없는 부분)는 Public 저장소에, 실제 기록은 Private 저장소에 나눠 담습니다. 매달 비용을 내고 싶다면 GitHub Pro 이상으로 올려서 저장소 하나만 Private으로 써도 됩니다.

---

## 1. 저장소 2개 만들고 배포하기

1. GitHub에서 새 저장소 2개를 만듭니다.
   - 앱 코드용 (예: `padopado`) — **Public**
   - 기록 데이터용 (예: `padopado-data`) — **Private**
2. 이 프로젝트 폴더의 내용을 코드용 저장소에 push 합니다.
   ```bash
   cd 압축_푼_폴더
   git init
   git add .
   git commit -m "init: 파도파도"
   git branch -M main
   git remote add origin https://github.com/<내계정>/padopado.git
   git push -u origin main
   ```
   (`.github/workflows/`가 포함되어 있으므로, push용 토큰에는 Contents 권한 외에 **Workflows: Read and write** 권한도 필요합니다.)
3. 코드용 저장소 **Settings → Pages** 에서:
   - Source: `Deploy from a branch`
   - Branch: `main` / `/(root)`
   - 저장하면 몇 분 안에 `https://<내계정>.github.io/padopado/` 주소가 생깁니다.
4. 데이터용 저장소는 push할 파일이 없습니다 — GitHub에서 만들기만 하면 되고, 아래 2번의 토큰과 앱 설정 화면이 그 안에 `data/` 폴더를 알아서 만들어 씁니다.

## 2. GitHub 토큰 발급 (앱이 데이터 저장소에 쓰기 위해 필요)

1. GitHub → 우측 프로필 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access**: **데이터용 저장소만** 선택 (코드용 저장소는 선택하지 않습니다 — 앱 런타임은 데이터 저장소만 건드리면 되니까요)
3. **Permissions → Repository permissions → Contents**: `Read and write` 로 설정 (다른 권한은 전부 No access로 둬도 됩니다)
4. 만료 기간을 설정하고 토큰을 생성 → 생성된 토큰 문자열을 복사해둡니다 (다시 볼 수 없어요)

## 3. 앱에서 연결하기

1. 배포된 주소(코드용 저장소의 Pages 주소)로 접속하면 처음에는 자동으로 **설정** 화면으로 이동합니다.
2. GitHub 사용자명 / **데이터용** 저장소 이름 / 브랜치(`main`) / 방금 만든 토큰을 입력하고 저장
3. "연결 테스트"를 눌러 정상 연결을 확인합니다.
4. 이제 홈 화면 오른쪽 아래 **+** 버튼으로 기록을 시작할 수 있어요.

### 아이폰/맥북에 앱처럼 설치하기 (PWA)

- **아이폰(Safari)**: 배포 주소 접속 → 공유 버튼 → **홈 화면에 추가**
- **맥북(Safari/Chrome)**: 주소창 옆 설치 아이콘 클릭 또는 브라우저 메뉴의 "설치"

홈 화면에 설치해야만 아이폰에서 **진짜 푸시 알림**을 받을 수 있어요 (iOS 16.4+ 필요).

## 4. 회고 알림 켜기 (선택, 무료)

알림은 "이 기기가 알림을 받는다"는 정보를 데이터용 저장소에 등록해두고,
GitHub Actions(코드용 저장소에서 실행)가 정해진 시각에 그 기기로 웹 푸시를 보내는 방식입니다.
워크플로가 코드 저장소와 데이터 저장소를 각각 체크아웃하므로, 데이터 저장소에 접근할
토큰을 **별도로** 하나 더 등록해야 합니다.

1. 로컬에서 (한 번만) VAPID 키를 생성합니다:
   ```bash
   npm install
   npm run generate-vapid-keys
   ```
2. 출력된 **Public Key**를 앱의 설정 화면 → "VAPID 공개키"에 입력하고 저장
3. **데이터용 저장소**에 접근 가능한 Fine-grained 토큰을 하나 더 발급합니다 (2번 단계와 동일한 방법, Contents: Read and write). 이미 만들어둔 앱용 토큰을 그대로 재사용해도 됩니다.
4. **코드용 저장소**(`padopado`) **Settings → Secrets and variables → Actions** 에서:
   - **Variables 탭** → New repository variable: `DATA_REPO` = `<내계정>/padopado-data`
   - **Secrets 탭** → New repository secret 으로 아래 4개를 등록:
     - `DATA_REPO_TOKEN` = 위 3번에서 만든, 데이터 저장소용 토큰
     - `VAPID_PUBLIC_KEY` = 위에서 나온 Public Key
     - `VAPID_PRIVATE_KEY` = 위에서 나온 Private Key
     - `VAPID_SUBJECT` = `mailto:jinryu@see-art.org` (본인 이메일)
5. 앱을 홈 화면에 설치한 뒤, 설정 화면에서 **"알림 켜기"** 버튼을 눌러 알림 권한을 허용합니다.
6. `.github/workflows/retro-reminders.yml` 이 매일 21:00(KST)에 실행되며, 그날이
   금요일 / 월말 / 분기말(3·6·9·12월 말) / 12월 31일 이면 알맞은 회고 알림을 보냅니다.
   Actions 탭에서 "회고 알림 발송" 워크플로를 **Run workflow**로 바로 테스트해볼 수 있어요.

## 5. 기록 방식 안내

- 모든 기록(글귀/인사이트/링크/생각/영상/회고)은 **같은 구조**를 공유합니다. 카테고리는 검색·필터를 위한 가벼운 태그일 뿐, 화면이나 저장 방식이 달라지지 않아요.
- 기록은 텍스트 입력 또는 **사진 촬영 → 자동 글자 인식(OCR)** 두 가지로 남길 수 있습니다. 인식된 글자는 저장 전에 항상 수정할 수 있어요.
- "글귀"로 기록하며 책 제목을, "영상/작품"으로 기록하며 영화·드라마 제목을 입력하면 자동으로 **컬렉션**에 그 작품의 아카이브가 쌓입니다 (책과 영상 작품이 각각 작품 단위로 모여요).
- 회고(주간/월간/분기/연간)는 영감 피드에는 나타나지 않고 회고 탭에서만 다룹니다. 회고를 쓸 때는 그 기간에 쌓인 기록을 "재료"로 함께 펼쳐볼 수 있고, 기간별로 다른 질문 템플릿이 자동으로 채워집니다.
- 모든 기록은 저장 시점의 날짜·시간이 자동으로 기록되고, 목록에서 항상 정확한 기록일자를 확인할 수 있습니다.
- 모든 기록은 검색 가능하며(한글 짧은 키워드 검색 지원), 나중에 관련 키워드로 글을 쓸 때 다시 찾아볼 수 있습니다.
- **대시보드**는 연속 기록일(스트릭), 히트맵, 기록 뱃지, 최근 키워드, 예전 기록 다시 보기 등으로 "내가 잘 기록하고 있다"는 걸 시각적으로 보여줘서 동기부여가 되도록 설계했습니다.

## 6. 오프라인 & 여러 기기

- 기록은 저장하는 즉시 기기 안(IndexedDB)에 남고, 화면에도 바로 보입니다. 인터넷이 없어도 기록은 막히지 않아요.
- 온라인이 되면 자동으로 GitHub에 동기화됩니다 (설정 화면에서 수동 동기화도 가능).
- 아이폰과 맥북 등 여러 기기에서 같은 저장소/토큰으로 연결하면 데이터가 공유됩니다.

## 7. 폴더 구조

```
index.html            앱 진입 화면
manifest.webmanifest  PWA 설치 정보
sw.js                 서비스워커 (오프라인 캐시 + 푸시 수신)
styles.css            전체 스타일
src/                   앱 소스 (프레임워크 없는 순수 JS 모듈)
  config.js            설정/상수
  github.js            GitHub Contents API 클라이언트
  db.js                IndexedDB 로컬 캐시
  entries.js           기록 CRUD + 동기화
  collections.js       컬렉션(책/영상 작품) CRUD
  search.js            클라이언트 전문 검색
  ocr.js               사진→텍스트 인식
  push.js              웹 푸시 구독 관리
  stats.js             동기부여 통계 계산
  ui/                  화면별 렌더링
  vendor/              번들에 포함한 소규모 라이브러리(flexsearch, idb)
scripts/               GitHub Actions에서 실행되는 Node 스크립트
.github/workflows/     회고 알림 예약 실행 설정
```

실제 기록 데이터(`data/entries/YYYY.json`, `data/collections.json`, `data/meta/push-subscriptions.json`)는
이 코드 저장소에는 없습니다 — 앱 설정 화면에 등록한 **별도의 Private 데이터 저장소**에
GitHub API로 직접 생성/저장됩니다 (1장 참고).

## 8. 알려진 제약

- GitHub API 요청은 토큰 하나당 시간당 5,000회 제한이 있습니다. 개인 기록 앱 용도로는 충분히 여유롭습니다.
- 아주 드물게 두 기기에서 거의 동시에 저장하면 한쪽이 자동 재시도로 병합되지만, 흔치 않은 경우이므로 완벽한 실시간 동시 편집을 보장하진 않습니다.
- OCR은 최초 한 번 인터넷에서 인식 모델을 내려받아야 합니다 (몇 MB, 이후엔 캐시되어 오프라인에서도 재사용).
- iOS 웹 푸시는 반드시 "홈 화면에 추가"로 설치된 상태에서만 동작합니다 (Safari 브라우저 탭 상태에서는 불가).
