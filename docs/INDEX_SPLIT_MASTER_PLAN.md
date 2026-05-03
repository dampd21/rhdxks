# INDEX_SPLIT_MASTER_PLAN.md
# worker/src/index.js 완전 분리 마스터 설계 문서 — 완전판 갱신본

마지막 업데이트: 2026-05-02  
원본 기준: `worker/INDEX_SPLIT_MASTER_PLAN.md`  
현재 반영: Worker monolith 구조 / 커뮤니티 V2 patch / dev session / UTF-8 safe JWT / 성능 이슈 반영

이 문서는 현재 `worker/src/index.js` 에 몰려 있는 모든 기능을 **기능 축소 없이**, **라우트 변경 없이**, **운영 중인 동작을 유지한 채** 도메인별 모듈로 분리하기 위한 마스터 설계 문서다.

이 문서는 새 채팅에서 `index.js` 원본과 함께 제공되어,
AI가 **추측 없이 현재 monolith를 정확히 해체**하고,
**완전한 모듈 구조**로 재조립하도록 안내하는 기준 문서다.

또한 현재 프로젝트에서 실제로 발생했던 문제들,
예를 들어:
- request마다 migration 실행으로 인한 체감 성능 저하
- patch route의 try/catch 누락
- JWT 한글 payload 인코딩 실패
- dev session / community V2 / legacy route 공존
등을 반영하여,
단순 파일 쪼개기가 아니라 **운영 가능한 완전 분리 방향**을 제시한다.

---

## 1. 최우선 원칙

### 1.1 기능 축소 금지
- 현재 `index.js`가 제공하는 모든 기능을 유지한다.
- 엔드포인트, 응답 필드, 주요 에러 메시지, 인증 방식, D1 접근 로직을 함부로 바꾸지 않는다.
- “일단 일부만 분리” 같은 방식으로 완료 선언하지 않는다.
- 커뮤니티만 분리하고 나머지는 TODO로 남기지 않는다.

### 1.2 공개 API 경로 유지
- 현재 외부 프론트엔드가 사용하는 경로는 **그대로 유지**한다.
- 경로명을 REST 스타일로 바꾸고 싶어도 기존 프론트와 연결된 경로는 호환 계층 없이 바꾸지 않는다.
- 레거시 경로와 V2 경로는 공존 가능하도록 유지한다.

### 1.3 응답 스키마 유지
- `ok`, `error`, `user`, `token`, `missions`, `posts`, `timeline`, `snapshot`, `transactions`, `snowball` 등 기존 응답 필드를 유지한다.
- 프론트가 참조하는 키 이름은 바꾸지 않는다.
- 커뮤니티 댓글 응답의 `comments`, `tree`, 출석 응답의 `checkedToday`, `currentStreak`, `rows` 등도 유지한다.

### 1.4 점진적 분리보다 최종 구조 기준 설계 우선
- 파일을 임시로 나누는 수준이 아니라,
  최종 구조를 기준으로 한 번에 완성형에 가깝게 분리해야 한다.
- 다만 실제 코드 이동 순서는 안전하게 진행한다.

### 1.5 index.js는 얇게
최종 `worker/src/index.js` 는 아래 역할만 담당한다.
- CORS / bootstrap
- env / db 초기화
- 공통 migration 1회 호출
- route registration / dispatch
- global try/catch
- `scheduled()` handler

즉, **비즈니스 로직은 index.js 안에 남기지 않는다.**

---

## 2. 현재 monolith에서 반드시 보존해야 할 도메인
새 채팅에서는 반드시 실제 `index.js` 전체를 다시 읽고 inventory를 작성해야 하며,
아래 도메인 누락 없이 모듈로 나눠야 한다.

### A. 공통 인프라
- CORS helpers
- JSON response helpers
- sleep / time helpers
- UUID helpers
- base64 helpers
- KST helpers
- global health endpoint
- auto migration
- cleanup / 유지보수 helper

### B. 인증/보안
- JWT sign / verify
- optionalAuth / requireAuth
- password hash helpers
- login / signup / me
- dev session
- UTF-8 safe JWT 인코딩/디코딩

### C. 사용자/눈덩이
- snowball balance helpers
- add / deduct helpers
- 거래내역 조회
- dashboard stats
- 사용자 프로필/플랜/잔액 응답

