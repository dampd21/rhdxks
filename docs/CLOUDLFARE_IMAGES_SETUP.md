# CLOUDLFARE_IMAGES_SETUP.md

마지막 업데이트: 2026-05-02

이 문서는 커뮤니티/게시판 에디터에서 사용하는 Cloudflare Images 업로드 기능을 위한 설정 가이드입니다.

## 1. 필요한 값
- `CF_IMAGES_ACCOUNT_ID`
- `CF_IMAGES_API_TOKEN`
- `CF_IMAGES_DELIVERY_PREFIX` (선택)

## 2. Account ID 확인 방법
### 방법 A — Cloudflare 대시보드
1. Cloudflare 로그인
2. 아무 프로젝트 화면 이동
3. 오른쪽 사이드 또는 개요 영역의 `Account ID` 확인

형태 예시:
```text
23091843beab89af2fee0ee22fd855bf
```

> 이메일 주소를 넣으면 안 됩니다.

### 방법 B — CLI
```bash
wrangler whoami
```

## 3. wrangler.toml 예시
```toml
[vars]
CF_IMAGES_ACCOUNT_ID = "23091843beab89af2fee0ee22fd855bf"
CF_IMAGES_DELIVERY_PREFIX = "https://imagedelivery.net/your_delivery_hash"
```

## 4. Secret 등록
```bash
wrangler secret put CF_IMAGES_API_TOKEN
```

## 5. 업로드 엔드포인트
- `POST /api/community/images`

## 6. 자주 나는 오류
### 이메일을 넣은 경우
```text
Could not route to /client/v4/accounts/Sherpain21@gmail.com/images/v1
```
원인:
- `CF_IMAGES_ACCOUNT_ID` 에 account id가 아니라 이메일이 들어감

해결:
- 실제 account id 문자열로 교체
