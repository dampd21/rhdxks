# SECURITY_GUIDE.md
# [Cloudflare Workers/Node.js] 로컬 마케팅 에스크로 플랫폼 (Sherpain21) 구현 보안 요구사항 명세서 — 완전판 갱신본

마지막 업데이트: 2026-05-02  
원본 기준: Sherpain21 보안 요구사항 명세  
현재 반영: Worker + D1 + Frontend 공용 구조 / Dev Session / UTF-8 Safe JWT / CSS 분리 상태

본 문서는 대표님의 요청에 따라 Sherpain21 플랫폼의 **보안 요구사항(Security Requirements)** 을 정의한 문서입니다.  
새 세션의 AI, 개발자, 유지보수자는 이 문서의 보안 원칙과 구현 방식을 반드시 준수해야 하며,
임시 기능(예: 개발용 세션, 테스트용 지급, 임시 API)을 추가하더라도 **운영 전환 기준에서 어떻게 통제해야 하는지** 함께 고려해야 합니다.

이 문서는 요약본이 아니라,
Sherpain21 플랫폼에서 실제로 지켜야 할 인증/인가/해시/시크릿/로그/마이그레이션/프론트 연동 기준을 포함한 **완전판 갱신 문서**입니다.

---

## 1. 기능 요구사항 (Functional Requirements)

### [기능 1] 이메일/소셜 기반 인증 및 다중 역할(Role) 선택 기반 회원 관리 시스템
- 이메일 회원가입 / 로그인
- 카카오 / 네이버 등 소셜 계정 연계 가능성
- 일반 사용자 / 마케터 / 운영자 역할 분리
- 향후 franchise/enterprise 확장 시 역할 계층 추가 가능

### [기능 2] 10% 수수료 자동 계산 + 눈덩이 예치/정산이 이루어지는 B2B2C 에스크로 시스템
- 모집 및 의뢰 구조
- 예치금 차감
- 승인 시 수행자 정산
- 플랫폼 수수료 분리
- 눈덩이 거래내역 감사 로그 남김

### [기능 3] 외부 크롤링/분석 데이터를 기반으로 한 순위 추적 및 대시보드 제공
- 네이버 플레이스 순위
- 블로그/리뷰/유튜브/키워드/광고 분석
- 외부 프록시 서버(Oracle/Render) 경유 가능
- 외부 API 키/시크릿 분리 필수

### [기능 4] 커뮤니티 / 문의 / 고객센터 / 자유홍보 / 미션과 같은 사용자 참여형 게시판 기능
- 글쓰기
- 목록/검색/페이지네이션
- 댓글/대댓글
- 공지사항 운영자 전용 작성
- 1:1 문의는 작성자 기준 접근 통제 필요

---

## 2. 보안 요구사항 (필수 준수 — OWASP Top 10 기준)

### 2.1 입력 검증 및 Sanitization
- 클라이언트에서 넘어오는 모든 입력은 엄격히 검증해야 한다.
- 문자열은 길이, 허용 문자, 필수 여부를 점검한다.
- HTML/스크립트 삽입 방지를 위해 렌더링 시 escape 처리 또는 sanitization을 적용한다.
- Worker 환경에서는 `innerHTML` 결과를 직접 신뢰하지 않고, 프론트에서 `textContent` 또는 escape helper 사용을 강제한다.

### 2.2 인증 / 인가
- `Authorization: Bearer <JWT>` 헤더 방식을 기본으로 사용한다.
- 인증이 필요한 API는 반드시 `requireAuth()` 검증을 거쳐야 한다.
- 운영자 전용 기능(예: 공지사항 작성, FAQ 관리, 일부 승인 기능)은 role 검증을 추가로 수행해야 한다.
- `optionalAuth()`는 읽기 전용/조건부 기능에서만 사용한다.

### 2.3 환경변수로 민감 정보 관리
- Secret Key, DB ID, 외부 API key, OAuth client secret은 코드에 하드코딩하지 않는다.
- Worker에서는 `wrangler secret` 또는 환경 변수로 주입한다.
- `.env`, `.dev.vars` 는 커밋 금지다.