### D. 커뮤니티 / 게시판
- posts 목록
- posts 상세
- comment 목록/작성
- attendance 상태/피드/체크인
- 공지사항 운영자 권한
- 대댓글(parentId) 구조
- 레거시 `/post/*`, `/comment/create`, `/attendance/*`
- V2 `/api/community/*`

### E. 고객지원/문의
- inquiry 게시판
- cs FAQ
- cs Q&A
- cs 1:1 ticket

### F. 자유홍보 / 파트너
- free promotions
- partner / partner companies

### G. 에스크로/미션
- mission create/list/detail
- apply/approve
- payout / 상태 전환
- 예치금/수수료 helper

### H. 플레이스/순위/트래커
- GraphQL payload builders
- proxy/oracle route
- rank/place
- rank/proxy
- track create/list/delete
- collect / timeline / snapshot
- cleanup old snapshots

### I. 플레이스 상세/키워드/테마/리뷰
- place detail
- detail gql
- keywords
- themes
- reviews

### J. 리뷰 대시보드 / 외부 분석
- review dashboard
- 관련 GraphQL parsing

### K. 광고/키워드/데이터랩/트렌드
- keyword volume
- ad analyze
- datalab trend
- google trends

### L. 기타 도메인
실제 `index.js`에 존재하는 경우 모두 보존
- youtube
- parking
- biz collect
- blog ai
- payment
- admin
- land proxy
- puppeteer proxy
- smartplace
- 기타 외부 API

---

## 3. 반드시 추가 반영해야 하는 현재 프로젝트 전용 조건

### 3.1 `scheduled()` / cron 보존 필수
현재 Worker는 cron trigger를 사용할 수 있으며,
cleanup / 자동 수집과 관련된 로직이 있을 수 있다.
따라서 분리 후에도:
- `export default { fetch, scheduled }`
구조를 유지해야 하며,
`scheduled()` 로직을 누락하면 안 된다.

### 3.2 route manifest는 dynamic path 지원 필수
커뮤니티 V2처럼 동적 경로가 이미 존재한다.

예:
- `/api/community/posts/:id`
- `/api/community/posts/:id/comments`

따라서 manifest는 단순 `path === pathname` 비교만으로는 안 되고,
반드시 아래 둘 중 하나를 지원해야 한다.
- regex pattern
- path matcher 함수

### 3.3 레거시 경로 + V2 경로 동시 유지
현재 프로젝트는 다음 두 층을 동시에 가진다.

#### 레거시
- `/post/list`
- `/post/detail`
- `/post/create`
- `/comment/create`
- `/attendance/check`
- `/attendance/status`

#### V2
- `/api/community/posts`
- `/api/community/posts/:id`
- `/api/community/posts/:id/comments`
- `/api/community/attendance/*`

분리 작업 중 어떤 경로도 임의 제거 금지.

### 3.4 request path에서 migration 금지
현재 체감 속도 이슈의 주요 원인 중 하나는:
- request마다 `autoMigrate()`
- request마다 `ensureSchema()`
가 도는 구조다.

최종 구조에서는:
- deploy/manual migration
- bootstrap 1회 migration
만 허용하고,
운영 요청 경로에서는 schema 변경/점검을 제거해야 한다.

### 3.5 UTF-8 safe JWT 필수
현재 프로젝트는 한글 payload(`대표님`)를 실제로 사용한다.  
따라서 다음 방식은 금지한다.
```js
btoa(JSON.stringify(payload))
```

최종 shared/auth.js 는 반드시 UTF-8 safe base64url 방식 사용.

### 3.6 프론트 응답 key 호환 유지
현재 프론트는 이미 다음 필드들을 기대한다.
- `posts`
- `comments`
- `tree`
- `rows`
- `checkedToday`
- `currentStreak`
- `snowball`
- `total`, `page`, `pageSize`

이 응답 key들은 분리 중에도 유지해야 한다.

---

## 4. 목표 디렉토리 구조

아래는 권장 최종 구조다.

```text
worker/
  schema.sql
  schema.community.sql
  wrangler.toml
  src/
    index.js
    shared/
      constants.js
      http.js
      time.js
      ids.js
      text.js
      auth.js
      crypto.js
      snowball.js
      migrate.js
      db.js
      errors.js
      naver-gql.js
      naver-ad.js
      place-html.js
      review-phrases.js
      biz.js
      community.js
    modules/
      health-api.js
      auth-api.js
      dev-api.js
      community-api.js
      community-v2-api.js
      inquiry-api.js
      cs-api.js
      promo-api.js
      partner-api.js
      escrow-api.js
      dashboard-api.js
      snowball-api.js
      rank-api.js
      tracker-api.js
      place-api.js
      review-api.js
      keyword-api.js
      ad-api.js
      trends-api.js
      youtube-api.js
      ai-api.js
      land-api.js
      biz-api.js
      puppeteer-api.js
      smartplace-api.js
      payment-api.js
      admin-api.js
    routes/
      manifest.js
```

