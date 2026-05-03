# COMMUNITY_BOARD_FINALIZATION_PLAN.md
# 커뮤니티 게시판 완성형 전환 설계서

마지막 업데이트: 2026-05-02

이 문서는 현재 Sherpain21 커뮤니티 기능을 **모달 기반 임시 구조에서 네이버카페형 완성 구조**로 전환하기 위한 설계 문서입니다.

목표:
- 목록 / 상세 / 작성 페이지 분리
- 댓글 / 대댓글 실동작
- 이미지 붙여넣기 / 첨부 지원
- 공지사항 운영자 전용 관리
- 댓글 수 표시
- D1 기반 영속 저장
- 게시판 엔진을 프로그램 문의 / 고객센터 / 자유홍보에 재사용

---

## 1. 현재 상태 요약

### 현재 구현된 것
- 커뮤니티 탭 구조
- 목록 테이블 UI
- 검색행 UI
- 글쓰기 모달 UI
- 상세 모달 UI
- 댓글/대댓글 UI
- 출석체크 UI
- 커뮤니티 V2 API 초안

### 현재 문제점
1. 글쓰기/상세가 모달 기반이라 네이버카페형 사용성 부족
2. 새로고침 시 영속성 부족 또는 API 미완성 구간 존재
3. 공지사항 관리 UI 없음
4. 이미지 붙여넣기/첨부 기능 없음
5. 댓글 수를 제목 옆에 `+N` 형태로 표시하지 않음
6. 상세 페이지가 별도 문서가 아니라 모달이어서 확장성 낮음

---

## 2. 최종 목표 구조

커뮤니티는 최종적으로 아래 3개 문서형 화면으로 분리한다.

### A. 목록 페이지
- `board.html?tab=notice`
- `board.html?tab=greeting`
- `board.html?tab=attendance`
- `board.html?tab=free`
- `board.html?tab=share`
- `board.html?tab=logic`

### B. 상세 페이지
- `view.html?id=123`

### C. 작성 페이지
- `write.html?category=free`
- `write.html?category=share`
- `write.html?category=logic`
- `write.html?category=greeting`
- 운영자 전용: `write.html?category=notice`

> 출석체크는 별도 write 페이지보다 현재 리스트 상단 입력형을 유지하는 것이 더 적합하다.

---

## 3. 정보 구조 설계

## 3.1 목록 페이지 구조
```text
탭
제목 / 설명 / 글쓰기 버튼
검색행(일부 탭만)
목록 테이블
페이지네이션
```

### 목록 테이블 컬럼
| 컬럼 | 설명 |
|------|------|
| No | 공지 / 게시글 번호 |
| 제목 | 댓글 수 포함 제목 |
| 작성자 | 작성자 이름 |
| 작성일 | 생성일 |
| 조회수 | 조회수 |

### 제목 표시 규칙
- 댓글 수가 0보다 크면 제목 뒤에 `+N`
- 예: `이번 주 순위 변동 체감 있으신가요 +4`

---

## 3.2 상세 페이지 구조
```text
카테고리 / 상태
제목
작성자 / 작성일 / 조회수 / 댓글수
본문
첨부 이미지 / 본문 이미지
댓글 입력 폼
댓글 리스트
대댓글 리스트
```

### 상세 페이지 필수 기능
- 제목/본문/작성자 표시
- 조회수 증가
- 댓글 등록
- 대댓글 등록
- 이미지 렌더링
- 운영자/본인 수정/삭제 버튼(추후)

---

## 3.3 작성 페이지 구조
```text
게시판 선택
제목
본문 에디터
이미지 붙여넣기 / 업로드
미리보기(선택)
임시저장(선택)
등록
```

### 작성 페이지 필수 기능
- 게시판 선택
- 제목 필수
- 본문 필수
- 이미지 붙여넣기 업로드
- 등록 후 목록 또는 상세 페이지 이동

---

## 4. 게시판 카테고리 규칙

| category | 이름 | 검색 | 작성 권한 |
|----------|------|------|-----------|
| notice | 공지사항 | 없음 | 운영자만 |
| greeting | 가입인사 | 없음 | 로그인 유저 |
| attendance | 출석체크 | 없음 | 출석 전용 |
| free | 자유게시판 | 있음 | 로그인 유저 |
| share | 정보공유 | 있음 | 로그인 유저 |
| logic | 로직분석 연구실 | 있음 | 로그인 유저 |

---

## 5. DB 설계

현재 기본 테이블
- `posts`
- `comments`
- `attendance`

이걸 유지하되, 필요한 컬럼을 보강한다.

## 5.1 posts 테이블 추가/확인 컬럼
기존:
- id
- user_id
- board
- category
- title
- content
- view_count
- like_count
- comment_count
- is_pinned
- is_deleted
- created_at
- updated_at