### 2.4 SQL Injection 방지
- Cloudflare D1 쿼리는 문자열 결합 금지
- 반드시 `db.prepare(...).bind(...)` 방식 사용
- 검색용 LIKE 문은 escape 규칙을 분리하여 처리
- 동적 정렬/컬럼명은 화이트리스트 검증 없이 직접 삽입 금지

### 2.5 XSS 방지
- 프론트 렌더링 시 원칙적으로 `textContent` / escape helper 사용
- 게시글/댓글/문의 내용은 HTML로 직접 렌더링하지 않는다.
- 상세 모달/테이블/드롭다운에 삽입되는 값은 모두 escape된 문자열이어야 한다.
- SVG 아이콘도 사용자 입력과 결합해서 HTML로 조합하지 않는다.

### 2.6 CSRF 보호
- 세션 쿠키 기반보다 JWT 헤더 방식을 우선 사용한다.
- 필요 시 Origin / Referer 검증 추가 가능
- dev session 같은 임시 기능도 운영 환경에서는 제한 필요

### 2.7 Rate Limiting
- 로그인
- dev session
- 글쓰기/댓글/출석체크
- 외부 API 프록시 경로
에 대해 속도 제한이 필요하다.

Cloudflare WAF, Worker 레벨 제어, 또는 KV/메모리 기반 제한 방식을 검토한다.

### 2.8 보안 헤더 설정
API 응답 시 다음 헤더 구성을 고려한다.
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- 적절한 CORS 헤더

### 2.9 비밀번호 해싱
- 평문 저장 금지
- 현재 구조에서는 `SHA-256 + salt/namespace` 방식 사용 중이나,
  향후 가능하다면 `bcrypt` / `argon2` 수준의 강화도 검토 가능
- 비밀번호 검증 로직과 저장 로직은 shared/crypto 계층 분리 권장

### 2.10 에러 핸들링
- DB 스키마 / Stack Trace / 비밀 값이 클라이언트로 노출되면 안 된다.
- 최종 응답은 generic error 형태 유지
- 다만 개발 단계에서는 Worker console에 안전한 수준의 로그를 남긴다.

### 2.11 HTTPS 강제 및 Secure 설정
- Cloudflare DNS/Pages/Workers 환경에서 HTTPS 강제
- 토큰을 쿠키로 전환할 경우 `Secure`, `HttpOnly`, `SameSite` 검토
- 현재 localStorage 방식은 개발 편의는 있으나 XSS 위험 관점에서 한계가 있으므로 운영 보안 설계 시 재검토 대상

### 2.12 CORS 적절히 설정
- 프로덕션에서는 허용 Origin을 엄격히 제한하는 것이 바람직하다.
- 현재 개발 단계에서는 CORS 완화가 있더라도,
  운영 전에는 `sherpa-in.com` 기준으로 정리해야 한다.

---

## 3. 코딩 스타일 (보안 관련)

### 3.1 보안 관련 주석 포함
인증, 해싱, 쿼리문, 예치금 차감 등 보안과 직접 연결된 코드에는 다음과 같은 주석을 권장한다.

```js
// [보안: SQL Injection 방어용 Parameter 바인딩]
// [보안: 운영자 권한 검증 필수]
// [보안: JWT payload UTF-8 safe 인코딩 유지]
```

### 3.2 에러 핸들링 모범 사례
- 모든 async 로직은 top-level try/catch 또는 route-level try/catch 적용
- fetch 라우트 안에서 직접 분기하는 patch route도 반드시 try/catch로 감싼다.
- Cloudflare 기본 500이 그대로 떨어지면 CORS 헤더가 빠질 수 있으므로, `jsonResp` 기반 에러 응답을 유지한다.

### 3.3 로깅 시 민감정보 마스킹
- 비밀번호
- JWT 원문
- 전화번호
- 이메일 전체값
- API 키 / 시크릿
은 console에 그대로 남기지 않는다.