---

## 5. 파일 역할 정의

### 5.1 `src/index.js`
최소 역할만 수행한다.
- imports
- env/db 존재 확인
- 1회 migration bootstrap
- routes 생성 및 dispatch
- fallback 404
- top-level fetch error handling
- scheduled handler

### 5.2 `src/shared/http.js`
- `corsHeaders`
- `jsonResp`
- 필요 시 text/binary 응답 헬퍼

### 5.3 `src/shared/time.js`
- `kstDateString`
- `kstNowString`
- `sleep`
- 날짜 계산 유틸

### 5.4 `src/shared/ids.js`
- `uuid`

### 5.5 `src/shared/auth.js`
- `signJWT`
- `verifyJWT`
- `optionalAuth`
- `requireAuth`
- `issueUserToken`

### 5.6 `src/shared/crypto.js`
- `sha256Hex`
- `hashPassword`
- base64url UTF-8 encode/decode

### 5.7 `src/shared/snowball.js`
- `getSnowballBalance`
- `addSnowball`
- `deductSnowball`

### 5.8 `src/shared/migrate.js`
- `autoMigrate`
- bootstrap에서만 실행
- request path에서 직접 호출 금지

### 5.9 `src/shared/community.js`
- `toInt`
- `scope normalize`
- `postIdFromPath`
- `commentTree`
- `isAdmin`
등 커뮤니티 도메인 공통 유틸

### 5.10 도메인 API 파일들
각 모듈은 해당 도메인의 route handler만 포함한다.

예:
- `community-v2-api.js` → `/api/community/*`
- `community-api.js` → 레거시 `/post/*`, `/comment/create`, `/attendance/*`
- `dev-api.js` → `/api/dev/session`

---

## 6. route registration 원칙
`index.js` 안의 route 배열 또는 manifest는 각 모듈에서 export된 handler를 연결만 한다.

예시 개념:

```js
import { createCommunityV2Routes } from './modules/community-v2-api.js';
import { createAuthRoutes } from './modules/auth-api.js';

const routes = [
  ...createAuthRoutes(deps),
  ...createCommunityV2Routes(deps),
  ...createEscrowRoutes(deps),
];
```

또는 manifest 단일 파일:

```js
export function createRoutes(deps) {
  return [
    ...authRoutes(deps),
    ...communityRoutes(deps),
    ...rankRoutes(deps),
  ];
}
```

### 중요
- exact path + regex/dynamic path 둘 다 지원
- `if (pathname === ...)` 대량 유지 금지
- 단, 기존 공개 경로는 그대로 유지

---

## 7. 분리 순서 (안전한 실전 절차)

### 7.1 1단계 — 실제 index.js inventory 작성
반드시 먼저 작성해야 할 것:
- 모든 endpoint 목록
- 각 endpoint가 사용하는 helper
- 외부 API 사용 목록
- DB table/column 의존성
- scheduled 작업 목록

### 7.2 2단계 — shared layer 추출
우선 아래 공통 함수 이동:
- http helpers
- JWT helpers
- password/hash helpers
- UUID
- time helpers
- snowball helpers
- migrate helpers

### 7.3 3단계 — low-risk module부터 분리
권장 순서:
1. health
2. auth
3. dev session
4. community legacy
5. community v2
6. dashboard/snowball
7. escrow
8. rank/tracker
9. place/review/keyword/ad/trends
10. 기타 도메인

### 7.4 4단계 — route manifest 도입
- 기존 `index.js` route 분기 제거
- manifest 기반 dispatch 도입
- 기존 경로 100% 동일 보장

### 7.5 5단계 — dead code 정리
- 더 이상 사용하지 않는 patch helper 제거
- 레거시/신규 helper 중복 제거
- request마다 migration 남아있는지 점검

---

## 8. 커뮤니티/게시판 특별 원칙

### 8.1 API 유지
- `/api/community/posts`
- `/api/community/posts/:id`
- `/api/community/posts/:id/comments`
- `/api/community/attendance/status`
- `/api/community/attendance/feed`
- `/api/community/attendance/checkin`
- `/api/dev/session`

