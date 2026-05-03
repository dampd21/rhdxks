# COMMUNITY API INTEGRATION GUIDE

이 파일은 `worker/src/community-api.js` 를 기존 monolithic `worker/src/index.js` 에 붙이는 최소 가이드입니다.

## 1. import 추가
`worker/src/index.js` 상단에 추가:

```js
import { createCommunityModule } from './community-api.js';
```

## 2. 모듈 생성
유틸 함수(`jsonResp`, `requireAuth`, `kstDateString`, `kstNowString`, `addSnowball`) 선언 이후 아래 추가:

```js
const communityModule = createCommunityModule({
  jsonResp,
  requireAuth,
  kstDateString,
  kstNowString,
  addSnowball,
});
```

## 3. 라우팅 추가
fetch handler 안 `pathname` 분기 위치에 아래 추가:

```js
if (pathname === '/api/community/posts' && request.method === 'GET') {
  return communityModule.handlePostList(request, env);
}

if (pathname === '/api/community/posts' && request.method === 'POST') {
  return communityModule.handlePostCreate(request, env);
}

if (/^\/api\/community\/posts\/\d+$/.test(pathname) && request.method === 'GET') {
  return communityModule.handlePostDetail(request, env, pathname);
}

if (/^\/api\/community\/posts\/\d+\/comments$/.test(pathname) && request.method === 'GET') {
  return communityModule.handleCommentList(request, env, pathname);
}

if (/^\/api\/community\/posts\/\d+\/comments$/.test(pathname) && request.method === 'POST') {
  return communityModule.handleCommentCreate(request, env, pathname);
}

if (pathname === '/api/community/attendance/status' && request.method === 'GET') {
  return communityModule.handleAttendanceStatus(request, env);
}

if (pathname === '/api/community/attendance/feed' && request.method === 'GET') {
  return communityModule.handleAttendanceFeed(request, env);
}

if (pathname === '/api/community/attendance/checkin' && request.method === 'POST') {
  return communityModule.handleAttendanceCheckin(request, env);
}
```

## 4. 스키마 보강
`worker/schema.community.sql` 을 적용하세요.

```bash
wrangler d1 execute sherpa-db --remote --file=./schema.community.sql
```

## 5. attendance.message 컬럼
`community-api.js` 는 실행 중 `attendance.message` 컬럼이 없으면 자동 추가를 시도합니다.
하지만 배포 전에 아래를 명시적으로 적용하는 것을 권장합니다.

```sql
ALTER TABLE attendance ADD COLUMN message TEXT;
```

## 6. 프론트 반영
이미 워크스페이스에는 아래 프론트 파일이 API 호출형으로 업데이트되어 있습니다.
- `frontend/src/js/api.js`
- `frontend/src/js/community.js`
- `frontend/app/community/board.html`

## 7. 다음 단계
커뮤니티 API 연결 후 이어서 아래 순서로 확장합니다.
1. 프로그램 문의 API
2. 고객센터 FAQ/Q&A/1:1 API
3. 자유홍보 API
4. 모집 및 의뢰 API
