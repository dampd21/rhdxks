# INQUIRY_CS_PROMO_INTEGRATION.md

마지막 업데이트: 2026-05-02

이 문서는 프로그램 문의 / 고객센터 / 자유홍보 게시판의 실제 API 연결을 Worker에 붙이는 가이드입니다.

## 1. 추가 파일
- `worker/src/inquiry-api.js`
- `worker/src/cs-api.js`
- `worker/src/promo-api.js`
- `worker/schema.support_promo.sql`

## 2. index.js import 추가
```js
import { createInquiryModule } from './inquiry-api.js';
import { createCsModule } from './cs-api.js';
import { createPromoModule } from './promo-api.js';
```

## 3. 모듈 생성
```js
const inquiryModule = createInquiryModule({ jsonResp, requireAuth });
const csModule = createCsModule({ jsonResp, requireAuth });
const promoModule = createPromoModule({ jsonResp, requireAuth, getSnowballBalance, deductSnowball });
```

## 4. 라우트 추가
```js
if (pathname === '/api/inquiry/posts' && request.method === 'GET') return inquiryModule.handleList(request, env);
if (pathname === '/api/inquiry/posts' && request.method === 'POST') return inquiryModule.handleCreate(request, env);
if (/^\/api\/inquiry\/posts\/\d+$/.test(pathname) && request.method === 'GET') return inquiryModule.handleDetail(request, env, pathname);

if (pathname === '/api/cs/faqs' && request.method === 'GET') return csModule.handleFaqList(request, env);
if (/^\/api\/cs\/faqs\/\d+$/.test(pathname) && request.method === 'GET') return csModule.handleFaqDetail(request, env, pathname);
if (pathname === '/api/cs/qna' && request.method === 'GET') return csModule.handleQnaList(request, env);
if (pathname === '/api/cs/qna' && request.method === 'POST') return csModule.handleQnaCreate(request, env);
if (/^\/api\/cs\/qna\/\d+$/.test(pathname) && request.method === 'GET') return csModule.handleQnaDetail(request, env, pathname);
if (pathname === '/api/cs/tickets' && request.method === 'GET') return csModule.handleTicketList(request, env);
if (pathname === '/api/cs/tickets' && request.method === 'POST') return csModule.handleTicketCreate(request, env);
if (/^\/api\/cs\/tickets\/\d+$/.test(pathname) && request.method === 'GET') return csModule.handleTicketDetail(request, env, pathname);

if (pathname === '/api/partners' && request.method === 'GET') return promoModule.handlePartnerList(request, env);
if (pathname === '/api/promo/posts' && request.method === 'GET') return promoModule.handlePromoList(request, env);
if (pathname === '/api/promo/posts' && request.method === 'POST') return promoModule.handlePromoCreate(request, env);
if (/^\/api\/promo\/posts\/\d+$/.test(pathname) && request.method === 'GET') return promoModule.handlePromoDetail(request, env, pathname);
```

## 5. DB patch
```bash
wrangler d1 execute sherpa-db --remote --file=./schema.support_promo.sql
```
