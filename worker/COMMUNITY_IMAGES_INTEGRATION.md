# COMMUNITY_IMAGES_INTEGRATION.md

마지막 업데이트: 2026-05-02

이 문서는 Cloudflare Images를 사용해 커뮤니티 글쓰기 에디터에서 붙여넣기/첨부 이미지를 실제 업로드하는 기능을 Worker에 붙이는 가이드입니다.

---

## 1. 추가 파일
- `worker/src/community-images-api.js`

---

## 2. index.js 상단 import 추가
```js
import { createCommunityImagesModule } from './community-images-api.js';
```

---

## 3. 모듈 생성
`jsonResp`, `requireAuth` 사용 가능 위치 아래에 추가:

```js
const communityImagesModule = createCommunityImagesModule({
  jsonResp,
  requireAuth,
});
```

---

## 4. fetch 라우트 추가
404 직전 또는 커뮤니티 V2 route 근처에 추가:

```js
if (pathname === '/api/community/images' && request.method === 'POST') {
  try {
    return await communityImagesModule.handleUpload(request, env);
  } catch (e) {
    console.error('community image upload error:', e);
    return jsonResp({ ok: false, error: e.message || 'community image upload failed' }, 500);
  }
}
```

---

## 5. 필요한 환경 변수 / 시크릿

### 권장 변수
- `CF_IMAGES_ACCOUNT_ID`
- `CF_IMAGES_DELIVERY_PREFIX`

### 권장 시크릿
- `CF_IMAGES_API_TOKEN`

예시 개념:
```toml
[vars]
CF_IMAGES_ACCOUNT_ID = "your_account_id"
CF_IMAGES_DELIVERY_PREFIX = "https://imagedelivery.net/your_delivery_hash"
```

시크릿 등록:
```bash
wrangler secret put CF_IMAGES_API_TOKEN
```

> Images API Token은 Cloudflare Images write 권한이 있어야 합니다.

---

## 6. 프론트 기대 응답
프론트는 아래 형식 응답을 기대합니다.

```json
{
  "ok": true,
  "image": {
    "id": "...",
    "filename": "...",
    "uploaded": "...",
    "requireSignedURLs": false,
    "variants": ["..."],
    "width": 1200,
    "height": 800,
    "url": "https://..."
  }
}
```

---

## 7. 테스트 순서
1. Worker deploy
2. `Dev` → 테스트 로그인
3. `/app/community/write.html?category=free` 접속
4. 스크린샷 붙여넣기 또는 이미지 선택
5. 본문에 바로 이미지 삽입 확인
6. 업로드 실패 시 에러 메시지 확인

---

## 8. 주의
- 운영 환경에서는 이미지 업로드 rate limit / 용량 제한 / 악성 파일 검증 추가 고려
- 현재는 이미지 URL을 본문 HTML에 바로 삽입하는 방식
- 추후 `post_images` 테이블을 도입하면 업로드 자산 추적 강화 가능
