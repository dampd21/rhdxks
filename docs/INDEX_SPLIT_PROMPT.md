# INDEX_SPLIT_PROMPT.md
# worker/src/index.js 완전 분리용 프롬프트 — 완전판 갱신본

마지막 업데이트: 2026-05-02  
원본 기준: `worker/INDEX_SPLIT_PROMPT.txt`  
현재 반영: monolith 분리 요구사항 / scheduled 보존 / dynamic route / 성능 개선 / UTF-8 JWT 기준 포함

이 문서는 새 채팅에서 `worker/src/index.js` 전체 원문과 함께 제공하여,
AI가 현재 monolithic Worker를 **기능 축소 없이**, **라우트 호환성을 유지한 채**, **완전한 모듈 구조**로 분리하도록 강제하는 프롬프트 문서입니다.

이 문서는 요약본이 아니라,
새 채팅에서 그대로 붙여넣거나 기준으로 삼아도 될 정도로 **완전한 요구사항**을 담고 있습니다.

---

## 1. 새 채팅에서 AI에게 전달할 기본 지시문

아래에 제공하는 두 자료를 반드시 먼저 읽어라.
1. 현재 실제 `worker/src/index.js` 전체 원문
2. `INDEX_SPLIT_MASTER_PLAN.md`

너의 목표는 현재 monolithic `worker/src/index.js`를 **기능 축소 없이**, **라우트 변경 없이**, **DB/응답 호환성을 유지한 채** 기능별 파일로 완전 분리하는 것이다.

매우 중요:
- 절대 기능을 줄이지 마라.
- 절대 일부 엔드포인트를 TODO로 남기지 마라.
- 절대 “생략”하거나 “나머지는 동일” 같은 방식으로 넘어가지 마라.
- 모든 새 파일은 **전체 코드**로 제공하라.
- 공유 유틸/모듈/라우트 매니페스트/최종 index.js까지 완전한 구조를 제시하라.

---

## 2. 작업 순서 강제 규칙

### [1단계 — 정확한 inventory]
먼저 현재 `index.js` 기준으로 아래를 표 형태로 정리하라.
- 모든 endpoint 목록
- method / path / 담당 기능
- 사용하는 helper 함수
- 의존하는 DB 테이블
- 의존하는 외부 API
- `scheduled()` 작업 목록

이 inventory 없이 바로 코드 분리 시작 금지.

### [2단계 — 최종 구조 설계]
`INDEX_SPLIT_MASTER_PLAN.md`의 구조 철학을 따르되,
실제 index.js에 있는 기능을 기준으로 아래를 확정하라.
- `shared/` 아래 어떤 파일이 필요한지
- `modules/` 아래 어떤 파일이 필요한지
- `routes/manifest` 파일이 필요한지
- 각 파일의 역할
- 레거시 API와 V2 API를 어떻게 공존시킬지

### [3단계 — 파일 생성]
각 파일을 **전체 코드**로 제공하라.
예시:
- `src/shared/http.js`
- `src/shared/time.js`
- `src/shared/auth.js`
- `src/shared/crypto.js`
- `src/shared/snowball.js`
- `src/shared/migrate.js`
- `src/modules/community-api.js`
- `src/modules/community-v2-api.js`
- `src/modules/auth-api.js`
- `src/modules/escrow-api.js`
- `src/modules/rank-api.js`
- `src/routes/manifest.js`
- `src/index.js`

### [4단계 — 호환 유지]
다음 조건을 반드시 지켜라.
- 기존 공개 API 경로 유지
- 기존 응답 필드 유지
- 기존 프론트가 수정 없이 호출 가능해야 함
- JWT UTF-8 안전 인코딩 유지
- dev session 같은 임시 개발 기능도 별도 모듈로 분리하되 동작 유지
- `scheduled()` 누락 금지

### [5단계 — 성능 개선]
반드시 아래를 반영하라.
- request마다 `autoMigrate` 실행하지 않도록 변경
- request마다 schema ensure 실행하지 않도록 변경
- migration/patch는 별도 schema 파일 또는 bootstrap 1회 단계로 이동
- 중복 조회를 줄일 수 있는 부분은 구조적으로 개선
- dynamic route는 regex 또는 matcher 기반으로 처리

### [6단계 — 최종 제공 형식]
최종 응답은 아래 순서를 지켜라.
1. inventory 표
2. 최종 파일 구조 트리
3. 파일별 역할 요약
4. 새 파일 전체 코드들
5. 최종 `src/index.js` 전체 코드
6. schema patch 파일들 전체 코드
7. 적용 순서
8. 테스트 체크리스트

---

## 3. 추가 강제 규칙

### 3.1 코드 제공 규칙
- 코드 블럭은 파일별로 구분해서 제공하라.
- 어떤 파일이 신규 생성인지, 어떤 파일이 기존 교체인지 명확히 적어라.
- import 추가 위치, route 추가 위치 같은 설명도 적어라.
- index.js를 얇게 만들되, 기능은 하나도 빠뜨리지 마라.

### 3.2 경로/응답 규칙
- 기존 레거시 경로 삭제 금지
- V2 경로만 남기는 식으로 끝내지 마라
- 프론트에서 이미 참조하는 key(`posts`, `comments`, `tree`, `rows`, `checkedToday`, `currentStreak`, `snowball`, `total`, `page`, `pageSize`)를 바꾸지 마라

### 3.3 인증/보안 규칙
- `btoa(JSON.stringify(payload))` 같은 UTF-8 unsafe JWT 방식 금지
- 운영 요청 경로에서 schema 변경 금지
- admin/operator 권한 분기 유지
- `/api/dev/session` 같은 개발용 엔드포인트는 분리하되 제거/보호 포인트를 명시하라

### 3.4 추측 금지 규칙
만약 현재 제공된 `index.js`만으로 판단이 불가능한 부분이 있다면,
코드를 추측해서 줄이지 말고 먼저 질문하라.

---

## 4. 새 채팅에서 같이 주면 좋은 추가 문장
아래 문장도 프롬프트 끝에 붙이면 좋다.

> 현재 `index.js` 안의 기능을 하나도 줄이지 말고, inventory부터 작성한 뒤 완전한 파일 구조로 분리해줘.  
> 중략, 생략, TODO 남기기 금지.  
> `scheduled()` handler 보존, dynamic route 지원, UTF-8 safe JWT 유지, request마다 migration 제거를 반드시 반영해줘.

---

## 5. 최종 목적
이 프롬프트의 목적은 AI가 다음과 같은 실수를 하지 못하게 막는 것이다.
- 일부 기능만 분리하고 완료 선언
- 레거시 경로 제거
- 응답 필드 이름 변경
- request마다 migration 유지
- 한글 JWT 깨짐 재발
- `index.js`는 그대로 둔 채 파일만 형식적으로 나누는 수준의 작업

즉, 이 문서는 단순 지시문이 아니라,
**실제 운영 가능한 완전 분리 결과를 얻기 위한 강한 제약 조건 세트**다.
