# FILE_MAP.md
# Sherpain21 프로젝트 파일 구조 및 연결 관계 명세 — 완전판 갱신본

마지막 업데이트: 2026-05-02

---

## 루트 구조
- `docs/` — 최신 문서 폴더
- `frontend/` — 프론트엔드 정적 앱
- `worker/` — Cloudflare Worker / D1 백엔드

---

## frontend/

### package / build
- `frontend/package.json`
  - Vite dev/build, 정적 serve, Pages deploy 스크립트 포함
- `frontend/vite.config.js`
  - MPA 엔트리 설정

### CSS
- `frontend/src/css/app.css`
  - 전역 토큰, 레이아웃, 사이드바, 폼, 버튼, 모달
- `frontend/src/css/topbar.css`
  - 탑바, 드롭다운, 알림/유저/Dev 패널
- `frontend/src/css/board.css`
  - 커뮤니티 / 프로그램 문의 / 고객센터 공통 레이아웃
- `frontend/src/css/marketplace.css`
  - 제휴사 및 자유홍보 / 모집 및 의뢰 공통 레이아웃
- `frontend/src/css/board-editor.css`
  - 커뮤니티 / 문의 / 자유홍보 / 상세/작성 페이지 공통 문서형 레이아웃
- `frontend/src/css/page-shell.css`
  - 초기 공통 쉘 스타일, 일부 페이지에서만 사용 또는 정리 대상

### 공통 JS
- `frontend/src/js/config.js`
  - API URL, 스토리지 키, 공통 유저/탭 helper
- `frontend/src/js/api.js`
  - 커뮤니티/출석체크/에스크로/업로드 중심 API 래퍼
- `frontend/src/js/sidebar.js`
  - 사이드바 렌더 및 접기/펼치기
- `frontend/src/js/topbar-core.js`
  - 탑바 실 구현체 (메뉴, 드롭다운, 알림, Dev)
- `frontend/src/js/topbar.js`
  - topbar-core 로더/초기화 엔트리

### 페이지별 HTML + JS 연결 맵

#### 1. 대시보드
- HTML: `frontend/app/dashboard.html`
- CSS: `app.css`, `topbar.css`, `page-shell.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`

#### 2. 커뮤니티 목록
- HTML: `frontend/app/community/board.html`
- CSS: `app.css`, `topbar.css`, `board.css`
- JS: `config.js`, `api.js`, `sidebar.js`, `topbar.js`, `community.js`
- 탭:
  - `notice`
  - `greeting`
  - `attendance`
  - `free`
  - `share`
  - `logic`

#### 3. 커뮤니티 상세
- HTML: `frontend/app/community/view.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `api.js`, `sidebar.js`, `topbar.js`, `community-view.js`

#### 4. 커뮤니티 작성
- HTML: `frontend/app/community/write.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `api.js`, `sidebar.js`, `topbar.js`, `community-write.js`

#### 5. 플레이스 순위 조회
- HTML: `frontend/app/place/rank.html`
- CSS: `app.css`, `topbar.css` (+ 현재 HTML 내부 style 존재)
- JS: `config.js`, `auth.js`, `api.js`, `sidebar.js`, `topbar.js`, `place-rank.js`
- 상태: 예전 구조 복구본, CSS 완전 분리 미완료

#### 6. 프로그램 문의 목록
- HTML: `frontend/app/support/inquiry.html`
- CSS: `app.css`, `topbar.css`, `board.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `inquiry.js`

#### 7. 프로그램 문의 작성
- HTML: `frontend/app/support/inquiry-write.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `inquiry-write.js`

#### 8. 프로그램 문의 상세
- HTML: `frontend/app/support/inquiry-view.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `inquiry-view.js`

#### 9. 고객센터 목록
- HTML: `frontend/app/support/cs.html`
- CSS: `app.css`, `topbar.css`, `board.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `cs.js`

#### 10. 고객센터 1:1 문의 작성
- HTML: `frontend/app/support/cs-write.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `cs-write.js`

#### 11. 고객센터 상세
- HTML: `frontend/app/support/cs-view.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `cs-view.js`

#### 12. 제휴사 및 자유홍보 목록
- HTML: `frontend/app/partner/services.html`
- CSS: `app.css`, `topbar.css`, `marketplace.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `services.js`
- 탭/섹션:
  - `premium`
  - `promo`

#### 13. 자유홍보 작성
- HTML: `frontend/app/partner/promo-write.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `promo-write.js`

