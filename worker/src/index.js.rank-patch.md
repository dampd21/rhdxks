# index.js rank-api 연결 패치

## ① 파일 최상단 import에 추가

```js
import { createRankModule } from './rank-api.js';
```

## ② 모듈 초기화 블록에 추가 (communityModule 선언 근처)

```js
const rankModule = createRankModule({
  jsonResp,
  kstDateString,
  kstNowString,
  sleep,
  naverFetchResults,   // index.js에 이미 있는 함수
  buildGraphQL,        // index.js에 이미 있는 함수
  corsHeaders,         // index.js에 이미 있는 함수
  ORACLE_PUPPETEER_URL,
  ORACLE_API_KEY,
});
```

## ③ routes 배열의 rank 관련 항목을 rankModule로 교체

```js
// 기존
{ method: 'GET',    path: '/rank/place',   handler: handleRankPlace },
{ method: 'POST',   path: '/rank/proxy',   handler: handleRankProxy },
{ method: 'POST',   path: '/rank/track',   handler: handleTrackCreate },
{ method: 'GET',    path: '/rank/tracks',  handler: handleTrackList },
{ method: 'DELETE', path: '/rank/track',   handler: handleTrackDelete },
{ method: 'POST',   path: '/rank/collect', handler: handleCollect },
{ method: 'GET',    path: '/rank/timeline',handler: handleTimeline },
{ method: 'GET',    path: '/rank/snapshot',handler: handleSnapshot },

// 교체 후
{ method: 'GET',    path: '/rank/place',   handler: rankModule.handleRankPlace },
{ method: 'POST',   path: '/rank/proxy',   handler: (r,e) => rankModule.handleRankProxy(r,e) },
{ method: 'POST',   path: '/rank/track',   handler: rankModule.handleTrackCreate },
{ method: 'GET',    path: '/rank/tracks',  handler: rankModule.handleTrackList },
{ method: 'DELETE', path: '/rank/track',   handler: rankModule.handleTrackDelete },
{ method: 'POST',   path: '/rank/collect', handler: rankModule.handleCollect },
{ method: 'GET',    path: '/rank/timeline',handler: rankModule.handleTimeline },
{ method: 'GET',    path: '/rank/snapshot',handler: rankModule.handleSnapshot },
```

## ④ scheduled cron의 collectTrack 호출을 rankModule로 교체

```js
// 기존
try { await collectTrack(db, tr); await sleep(1200); }

// 교체 후
try { await rankModule.collectTrack(db, tr); await sleep(1200); }
```

## ⑤ index.js에서 제거해도 되는 함수들 (rank-api.js로 이전 완료)
- handleRankPlace
- handleRankProxy
- handleTrackCreate
- handleTrackList
- handleTrackDelete
- handleCollect
- handleTimeline
- handleSnapshot
- collectTrack
- cleanupOld  ← rank-api.js 내부에서만 사용하므로 이전 가능
