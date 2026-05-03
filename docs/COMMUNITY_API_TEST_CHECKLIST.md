# COMMUNITY API TEST CHECKLIST

이 체크리스트는 `COMMUNITY_V2_*` 패치와 `/api/dev/session` 패치가 worker에 반영된 뒤,
커뮤니티 기능을 실제로 점검하는 순서를 정리한 문서입니다.

---

## 0. 사전 준비

### Worker 배포
```powershell
cd C:\Sherpa-in.com\worker
wrangler deploy
```

### Frontend 배포
```powershell
cd C:\Sherpa-in.com
wrangler pages deploy frontend --project-name=sherpa-in
```

### 테스트 대상 페이지
- `/app/community/board.html?tab=notice`
- `/app/community/board.html?tab=free`
- `/app/community/board.html?tab=attendance`

---

## 1. 테스트 로그인

### 목표
`localStorage` 에 `sherpa_token` / `sherpa_user` 저장 확인

### 방법
1. 아무 페이지 접속
2. 탑바 우측 `Dev` 버튼 클릭
3. `테스트 로그인` 버튼 클릭

### 확인
브라우저 콘솔에서 아래 실행
```js
localStorage.getItem('sherpa_token')
localStorage.getItem('sherpa_user')
```

### 기대 결과
- `sherpa_token` 에 JWT 문자열 존재
- `sherpa_user` 에 대표님 / admin / pro / 눈덩이 정보 존재

---

## 2. 공지사항 목록

### URL
`/app/community/board.html?tab=notice`

### 확인 항목
- 공지사항 탭 active
- 검색창 없음
- 목록 정상 로드
- 공지글 상단 표시
- 페이지네이션 정상

### 기대 API
- `GET /api/community/posts?board=community&category=notice&page=1&pageSize=30`

---

## 3. 자유게시판 검색

### URL
`/app/community/board.html?tab=free`

### 확인 항목
- 검색행 표시
- scope 드롭다운 표시
- 검색어 입력 시 목록 변화
- 페이지네이션 유지

### 기대 API
- `GET /api/community/posts?board=community&category=free&page=1&pageSize=30&scope=all&q=...`

---

## 4. 글쓰기

### 대상 탭
- 가입인사
n- 자유게시판
- 정보공유
- 로직분석 연구실

### 확인 항목
1. 글쓰기 버튼 클릭
2. 모달 열림
3. 게시판 선택 자동 지정
4. 제목/본문 입력
5. 등록 후 새 글 목록 반영

### 기대 API
- `POST /api/community/posts`

### 예시 body
```json
{
  "board": "community",
  "category": "free",
  "title": "테스트 글",
  "content": "테스트 내용"
}
```

---

## 5. 공지사항 권한

### 확인 항목
일반 계정으로 `category=notice` 작성 시도 시 차단

### 기대 결과
- `403 Forbidden`
- 메시지: `공지사항은 운영자만 작성할 수 있습니다.`

---

## 6. 게시글 상세

### 확인 항목
- 제목 클릭 시 상세 모달 열림
- 제목/작성자/작성일/조회수/본문 노출
- 댓글 영역 표시

### 기대 API
- `GET /api/community/posts/:id`
- `GET /api/community/posts/:id/comments?page=1&pageSize=100`

---

## 7. 댓글 작성

### 확인 항목
1. 상세 모달에서 댓글 입력
2. 등록
3. 댓글 목록 갱신
4. 게시글 댓글 수 반영

### 기대 API
- `POST /api/community/posts/:id/comments`

### 예시 body
```json
{
  "content": "댓글 테스트",
  "parentId": null
}
```

---

## 8. 대댓글 작성

### 확인 항목
1. 댓글 아래 `답글` 클릭
2. `parentId` hidden 세팅
3. 등록 후 들여쓰기 표시

### 기대 body
```json
{
  "content": "대댓글 테스트",
  "parentId": 123
}
```

---

## 9. 출석 상태

### URL
`/app/community/board.html?tab=attendance`

### 확인 항목
- 오늘 출석 여부 표시
- 연속 출석일 표시
- 출석 리스트 로드
- 페이지네이션 로드

### 기대 API
- `GET /api/community/attendance/status`
- `GET /api/community/attendance/feed?page=1&pageSize=30`

---

## 10. 출석 등록

### 확인 항목
1. 인사말 입력
2. 출석하기 클릭
3. 오늘 출석 완료
4. 리스트 최상단 반영
5. 눈덩이 적립 반영
6. 탑바/사이드바 사용자 정보 반영

### 기대 API
- `POST /api/community/attendance/checkin`

### 예시 body
```json
{
  "message": "오늘도 출석합니다"
}
```

---

## 11. 중복 출석 방지

### 확인 항목
같은 날 다시 출석 시도

### 기대 결과
- `409`
- 메시지: `오늘은 이미 출석했습니다.`

---

## 12. 에러 발생 시 복사할 것

### 브라우저 Network 탭
- Request URL
- Response status
- Response body(JSON)

### 브라우저 Console
- 에러 메시지 전체

### Worker 쪽
- 어떤 경로에서 실패했는지
- 배포 직후인지 여부

복사해서 보내주면 다음 수정이 가장 빠릅니다.