### 8.2 권한 유지
- `notice` 카테고리 운영자 전용
- 나머지 커뮤니티 카테고리 일반 사용자 작성 가능

### 8.3 댓글 구조 유지
- `parentId` 기반 대댓글
- flat + tree 응답 구조 유지 가능

### 8.4 출석체크 유지
- 하루 1회 제한
- KST 기준
- 연속 출석일 기반 보상
- `attendance.message` 유지

---

## 9. 성능 개선 원칙

### 반드시 개선할 것
1. request마다 실행되는 `autoMigrate` 제거 또는 development 전용화
2. request마다 실행되는 schema ensure 제거
3. 공통 쿼리 인덱스 확정 적용
4. 상세/댓글 2번 호출을 1번으로 묶을 수 있는지 검토
5. route lookup 단순화
6. patch route도 try/catch 보장

### 절대 하지 말 것
- 운영 요청 경로에서 `ALTER TABLE` 반복 실행
- 운영 요청 경로에서 `CREATE INDEX IF NOT EXISTS` 반복 실행
- request마다 대규모 `PRAGMA table_info` 반복 수행

---

## 10. 새 채팅의 AI가 반드시 지켜야 할 작업 규칙

### 10.1 전체 코드 제공
- 모든 새 파일은 전체 코드로 제공
- “생략”, “동일”, “나머지 동일” 금지

### 10.2 index.js 최종 완성본 제공
- 최종 구조 안정화 후 최종 `src/index.js` 전체 제공
- 단, 길면 단계별 제공 후 최종본까지 반드시 도달

### 10.3 파일별 수정 위치 설명
각 파일마다 반드시 설명:
- 신규 생성 / 기존 교체 여부
- import 추가 위치
- route 추가 위치
- 레거시 제거 가능 지점

### 10.4 기능 축소 금지
- 일부 도메인만 남기고 끝내지 말 것
- 실제 제공받은 `index.js` 안 기능 모두 inventory 후 대응

### 10.5 임시 기능 분리
- `/api/dev/session` 같은 임시 기능은 별도 모듈로 분리
- 운영 전 제거/보호 포인트 문서화

---

## 11. 검증 체크리스트

### API 호환
- 기존 경로 유지
- 기존 응답 필드 유지
- 프론트 수정 없이 동작 가능

### 보안
- JWT UTF-8 safe
- unauthorized 정상
- admin 전용 기능 권한 유지

### DB
- 기존 schema와 충돌 없음
- 추가 인덱스/컬럼은 schema patch 또는 migration 파일로 관리
- 운영 요청 경로에서 schema 변경 없음

### 성능
- autoMigrate 요청 반복 제거
- ensureSchema 제거
- 중복 API 호출 최소화

### 프론트 영향
- 커뮤니티/문의/고객센터/홍보/모집 페이지가 그대로 연동 가능
- dev session 기반 테스트 유지 가능

### scheduled
- cron/scheduled 누락 없음

---

## 12. 최종 산출물 목록
새 채팅에서 최종적으로 받아야 하는 결과물:
1. endpoint inventory 문서
2. shared layer 전체 파일들
3. modules layer 전체 파일들
4. route manifest 전체 파일
5. 최종 index.js 전체 파일
6. schema patch 파일들 전체 코드
7. 적용 순서 문서
8. 테스트 체크리스트 문서

---

## 13. 새 채팅에서 이 문서를 사용하는 방법
1. 현재 실제 `worker/src/index.js` 전체를 AI에게 제공한다.
2. 이 `INDEX_SPLIT_MASTER_PLAN.md` 를 함께 제공한다.
3. `INDEX_SPLIT_PROMPT.md` 또는 원문 프롬프트를 함께 제공한다.
4. AI가 먼저 inventory를 작성하도록 한다.
5. 기능 축소 없이 전체 파일 단위로 분리 작업을 진행하게 한다.

---

## 14. 최종 선언
이 문서는 단순한 권장사항이 아니라,
현재 Sherpain21 Worker 구조를 **기능 축소 없이 해체하고 재조립하기 위한 기준 설계 문서**입니다.

이 문서 없이 `index.js`를 임의로 쪼개거나,
일부 도메인만 빼내는 방식으로 구조를 바꾸면
향후 프론트/배포/API 호환성에 심각한 문제가 발생할 수 있습니다.

따라서 Worker 분리 작업은 반드시 이 문서를 기준으로 진행해야 합니다.