---

## 4. 보안 설정 가이드 및 파일

### 4.1 환경변수 템플릿 예시
```env
JWT_SECRET="강력한_랜덤_시크릿키"
API_VERSION="v1"
NAVER_CLIENT_ID="your_naver_client_id"
NAVER_CLIENT_SECRET="your_naver_client_secret"
KAKAO_REST_API_KEY="your_kakao_rest_api_key"
GROQ_API_KEY="your_groq_api_key"
D1_DATABASE_ID="your_cloudflare_d1_id"
```

### 4.2 `.gitignore` 필수 항목
```gitignore
logs
*.log
npm-debug.log*

pids
*.pid
*.seed
*.pid.lock

.wrangler/
node_modules/

.env
.env.local
.env.production
.dev.vars

dist/
dist-ssr/
build/
```

### 4.3 package 관리 시 주의
- 프론트는 현재 정적 구조 + Vite 혼합 단계
- 운영 전 불필요한 빌드 종속성과 dev 전용 도구를 분리할 필요가 있다.
- 보안 도구를 추가할 때도 실제 배포 구조와 충돌하지 않는지 확인해야 한다.

---

## 5. JWT 보안 기준 (현재 프로젝트에 매우 중요)

### 5.1 반드시 UTF-8 safe 방식 사용
Sherpain21은 사용자 이름/게시판 데이터에 한글이 들어갑니다.  
따라서 아래와 같은 방식은 금지합니다.

```js
btoa(JSON.stringify(payload))
```

이 방식은 `대표님` 같은 문자열에서 다음 에러를 발생시킵니다.

```txt
btoa() can only operate on characters in the Latin1 range.
```

### 5.2 요구사항
- base64url 인코딩은 `TextEncoder` / `TextDecoder` 기반 UTF-8 safe 방식 사용
- sign/verify 둘 다 동일한 규칙을 따라야 함
- dev session, 로그인, 회원가입, 게시글 작성 등 모든 인증 흐름은 이 기준 위에서 동작해야 함

---

## 6. 개발용 세션 (`/api/dev/session`)

### 6.1 목적
- 로컬/개발 테스트에서 빠르게 `sherpa_token` / `sherpa_user` 확보
- 로그인 페이지 완전 연결 전 게시글/댓글/출석체크 테스트 가능하게 함

### 6.2 현재 구조상 주의점
- DevTools 버튼 → `/api/dev/session` 호출
- 응답으로 JWT + admin/pro/기본 눈덩이 지급
- 운영 전에는 반드시 통제 필요

### 6.3 운영 전 처리 선택지
1. 완전 제거
2. IP 제한
3. 관리자 전용 시크릿 교체
4. `ENVIRONMENT !== 'production'` 조건으로 차단

### 6.4 현재 보안 주의
개발 편의를 위해 존재하지만, **운영 환경 노출 시 가장 위험한 엔드포인트 중 하나**입니다.

---

## 7. 게시판 / 커뮤니티 권한 기준

### 7.1 공지사항
- 운영자(admin/operator)만 작성 가능
- 일반 유저는 읽기만 가능

### 7.2 일반 게시판
- 로그인 사용자만 작성
- 게시글 상세/댓글 작성은 인증 필요

### 7.3 댓글/대댓글
- `parentId`가 유효한 부모 댓글인지 서버에서 검증
- 다른 게시글의 댓글을 parent로 참조하는 경우 거부

### 7.4 출석체크
- 하루 1회만 허용
- 중복 출석 방지
- 서버 기준 날짜(KST) 사용

### 7.5 1:1 문의
- 작성자 본인 기준 조회 원칙 필요
- 관리자/운영자 답변 권한 분리 필요

---

## 8. 눈덩이 / 정산 보안 기준

### 8.1 서버 기준 확정
다음은 반드시 서버에서 최종 결정해야 한다.
- 자유홍보 500 눈덩이 차감
- 출석체크 적립
- 에스크로 예치금 차감
- 에스크로 정산 지급
- 테스트 지급/dev session 지급

