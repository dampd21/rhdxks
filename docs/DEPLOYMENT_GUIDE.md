# DEPLOYMENT_GUIDE.md
# Sherpain21 배포 가이드 (Cloudflare Worker / D1 / Pages) — 완전판 갱신본

마지막 업데이트: 2026-05-02  
원본 기준: Cloudflare Worker + D1 + Pages 배포 절차 문서  
현재 반영: 워크스페이스 최신 구조 / 정적 배포 경로 / 커뮤니티 V2 패치 / dev session 테스트 흐름

이 문서는 Sherpain21 플랫폼을 실제로 배포할 때 필요한 **백엔드(Worker + D1)** 와 **프론트엔드(Pages)** 의 배포 절차를 정리한 문서입니다.  
단순 명령어 목록이 아니라,
- 어떤 파일이 있어야 하는지
- 어떤 순서로 적용해야 하는지
- 현재 어떤 방식이 가장 안정적인지
- 어디에서 자주 실패하는지
까지 포함한 **실무용 완전판 배포 문서**입니다.

이 문서는 새 세션/새 작업자/새 컴퓨터 환경에서도 동일하게 사용할 수 있도록,
현재 프로젝트의 실제 상태를 반영하여 업데이트되었습니다.

---

## 0. 현재 배포 구조 개요

Sherpain21은 아래 구조로 운영됩니다.

### 0.1 백엔드
- Cloudflare Worker
- Cloudflare D1 Database
- 현재 운영 DB: `sherpa-db`
- 현재 Worker URL: `https://sherpa-api.sherpain21.workers.dev`

### 0.2 프론트엔드
- Cloudflare Pages
- 현재 운영 도메인: `https://sherpa-in.com`
- 현재 가장 안정적인 배포 방식: **정적 폴더 전체 배포**

### 0.3 현재 배포 전략
현재 프론트는 Vite dev/build 환경을 갖추고 있으나,
실제 운영/테스트 배포에서는 여전히 **정적 HTML/CSS/JS 구조를 그대로 Pages에 올리는 방식**이 가장 안정적입니다.

즉 현재 기준 권장 배포 명령은 다음입니다.

```bash
wrangler pages deploy frontend --project-name=sherpa-in
```

---

## 1. 배포 전 기본 원칙

### 1.1 공용 파일은 최신 상태인지 먼저 확인한다
배포 전에 아래 파일이 최신본인지 반드시 확인해야 합니다.

#### worker
- `worker/wrangler.toml`
- `worker/schema.sql`
- `worker/schema.community.sql`
- `worker/src/index.js`

#### frontend
- `frontend/package.json`
- `frontend/vite.config.js`
- `frontend/src/css/app.css`
- `frontend/src/css/topbar.css`
- `frontend/src/css/board.css`
- `frontend/src/css/marketplace.css`
- `frontend/src/js/config.js`
- `frontend/src/js/api.js`
- `frontend/src/js/sidebar.js`
- `frontend/src/js/topbar-core.js`
- `frontend/src/js/topbar.js`
- 주요 HTML/페이지별 JS 파일들

### 1.2 DB 스키마와 코드 버전이 맞아야 한다
배포 시 가장 흔한 문제는 아래입니다.
- 코드가 기대하는 컬럼이 D1에 없음
- 예전 DB와 새 Worker가 서로 다른 구조를 보고 있음
- request마다 `autoMigrate()` / `ensureSchema()`가 돌아서 느리거나 불안정함

즉 배포 전에 **스키마가 맞는지** 먼저 확인해야 합니다.

### 1.3 문서 기준으로 작업한다
배포 전 아래 문서를 먼저 읽는 것을 권장합니다.
- `docs/CURRENT_STATUS.md`
- `docs/FILE_MAP.md`
- `docs/SECURITY_GUIDE.md`
- `docs/SHERPAIN21_MASTER_PROMPT.md`

---

## 2. 필수 환경 준비

### 2.1 Node.js / npm
집/작업 컴퓨터에서 먼저 Node.js와 npm이 설치되어 있어야 합니다.

### 2.2 Wrangler
Wrangler 설치 또는 `npx wrangler` 사용이 가능합니다.

권장:
```bash
npm install -g wrangler
```

또는 프로젝트 단위:
```bash
npx wrangler --version
```

### 2.3 Cloudflare 로그인
```bash
wrangler login
```