추가 권장:
- `thumbnail_url TEXT`
- `content_format TEXT DEFAULT 'html'`
- `has_images INTEGER DEFAULT 0`
- `excerpt TEXT`

### 설명
- `thumbnail_url` : 목록 썸네일용
- `content_format` : html/markdown/plain 분기 가능
- `has_images` : 목록/검색 최적화
- `excerpt` : 목록 요약

## 5.2 comments 테이블 추가/확인 컬럼
기존:
- id
- post_id
- user_id
- parent_id
- content
- like_count
- is_deleted
- created_at

추가 권장:
- `updated_at DATETIME`

## 5.3 post_images 테이블 신규 권장
```sql
CREATE TABLE IF NOT EXISTS post_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 용도
- 본문 이미지 추적
- 목록/상세용 이미지 분리
- Cloudflare Images 연계

---

## 6. 이미지 업로드 구조

## 6.1 저장 방식
현재 합의 기준:
- **Cloudflare Images 사용**

### 기대 구조
1. 작성 페이지에서 paste 이벤트 발생
2. blob 추출
3. Worker 업로드 엔드포인트 호출
4. Worker가 Cloudflare Images에 업로드
5. 반환 URL을 본문에 삽입
6. 최종 저장 시 posts/post_images에 연결

## 6.2 필요한 신규 API
- `POST /api/community/images`
  - 이미지 업로드
- 응답 예시:
```json
{
  "ok": true,
  "url": "https://.../image.jpg",
  "width": 1200,
  "height": 800
}
```

---

## 7. API 설계

## 7.1 목록
### `GET /api/community/posts`
쿼리 파라미터:
- `board=community`
- `category=free`
- `page=1`
- `pageSize=30`
- `scope=title|content|title_content|author|all`
- `q=...`

응답:
```json
{
  "ok": true,
  "posts": [],
  "total": 123,
  "page": 1,
  "pageSize": 30
}
```

## 7.2 상세
### `GET /api/community/posts/:id`
응답:
```json
{
  "ok": true,
  "post": { ... },
  "images": []
}
```

> 최적화 단계에서는 comments까지 같이 내려주는 버전도 고려 가능.

## 7.3 댓글 목록
### `GET /api/community/posts/:id/comments`
응답:
```json
{
  "ok": true,
  "comments": [],
  "tree": [],
  "total": 12,
  "page": 1,
  "pageSize": 100
}
```

## 7.4 게시글 작성
### `POST /api/community/posts`
body 예시:
```json
{
  "board": "community",
  "category": "free",
  "title": "제목",
  "content": "본문",
  "contentFormat": "html",
  "imageUrls": []
}
```

## 7.5 댓글 작성
### `POST /api/community/posts/:id/comments`
body 예시:
```json
{
  "content": "댓글 내용",
  "parentId": null
}
```

## 7.6 출석 상태
### `GET /api/community/attendance/status`

## 7.7 출석 피드
### `GET /api/community/attendance/feed?page=1&pageSize=30`

## 7.8 출석 체크인
### `POST /api/community/attendance/checkin`
body 예시:
```json
{
  "message": "오늘도 출석합니다"
}
```

## 7.9 이미지 업로드
### `POST /api/community/images`

---

## 8. 프론트 파일 구조 제안

### 현재 파일
- `frontend/app/community/board.html`
- `frontend/src/js/community.js`

### 추가 권장 파일
- `frontend/app/community/view.html`
- `frontend/app/community/write.html`
- `frontend/src/js/community-view.js`
- `frontend/src/js/community-write.js`
- `frontend/src/css/board.css` (계속 사용)

---

## 9. 구현 순서

### 1단계
현재 board.html + community.js 구조 유지하며,
API를 실제로 붙여서 목록/출석체크/댓글까지 동작시킨다.

### 2단계
상세 모달을 `view.html`로 승격한다.

### 3단계
글쓰기 모달을 `write.html`로 승격한다.

### 4단계
이미지 붙여넣기 / 업로드를 추가한다.

### 5단계
공지사항 운영자 관리 UI를 추가한다.

---

## 10. 이 구조를 재사용할 페이지
커뮤니티가 완성되면 아래 페이지는 거의 같은 엔진을 복제/응용할 수 있다.

- 프로그램 문의
- 고객센터 Q&A
- 고객센터 1:1 문의 내역
- 자유홍보 게시판

즉 커뮤니티를 먼저 완성하는 것이 전체 게시판형 기능 완성의 핵심이다.

---

## 11. 최종 선언
Sherpain21의 커뮤니티는 단순한 게시판이 아니라,
향후 문의/고객센터/자유홍보까지 확장 가능한 **게시판 엔진의 기준점**이 되어야 한다.

따라서 다음 단계는 반드시:
1. 목록 API 완성
2. 상세 / 댓글 / 대댓글 완성
3. 출석체크 완성
4. 이미지 업로드 완성
5. 페이지형 상세/작성 구조 전환

순서로 가야 한다.