### 8.2 프론트 값 신뢰 금지
프론트에서 보이는 잔액은 UX용일 뿐이다.  
실제 차감/적립/정산은 Worker + D1 기준으로 확정한다.

### 8.3 감사 로그 필수
모든 주요 증감은 `snowball_transactions`에 로그를 남겨야 한다.

---

## 9. 마이그레이션 / 스키마 보안 기준

### 9.1 운영 요청 경로에서 금지
운영 request path에서 아래를 반복 실행하면 안 된다.
- `ALTER TABLE`
- `CREATE TABLE`
- `CREATE INDEX`
- schema introspection (`PRAGMA table_info` 등)

### 9.2 이유
- 성능 저하
- 예기치 않은 스키마 변경 위험
- 장애 시 분석 어려움
- 운영 트래픽과 migration이 섞이는 문제

### 9.3 현재 프로젝트에서의 의미
- `autoMigrate()`는 장기적으로 bootstrap 1회 또는 수동 실행 구조로 옮겨야 한다.
- 커뮤니티 `ensureSchema()` 류도 request path에서 제거해야 한다.
- `schema.community.sql` 같은 patch 파일을 별도 적용하는 방식이 더 안전하다.

---

## 10. 외부 API / 프록시 보안

### 10.1 Oracle/Proxy
- API key 헤더 사용
- 프록시 URL 하드코딩 여부 점검
- 외부 노출 범위 최소화

### 10.2 Naver / Google / YouTube / AI
- API key를 코드에 직접 박지 않는다.
- 응답 실패 시 민감 데이터 로그 남기지 않는다.
- 외부 API rate limit과 차단 이슈를 고려한 재시도/오류 처리 필요

---

## 11. 간단한 보안 테스트 예시

### 11.1 SQL Injection 테스트
- 로그인 창 아이디에 `' OR '1'='1` 입력 시도
- 기대 결과: bind 처리로 문자열 그대로 인식되어 방어

### 11.2 XSS 테스트
- 게시판 내용에 `<script>alert(1)</script>` 입력 시도
- 기대 결과: escape 처리 또는 text 기반 렌더링으로 스크립트 실행 안 됨

### 11.3 CORS 테스트
- 허용되지 않은 Origin에서 API 요청 시도
- 기대 결과: 적절히 차단 또는 운영 도메인 기준 제한

### 11.4 JWT 조작 테스트
- payload의 role/admin 값을 임의 변경 후 재전송
- 기대 결과: signature 불일치로 401

### 11.5 중복 출석 테스트
- 같은 날 2회 출석 시도
- 기대 결과: 409 / 오늘은 이미 출석했습니다

---

## 12. 현재 구현 반영 메모 (2026-05-02)

### 12.1 프론트 토큰 저장 구조
- `sherpa_token` → localStorage
- `sherpa_user` → localStorage

### 12.2 탑바 Dev 패널
- 테스트 로그인 버튼이 존재
- `/api/dev/session` 호출 가능
- 운영 전 보호 필요

### 12.3 커뮤니티 V2
- `/api/community/*` 경로 설계/프론트 연결 진행 중
- 댓글/대댓글/출석체크 실동작 테스트 단계

### 12.4 Worker 구조
- 현재 monolith `index.js`
- 장기적으로 shared/modules/routes 구조 분리 예정

---

## 13. 최종 선언
보안은 별도 부가 기능이 아니라,
Sherpain21의 인증/눈덩이/에스크로/게시판/프록시/외부 API 구조 전체를 관통하는 기본 규칙입니다.  
따라서 개발 편의, 속도, 임시 패치라는 이유로 아래를 포기하면 안 됩니다.

- 인증 검증
- UTF-8 safe JWT
- bind 기반 쿼리
- 서버 기준 눈덩이 처리
- 운영 요청 경로에서 migration 금지
- dev 기능의 운영 전 보호

이 문서를 기준으로 보안 요구사항은 항상 **기능 구현보다 먼저 검토**되어야 합니다.