로그인 후:
- Worker 배포
- Pages 배포
- D1 실행
이 가능해집니다.

---

## 3. D1 데이터베이스 배포/적용

### 3.1 현재 운영 DB 확인
현재 기준 운영 DB는 다음입니다.

- database name: `sherpa-db`
- database id: `af152582-9250-4d97-b6c8-5c402988ec1e`

`wrangler.toml` 의 D1 binding도 이 DB를 가리켜야 합니다.

### 3.2 D1 목록 확인
```bash
wrangler d1 list
```

### 3.3 현재 users 구조 확인 예시
```bash
wrangler d1 execute sherpa-db --remote --command "PRAGMA table_info(users);"
```

이 명령은 배포 전 DB가 코드가 기대하는 구조와 맞는지 확인할 때 유용합니다.

---

## 4. 메인 스키마 적용

### 4.1 메인 schema.sql 적용
```bash
cd worker
wrangler d1 execute sherpa-db --remote --file=./schema.sql
```

### 4.2 적용 대상
이 파일은 기본적으로 다음을 포함합니다.
- users
- stores
- tracks
- snapshots
- snapshot_items
- reviews
- payments
- snowball_transactions
- escrow_missions
- escrow_applications
- posts
- comments
- attendance
- free_promotions

### 4.3 주의
- 기존 테이블이 이미 있으면 `CREATE TABLE IF NOT EXISTS` 는 구조를 바꾸지 않습니다.
- 따라서 필요한 컬럼 추가는 별도 patch 또는 migration이 필요할 수 있습니다.

---

## 5. 커뮤니티 패치 적용

### 5.1 schema.community.sql 적용
커뮤니티 V2 관련 인덱스 및 attendance 확장을 위해 아래를 적용합니다.

```bash
cd worker
wrangler d1 execute sherpa-db --remote --file=./schema.community.sql
```

### 5.2 현재 patch 목적
- posts 검색/정렬 인덱스
- comments thread 인덱스
- attendance 피드 인덱스

### 5.3 attendance.message 컬럼
현재 커뮤니티 출석 피드는 `attendance.message` 컬럼을 사용합니다.

상황에 따라 수동 패치가 필요할 수 있습니다.

```bash
wrangler d1 execute sherpa-db --remote --command "ALTER TABLE attendance ADD COLUMN message TEXT;"
```

> 이미 컬럼이 있으면 에러가 날 수 있으나, 그 경우는 무시해도 됩니다.

---

## 6. Worker 배포

### 6.1 기본 배포
```bash
cd worker
wrangler deploy
```

### 6.2 현재 Worker가 제공하는 대표 기능
- 인증
- 플레이스 순위/프록시
- 트래커
- 키워드/광고/트렌드
- 에스크로
- 레거시 게시판/출석
- 커뮤니티 V2 패치 경로
- 개발용 dev session (적용한 경우)

### 6.3 배포 후 꼭 확인할 것
- `https://sherpa-api.sherpain21.workers.dev/health`
- 커뮤니티 목록 API
- dev session API
- 플레이스 순위 API

---

## 7. Frontend 개발 서버 실행

### 7.1 설치
```bash
cd frontend
npm install
```

### 7.2 Vite dev
```bash
npm run dev
```

현재 기본 포트 예시:
- `http://localhost:4173/`

### 7.3 정적 serve
필요 시:
```bash
npm run serve
```

---

## 8. Frontend 빌드

### 8.1 build
```bash
cd frontend
npm run build
```

### 8.2 주의
현재 프론트는 정적 배포가 가장 안정적이며,
Vite build 경로는 아직 추가 점검이 필요할 수 있습니다.

특히 주의할 수 있는 문제:
- 엔트리 HTML 누락
- 일반 script와 module 구조 혼합
- 일부 특수 페이지의 inline style / 경로 이슈

즉, build가 성공하더라도 실제 운영에서는 **정적 Pages 배포**를 우선 권장합니다.

---

## 9. Frontend Pages 배포

### 9.1 현재 가장 안정적인 방식 (권장)
```bash
cd C:\Sherpa-in.com
wrangler pages deploy frontend --project-name=sherpa-in
```

이 방식은 `frontend` 폴더 전체를 Pages에 그대로 올립니다.

### 9.2 build 후 dist 배포 (선택)
```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name=sherpa-in
```

