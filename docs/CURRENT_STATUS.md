# CURRENT_STATUS.md
# Sherpain21 현재 진행 상황 및 작업 기준 — 완전판 갱신본

마지막 업데이트: 2026-05-02

---

## 현재 전체 상태 요약
- Cloudflare Worker 배포 완료
- D1 `sherpa-db` 적용 완료
- Pages 정적 배포 경로로 프론트 테스트/배포 가능
- 탑바는 `topbar-core.js + topbar.js` 구조로 분리 완료
- 상단 메뉴 5개 페이지 레이아웃 통일 작업 완료
- CSS 분리 진행 완료 (`board.css`, `marketplace.css`, `board-editor.css` 추가)
- 커뮤니티 V2 API 설계/프론트 연결 준비 완료
- Worker의 완전한 모듈 분리 설계 문서 준비 완료
- Cloudflare Images 업로드 구조 설계 및 프론트 업로드 호출 추가 완료
- 프로그램 문의 / 고객센터 / 자유홍보 게시판 page형 write/view 전환 시작
- 모집 및 의뢰 상세 페이지(`escrow/view.html`) 추가 및 API 연결 시작

---

## 배포 상태
### Worker
- URL: `https://sherpa-api.sherpain21.workers.dev`
- D1 바인딩: `sherpa-db`
- 상태: 배포 성공
- dev session: 동작 확인됨

### Pages
- 프로젝트: `sherpa-in`
- 정적 배포 방식 사용 가능
- 커스텀 도메인 사용 중: `https://sherpa-in.com`

---

## 현재 프론트 구조 상태
### 공통 CSS
- `frontend/src/css/app.css` — 토큰, 공통 레이아웃, 사이드바, 버튼, 폼, 모달
- `frontend/src/css/topbar.css` — 탑바 전용
- `frontend/src/css/board.css` — 커뮤니티/문의/고객센터 공통
- `frontend/src/css/marketplace.css` — 제휴/홍보/모집/의뢰 공통
- `frontend/src/css/board-editor.css` — 게시판 상세/작성 페이지 공통
- `frontend/src/css/page-shell.css` — 초기 도입 파일, 현재 일부 페이지만 사용하거나 추후 정리 대상

### 공통 JS
- `frontend/src/js/config.js`
- `frontend/src/js/api.js`
- `frontend/src/js/sidebar.js`
- `frontend/src/js/topbar-core.js`
- `frontend/src/js/topbar.js`

### 완료된 페이지 구조 통일
- 커뮤니티
- 프로그램 문의
- 고객센터
- 제휴사 및 자유홍보
- 모집 및 의뢰

### page형 상세/작성 도입 상태
- 커뮤니티: 목록 / 상세(view.html) / 작성(write.html) 구조 도입
- 프로그램 문의: 목록 + page형 write/view 도입
- 고객센터: 목록 + 1:1 문의 write / FAQ/Q&A/1:1 상세 view 도입
- 자유홍보: 목록 + page형 write/view 도입
- 모집 및 의뢰: 목록 + 상세(view.html) 도입

### 특수 페이지
- 플레이스 순위 조회는 예전 구조를 되살린 상태이며, 별도 CSS 분리(`place-rank.css`)는 아직 미완료

---

## 현재 백엔드 상태
### 이미 반영된 것
- 회원가입/로그인/내 정보
- 눈덩이 적립/차감 helper
- 에스크로/미션 기본 API
- 레거시 게시판 API (`/post/*`, `/comment/create`, `/attendance/*`)
- 커뮤니티 V2 분리용 코드 준비 (`worker/src/community-api.js`)
- 커뮤니티용 인덱스 + `post_images` patch 준비 (`worker/schema.community.sql`)
- Cloudflare Images 업로드 endpoint 모듈 준비 (`worker/src/community-images-api.js`)

### 아직 필요한 것
- `index.js`에 커뮤니티 V2 / community-images 모듈을 최종 통합/정리
- 프로그램 문의 / 고객센터 / 자유홍보 / 모집 및 의뢰의 실 API 연결 완성
- post_images를 상세 API에 완전히 연결하고 프론트 렌더 강화
- monolith `index.js` 전면 분리

---

## 현재 우선순위
1. Cloudflare Images 업로드 실제 성공 확인
2. 커뮤니티 이미지 본문/상세 렌더 검증
3. 프로그램 문의 API 연결
4. 고객센터 API 연결
5. 자유홍보 API 연결
6. 모집 및 의뢰 list/detail/apply 흐름 안정화
7. 플레이스 순위 조회 CSS 분리
8. `index.js` 모듈 분리

---

## 주의 사항
- `index.js`는 현재 여전히 monolith 성격이 강함
- request 마다 migration/ensureSchema가 돌지 않도록 반드시 정리 필요
- 프론트는 정적 Pages 배포가 가장 안정적이며, Vite build 경로는 아직 추가 정리 필요
- Cloudflare Images는 `CF_IMAGES_ACCOUNT_ID`에 이메일이 아닌 실제 account id가 들어가야 함