#### 14. 자유홍보 상세
- HTML: `frontend/app/partner/promo-view.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `promo-view.js`

#### 15. 모집 및 의뢰 목록
- HTML: `frontend/app/escrow/missions.html`
- CSS: `app.css`, `topbar.css`, `marketplace.css`
- JS: `config.js`, `sidebar.js`, `topbar.js`, `escrow.js`
- 탭:
  - `recruit`
  - `apply`

#### 16. 모집 및 의뢰 상세
- HTML: `frontend/app/escrow/view.html`
- CSS: `app.css`, `topbar.css`, `board-editor.css`
- JS: `config.js`, `api.js`, `sidebar.js`, `topbar.js`, `escrow-view.js`

### 페이지별 JS 역할
- `frontend/src/js/community.js` — 커뮤니티 목록, 검색, 페이지네이션, 출석체크
- `frontend/src/js/community-view.js` — 커뮤니티 상세, 댓글/대댓글
- `frontend/src/js/community-write.js` — 커뮤니티 작성, 이미지 업로드 연동
- `frontend/src/js/inquiry.js` — 프로그램 문의 목록/검색/페이지네이션
- `frontend/src/js/inquiry-write.js` — 프로그램 문의 작성 page형
- `frontend/src/js/inquiry-view.js` — 프로그램 문의 상세 page형
- `frontend/src/js/cs.js` — 고객센터 FAQ/Q&A/1:1 목록
- `frontend/src/js/cs-write.js` — 고객센터 1:1 문의 작성
- `frontend/src/js/cs-view.js` — 고객센터 상세
- `frontend/src/js/services.js` — 제휴사/자유홍보 목록
- `frontend/src/js/promo-write.js` — 자유홍보 작성
- `frontend/src/js/promo-view.js` — 자유홍보 상세
- `frontend/src/js/escrow.js` — 모집/의뢰 목록, 검색, 등록
- `frontend/src/js/escrow-view.js` — 미션 상세 / 지원
- `frontend/src/js/place-rank.js` — 순위 조회, 추적 관리, 스냅샷/차트

---

## worker/

### 배포 / 스키마
- `worker/wrangler.toml`
  - Worker 이름, D1 바인딩, cron, vars
- `worker/schema.sql`
  - 메인 스키마
- `worker/schema.community.sql`
  - 커뮤니티 인덱스/컬럼 patch + `post_images` 테이블

### 백엔드 코드
- `worker/src/index.js`
  - 현재 monolith 엔트리포인트 (분리 대상)
- `worker/src/community-api.js`
  - 커뮤니티 V2 분리 모듈 준비본
- `worker/src/community-images-api.js`
  - Cloudflare Images 업로드 엔드포인트 모듈 준비본

### 보조 문서
- `worker/COMMUNITY_API_INTEGRATION.md`
- `worker/COMMUNITY_IMAGES_INTEGRATION.md`
- `worker/INDEX_SPLIT_MASTER_PLAN.md`
- `worker/INDEX_SPLIT_PROMPT.txt`

---

## 현재 연결 관계 핵심 요약

### topbar
- 모든 주요 앱 페이지는 `topbar.js`를 공통 로드
- `topbar.js` → `topbar-core.js` 로더/초기화
- `topbar-core.js`가 전체 메뉴/드롭다운/Dev 패널 담당

### sidebar
- 모든 주요 앱 페이지는 `sidebar.js`를 공통 로드
- 현재 사이드바는 기존 메뉴 구조 복구본 기준

### 커뮤니티 API 의존
`community.js`, `community-view.js`, `community-write.js`는 `api.js`의 아래 메서드 사용
- `community.list`
- `community.detail`
- `community.comments`
- `community.create`
- `community.addComment`
- `community.uploadImage`
- `attendance.status`
- `attendance.feed`
- `attendance.checkin`

### 에스크로 API 의존
`escrow.js`, `escrow-view.js`는 `api.js`의 아래 메서드 사용
- `escrow.list`
- `escrow.detail`
- `escrow.create`
- `escrow.apply`
- `escrow.approve`

---

## 정리 포인트
1. 플레이스 순위 조회는 아직 `place-rank.css` 분리 필요
2. Worker는 `index.js` 완전 분리 필요
3. inquiry/cs/services/escrow 프론트는 page형 구조 도입 중이며 실제 API 연결은 단계별 확장 필요
4. Cloudflare Images는 계정 설정값(`CF_IMAGES_ACCOUNT_ID`, `CF_IMAGES_API_TOKEN`) 검증 필요