### 9.3 언제 어떤 방식을 쓰나
#### 정적 폴더 배포 권장 상황
- HTML/CSS/JS를 직접 수정하며 빠르게 테스트할 때
- 현재처럼 혼합 구조가 남아 있을 때
- build pipeline이 아직 완전히 정리되지 않았을 때

#### dist 배포 권장 상황
- build가 안정화되었을 때
- 자산 정리/압축/경로 통제를 강화하고 싶을 때

---

## 10. 현재 package.json / vite.config.js 기준

### 10.1 package.json
현재 프론트는 아래 스크립트를 가질 수 있습니다.
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run serve`
- `npm run deploy`
- `npm run deploy:build`

### 10.2 vite.config.js
현재는 주요 내부 앱 페이지를 MPA 엔트리로 지정하는 방식입니다.
다만 실제 배포는 정적 Pages 경로가 더 안정적입니다.

---

## 11. 배포 후 기능 확인 체크리스트

### 11.1 Worker
- `/health` 응답 확인
- `/api/dev/session` 응답 확인
- `/api/community/posts` 응답 확인
- `/api/community/attendance/feed` 응답 확인

### 11.2 Frontend 주요 페이지
- `/app/dashboard.html`
- `/app/community/board.html?tab=notice`
- `/app/place/rank.html`
- `/app/support/inquiry.html?tab=usage`
- `/app/support/cs.html?tab=faq`
- `/app/partner/services.html#premium`
- `/app/escrow/missions.html?tab=recruit`

### 11.3 UI 체크포인트
- 탑바 라인과 사이드바 상단 경계선 정렬
- 폰트 통일
- 플레이스 순위 조회 탑바 깨짐 여부
- 커뮤니티 글쓰기/상세/댓글/출석체크

---

## 12. 자주 발생하는 에러와 대응

### 12.1 SQL file not found
```txt
Unable to read SQL text file
```
원인:
- 로컬에 `schema.community.sql` 파일이 없음

해결:
- 파일 생성 후 재실행

### 12.2 no such column
```txt
no such column: provider
```
원인:
- DB 스키마와 코드 버전 불일치

해결:
- 올바른 D1에 메인 schema 재적용
- 필요한 patch 적용

### 12.3 btoa Latin1 error
```txt
btoa() can only operate on characters in the Latin1 range
```
원인:
- JWT payload 안 한글 처리 실패

해결:
- UTF-8 safe base64url 인코딩으로 교체

### 12.4 CORS처럼 보이는 500
```txt
No 'Access-Control-Allow-Origin' header...
```
원인:
- 실제 Worker 내부 500
- jsonResp로 감싸지 않은 route

해결:
- route-level try/catch 추가
- 실제 500 원인 파악

### 12.5 Unauthorized
원인:
- `sherpa_token` 없음

해결:
- 정식 로그인
- 또는 dev session 발급

---

## 13. 성능 관련 주의
현재 Worker는 구조상 다음이 성능 저하를 유발할 수 있습니다.
- request마다 `autoMigrate()`
- request마다 schema ensure
- monolith `index.js`

즉 배포는 되더라도 운영 최적화를 위해서는 반드시:
1. migration 1회화
2. `index.js` 모듈 분리
3. 중복 조회 최소화
를 해야 합니다.

---

## 14. 개발/테스트용 기능 주의
### Dev Session
- `/api/dev/session` 은 개발용
- 운영 전 제거 또는 보호 필요

### DevTools 버튼
- 프론트 탑바에서 테스트 로그인/플랜/눈덩이 조정 가능
- 운영 배포 전 통제 필요

---

## 15. 현재 가장 안정적인 운영 순서
1. 로컬 수정
2. 관련 schema patch 적용
3. Worker deploy
4. Frontend Pages deploy
5. 브라우저에서 기능 점검
6. 문제가 있으면 즉시 로그 확인 후 hotfix

---

## 16. 최종 선언
Sherpain21 배포는 단순히 파일을 올리는 작업이 아니라,
- D1 스키마
- Worker 라우트
- 프론트 정적 구조
- 탑바/사이드바 공통 레이아웃
- 커뮤니티/문의/홍보/미션 기능
이 모두 함께 맞아야 안정적으로 동작합니다.

따라서 배포는 반드시:
- 최신 파일 확인
- DB patch 확인
- Worker deploy
- Frontend deploy
- 실제 페이지/기능 점검
순으로 진행해야 합니다.
