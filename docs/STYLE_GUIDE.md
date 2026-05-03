# Sherpain21 스타일 가이드 v1.2.1 (완전판 갱신본)

마지막 수정: 2026-05-02  
원본 작성: Sherpain21 Product Team  
현재 반영: 워크스페이스 최신 구조 기준

---

## 0. 스타일 가이드 사용 원칙

- 본 문서의 모든 토큰(변수)은 실제 코드에서 CSS Custom Property로 사용한다.
- 컴포넌트 추가 시 반드시 이 문서의 토큰 시스템 내에서만 확장한다.
- 이모지(Emoji)는 UI 어디에도 사용하지 않는다. 아이콘은 반드시 SVG(Lucide/Heroicons)로 대체한다.
- 한국어 텍스트에는 반드시 `word-break: keep-all`을 적용한다.
- 폰트 크기는 14px 미만 본문 텍스트를 금지한다.
- 색상 대비는 WCAG AA 기준(4.5:1) 이상을 필수로 준수한다.
- **탑바 메뉴에는 장식용 아이콘을 사용하지 않는다. 텍스트만 표시한다.**
- **내부 화폐 단위는 "눈덩이"를 사용한다. (구 TK/토큰)**
- 문서 작업 시 이 가이드의 설명량과 규칙을 줄이지 않는다. 구조 변경이 생기면 기존 설명을 유지한 채 현재 상태를 추가한다.
- HTML 내부 대형 `<style>` 블록은 지양하고, CSS 파일 분리 원칙을 유지한다.

---

## 1. 브랜드 아이덴티티

### 1.1 포지셔닝 키워드

"신뢰 있는 실용 도구" × "한국형 데이터 마케팅 플랫폼" × "프리미엄 B2B SaaS"

### 1.2 브랜드 컨셉

셰르파(Sherpa)는 히말라야의 안내자입니다.  
복잡한 네이버 생태계에서 길을 잃은 자영업자의 가이드 역할을 시각적으로 전달합니다.  
무겁지 않되 가볍지 않고, 전문적이되 접근 가능한 톤을 유지합니다.

### 1.3 이모지 사용 금지 규칙

- UI 내 모든 이모지(Emoji) 사용을 전면 금지한다.
- 아이콘이 필요한 모든 위치에는 SVG 아이콘(Lucide Icons 또는 Heroicons)을 사용한다.
- 마케팅 카피 텍스트에도 이모지를 사용하지 않는다.
- 서버 사이드 렌더링 환경에서 이모지는 OS별 렌더링 차이가 발생하므로 금지한다.

#### 잘못된 예
```html
🚀 무료로 시작하기
💰 +2,400 눈덩이 미션 완료!
```

#### 올바른 예
```html
<button class="btn btn-primary">무료로 시작하기</button>
<span>+2,400 눈덩이 미션 완료!</span>
```

---

## 2. 컬러 시스템

### 2.1 Primary Palette

| 토큰명 | HEX | RGB | 용도 |
|--------|-----|-----|------|
| `--color-primary` | #0D1B2A | 13, 27, 42 | 헤더, 사이드바, 주요 배경 |
| `--color-primary-light` | #1A2F45 | 26, 47, 69 | 카드 배경, 호버 상태 |
| `--color-accent` | #2563EB | 37, 99, 235 | CTA 버튼, 링크, 배지 (딥 블루) |
| `--color-accent-hover` | #1D4ED8 | 29, 78, 216 | 액센트 호버 |
| `--color-accent-light` | rgba(37,99,235,0.08) | - | 액센트 배경, 활성 메뉴 배경 |
| `--color-accent-ring` | rgba(37,99,235,0.12) | - | 포커스 링, 인풋 포커스 |
| `--color-lime` | #BFFF00 | 191, 255, 0 | 넘버링, 포인트 강조 (5% 이하 사용) |
| `--color-surface` | #F4F6F9 | 244, 246, 249 | 전체 페이지 배경 |
| `--color-white` | #FFFFFF | 255, 255, 255 | 카드, 모달 배경 |

### 2.2 Secondary / Semantic Palette

| 토큰명 | HEX | 용도 |
|--------|-----|------|
| `--color-success` | #10B981 | 완료, 승인, 정산 완료 상태 |
| `--color-warning` | #F59E0B | 진행중, 대기, 주의 배지 |
| `--color-danger` | #EF4444 | 에러, 잠금, 만료 |
| `--color-info` | #3B82F6 | 안내, 툴팁, 정보성 알림 |
| `--color-gray-50` | #F9FAFB | 미세한 배경 |
| `--color-gray-100` | #F4F6F9 | 섹션 구분 배경 |
| `--color-gray-200` | #E5E7EB | 구분선(Divider) |
| `--color-gray-300` | #D1D5DB | 호버 보더 |
| `--color-gray-400` | #9CA3AF | Placeholder, 비활성 텍스트 |
| `--color-gray-500` | #6B7280 | 보조 레이블 |
| `--color-gray-600` | #4B5563 | 보조 텍스트 |
| `--color-gray-700` | #374151 | 중간 강조 텍스트 |
| `--color-gray-800` | #1F2937 | 강한 텍스트 |
| `--color-gray-900` | #111827 | 본문 주요 텍스트 |

### 2.3 그라디언트 정의

```css
--gradient-hero:
  linear-gradient(135deg, #0D1B2A 0%, #1A2F45 50%, #0D2E40 100%);
용도: Hero 및 CTA 섹션 배경

--gradient-card-hover:
  linear-gradient(180deg, rgba(37,99,235,0.06) 0%, transparent 100%);
용도: 카드 호버 하이라이트

--gradient-accent:
  linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%);
용도: 눈덩이/크레딧 배지, 진행바

--gradient-pro:
  linear-gradient(135deg, #667eea 0%, #764ba2 100%);
용도: Pro 플랜 프리미엄 강조
```

### 2.4 색상 대비 기준 (WCAG AA)

- 배경색 (#0D1B2A) + 흰색 (#FFFFFF) 대비비 16.4:1 — 통과
- 배경색 (#0D1B2A) + 딥블루 (#2563EB) 대비비 4.6:1 — 통과
- 배경색 (#0D1B2A) + Lime (#BFFF00) 대비비 12.1:1 — 통과
- 흰색 (#FFFFFF) + 본문 (#111827) 대비비 18.1:1 — 통과
- 흰색 (#FFFFFF) + 보조 (#4B5563) 대비비 7.0:1 — 통과
- 흰색 (#FFFFFF) + 딥블루 (#2563EB) 대비비 4.6:1 — 통과 (AA Large Text)

---

## 3. 타이포그래피

### 3.1 폰트 패밀리

#### 한국어 주력 (가독성 + 신뢰감)
```css
--font-korean: 'Pretendard Variable', 'Pretendard',
  -apple-system, BlinkMacSystemFont,
  'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
```
CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css`

#### 숫자/영문 강조 (데이터 시각화용)
```css
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

#### 영문 브랜딩
```css
--font-brand: 'Inter', 'Helvetica Neue', sans-serif;
```

### 3.2 타입 스케일

| 역할 | 클래스 | Size | Weight | Line-height | 사용처 |
|------|--------|------|--------|-------------|--------|
| Display | `.text-display` | 56px / 3.5rem | 800 | 1.1 | Hero 대형 헤드라인 |
| H1 | `.text-h1` | 40px / 2.5rem | 700 | 1.2 | 섹션 타이틀 |
| H2 | `.text-h2` | 32px / 2rem | 700 | 1.3 | 서브 섹션 |
| H3 | `.text-h3` | 24px / 1.5rem | 600 | 1.4 | 카드 제목 |
| H4 | `.text-h4` | 20px / 1.25rem | 600 | 1.4 | 소제목 |
| Body L | `.text-body-lg` | 18px / 1.125rem | 400 | 1.7 | 주요 설명 |
| Body | `.text-body` | 16px / 1rem | 400 | 1.7 | 일반 본문 |
| Body S | `.text-body-sm` | 14px / 0.875rem | 400 | 1.6 | 보조 설명 |
| Caption | `.text-caption` | 12px / 0.75rem | 500 | 1.5 | 배지, 레이블 |
| Mono | `.text-mono` | 14px / 0.875rem | 500 | 1.4 | 순위 숫자, 눈덩이값 |

### 3.3 반응형 타입 스케일 (clamp)

```css
.text-display { font-size: clamp(2.2rem, 5vw, 3.5rem); }
.text-h1 { font-size: clamp(1.8rem, 3.5vw, 2.5rem); }
.text-h2 { font-size: clamp(1.4rem, 2.5vw, 2rem); }
.text-h3 { font-size: clamp(1.1rem, 2vw, 1.5rem); }
```

### 3.4 타이포그래피 규칙

#### DO
- 헤드라인: 핵심 키워드에만 `--color-accent` 컬러 강조 (span 래핑)
- 숫자 데이터(순위, 눈덩이, 금액): 반드시 `--font-mono` 사용
- 한국어 줄바꿈: `word-break: keep-all` 필수 적용
- 긴 설명: `max-width: 65ch` 이하로 제한

#### DON'T
- 한 섹션 내 3가지 이상 폰트 굵기 혼용 금지
- 전체 대문자(ALL CAPS) 한국어 텍스트 금지
- 14px 미만 본문 텍스트 금지
- 이모지 사용 금지

---

## 4. 스페이싱 & 레이아웃 시스템

### 4.1 스페이싱 토큰 (8px Base Grid)

| 토큰 | 값 | 용도 |
|------|----|------|
| `--space-1` | 4px | 아이콘 내부 간격 |
| `--space-2` | 8px | 인라인 요소 간격 |
| `--space-3` | 12px | 소형 패딩 |
| `--space-4` | 16px | 기본 패딩 |
| `--space-5` | 20px | 카드 내부 패딩 |
| `--space-6` | 24px | 섹션 내 요소 간격 |
| `--space-8` | 32px | 카드 간 간격 |
| `--space-10` | 40px | 소섹션 간격 |
| `--space-12` | 48px | 중형 섹션 간격 |
| `--space-16` | 64px | 대형 섹션 간격 |
| `--space-24` | 96px | Hero 섹션 패딩 |
| `--space-32` | 128px | 최대 섹션 상하 여백 |

### 4.2 레이아웃 그리드

- 최대 컨테이너 너비: 1280px
- 컨테이너 패딩: `0 24px` (모바일 기준 `0 16px`)
- 그리드 컬럼: `repeat(12, 1fr)` — 랜딩 페이지
- 대시보드 레이아웃: **260px (사이드바, 접힘 시 72px)** + `1fr` (메인)
- 그리드 갭: 24px
- 탑바 높이: **기준 설계 48px → 현재 구현 상태는 64px**

### 4.3 반응형 브레이크포인트

| 토큰 | 값 | 설명 |
|------|----|------|
| `--bp-sm` | 640px | 모바일 ~ 소형 태블릿 |
| `--bp-md` | 768px | 태블릿 |
| `--bp-lg` | 1024px | 소형 데스크톱 |
| `--bp-xl` | 1280px | 표준 데스크톱 |
| `--bp-2xl` | 1536px | 와이드 |

---

## 5. 아이콘 시스템

### 5.1 기본 원칙

- 이모지(Emoji)를 절대 사용하지 않는다.
- 모든 아이콘은 SVG 형식을 사용한다.
- 아이콘 전용 버튼에는 반드시 `aria-label`을 명시한다.
- 데코레이션용 아이콘(텍스트 옆 보조)은 `aria-hidden="true"` 처리한다.
- **탑바 메뉴에는 장식용 아이콘을 사용하지 않는다. 텍스트만 표시한다.**

### 5.2 아이콘 라이브러리

- Primary: Lucide Icons https://lucide.dev
- Supplementary: Heroicons Solid (상태 아이콘 전용)

### 5.3 Lucide Icons 사용 기준

| 속성 | 기준값 |
|------|--------|
| stroke-width | 1.5px (통일) |
| size (인라인) | 20px |
| size (카드) | 24px |
| size (섹션) | 32px |
| color | 컨텍스트의 시맨틱 컬러 적용 |

### 5.4 아이콘 - 용도 매핑 (Lucide 기준)

| 용도 | Lucide 아이콘명 |
|------|-----------------|
| 플레이스 순위 트래커 | map-pin + trending-up |
| 눈덩이/크레딧 | zap |
| 키워드 검색 | search |
| 키워드 마인드맵 | git-branch |
| 에스크로/잠금 | lock |
| 블로그 포스팅 | file-text |
| 분석/차트 | bar-chart-2 |
| 설정 | settings |
| 알림 | bell |
| 사용자 | user |
| 완료 상태 | check-circle |
| 경고 상태 | alert-triangle |
| 에러/잠금 상태 | lock / x-circle |
| 로그인 | log-in |
| 로그아웃 | log-out |
| 메뉴 (햄버거) | menu / x |
| 화살표 (CTA) | arrow-right |
| 순위 상승 | trending-up |
| 순위 하락 | trending-down |
| 충전 | plus-circle |
| 출금 | download |
| 미션 | target |
| 부동산 | home |
| AI 생성 | cpu / sparkles |
| 데이터 수집 | database |
| 프록시/네트워크 | globe |
| 보고서 | clipboard-list |

### 5.5 상태 아이콘 컬러 매핑

| 상태 | 아이콘 | 컬러 |
|------|--------|------|
| 완료 | check-circle | `--color-success` #10B981 |
| 경고 | alert-triangle | `--color-warning` #F59E0B |
| 잠금 | lock | `--color-danger` #EF4444 |
| 정보 | info | `--color-info` #3B82F6 |
| 눈덩이 | zap | `--color-accent` #2563EB |

---

## 6. 컴포넌트 스펙

### 6.1 버튼 시스템

#### PRIMARY CTA
- background: `var(--color-accent)` (#2563EB)
- color: `var(--color-white)` (white)
- font-weight: 600
- font-size: 14px
- padding: 10px 20px
- border-radius: 6px
- hover: background `var(--color-accent-hover)`, box-shadow `var(--shadow-accent)`

#### SECONDARY
- background: transparent
- color: `var(--color-accent)`
- border: 1px solid `var(--color-accent)`
- hover: background `var(--color-accent-light)`

#### GHOST / TEXT
- background: transparent
- color: `var(--color-gray-500)`
- border: none
- hover: background `var(--color-gray-50)`, color `var(--color-gray-700)`

#### DANGER
- background: `var(--color-danger)`
- color: white

#### DARK
- background: `var(--color-gray-900)`
- color: white
- hover: background `var(--color-gray-800)`

#### SIZE VARIANTS

| 클래스 | padding | font-size |
|--------|---------|-----------|
| .btn-sm | 6px 14px | 12px |
| .btn-base | 10px 20px | 14px |
| .btn-lg | 14px 28px | 15px |

#### 아이콘 버튼 예시
```html
<button class="btn btn-primary btn-base">
  <svg aria-hidden="true"></svg>
  무료로 시작하기
</button>
```

### 6.2 카드 컴포넌트

#### Base Card
- background: `var(--color-white)`
- border-radius: 10px
- border: 1px solid `var(--color-gray-200)`
- padding: `var(--space-5)` (20px)
- hover: border-color `var(--color-gray-300)`

#### Dark Card - 대시보드용
- background: `var(--color-primary-light)`
- border: 1px solid rgba(255,255,255,0.08)
- border-radius: 10px
- padding: `var(--space-5)`

#### Feature Card
- Base Card 상속
- `::before` pseudo: position absolute; top 0; left 0; right 0; height 3px; background `var(--gradient-accent)`; transform scaleX(0) → hover 시 scaleX(1)

### 6.3 배지(Badge) 시스템

#### 플랜 배지

| 클래스 | 배경 | 글자 |
|--------|------|------|
| .badge-basic | #E5E7EB | #374151 |
| .badge-standard | #DBEAFE | #1D4ED8 |
| .badge-pro | `var(--gradient-pro)` | white |

#### 상태 배지

| 클래스 | 배경 | 글자 | 의미 |
|--------|------|------|------|
| .badge-pending | #FEF3C7 | #92400E | 대기중 |
| .badge-working | #DBEAFE | #1E40AF | 진행중 |
| .badge-done | #D1FAE5 | #065F46 | 완료 |
| .badge-locked | #FEE2E2 | #991B1B | 잠금 |

#### 눈덩이 배지
- background: `var(--gradient-accent)`
- color: white
- font-family: `var(--font-mono)`
- font-weight: 600
- font-size: 12px
- padding: 3px 10px
- border-radius: `var(--radius-full)`

#### 무료 배지
- background: rgba(191,255,0,0.15)
- color: #4a6000
- border: 1px solid rgba(191,255,0,0.5)

### 6.4 요금제 카드 (Pricing Card)

#### 구조
- 플랜명
- 가격 (`--font-mono`, 800 weight)
- 구분선
- 기능 목록 (체크 아이콘 SVG + 텍스트)
- CTA 버튼

#### Standard 추천 카드 강조
- background: `var(--color-primary)`
- border: 2px solid `var(--color-accent)`
- `::after` pseudo: content "가장 많이 선택"; position absolute; top -14px; left 50%; transform translateX(-50%); background `var(--color-accent)`; color white; font-size 12px; font-weight 700; padding 4px 16px; border-radius 999px

#### 기능 목록 아이콘
- 체크(포함): check 아이콘, 색상 `var(--color-accent)`
- X(미포함): x 아이콘, 색상 `var(--color-gray-400)`

### 6.5 에스크로 미션 카드

#### 구조
- 헤더: 미션 제목 + 위치 + 상태 배지
- 메타: 보상 눈덩이 (`--font-mono`) + D-Day + 신청자 수
- CTA: 수락 버튼 또는 잠금 오버레이

#### 잠금 상태 (is-locked)
- 카드 전체에 반투명 오버레이 (rgba(255,255,255,0.7))
- 중앙에 lock 아이콘(SVG) + "수락됨 · 진행 중" 텍스트
- backdrop-filter: blur(2px)

### 6.6 네비게이션 GNB / Topbar

#### 원본 규칙
- 높이: 64px 또는 초기 기준 48px 문맥 존재
- 배경: solid 또는 약한 블러 계열
- 모바일: 햄버거 토글

#### 현재 구현 기준
- 탑바 높이: 64px
- 배경: 순백색
- border-bottom: 1px solid `var(--color-gray-200)`
- 사이드바 Sherpain 헤더 경계선과 같은 톤 유지
- 메뉴는 텍스트 only
- 기능성 아이콘(사이드바 토글, 알림, 유저, Dev)은 허용

#### 탑바 구성
- 좌측: 사이드바 토글
- 중앙: 글로벌 메뉴
- 우측: Dev / 알림 / 사용자

### 6.7 대시보드 레이아웃

#### 구조
- 상단 탑바: **텍스트 only** 메뉴 | 알림 | 유저 — 현재 64px
- 좌측 사이드바: **260px (접힘 시 72px)**
  - 프로필 영역 (이름, 요금제, 눈덩이, 정보수정/결제 및 구독)
  - 대시보드
  - 기능 카테고리 트리
  - 하단 가이드 / 고객센터 / 로그아웃
- 우측 메인: 1fr (독립 스크롤)

---

## 7. 데이터 시각화 스타일

### 7.1 순위 차트 (Chart.js / Recharts)

```css
--chart-line-color: var(--color-accent);
--chart-area-fill: rgba(37, 99, 235, 0.08);
--chart-grid-color: rgba(0, 0, 0, 0.06);
--chart-dot-color: var(--color-accent);
--chart-dot-size: 6px;
```

주의: Y축은 반전 처리 (1위가 상단에 위치)

### 7.2 키워드 마인드맵 (D3.js)

#### 노드 컬러 계층

| 토큰 | 컬러 | 용도 |
|------|------|------|
| `--mindmap-root` | `var(--color-accent)` (#2563EB) | 중심 키워드 |
| `--mindmap-l1` | #667EEA | 1단계 연관 |
| `--mindmap-l2` | #F59E0B | 2단계 연관 |
| `--mindmap-l3` | `var(--color-gray-400)` | 3단계 |

#### 엣지(연결선)
- color: rgba(37, 99, 235, 0.2)
- width: 1.5px

### 7.3 눈덩이 잔액 위젯

#### 구조
- 레이블: "보유 눈덩이"
- 금액: `1,240 눈덩이`
- 환산: `약 12,400원`
- 진행바: 현재 잔액 / 출금 최소 퍼센트
- 버튼: 충전 / 출금
- 경고: 출금 최소 미달 안내 문구

### 7.4 순위 변동 표시

| 방향 | 색상 | 텍스트 | 아이콘 |
|------|------|--------|--------|
| 상승 | `var(--color-success)` | "+3" | trending-up |
| 하락 | `var(--color-danger)` | "-2" | trending-down |
| 유지 | `var(--color-gray-400)` | "--" | minus |

---

## 8. 애니메이션 & 인터랙션

### 8.1 트랜지션 토큰

```css
--transition-fast: all 0.15s ease;
--transition-base: all 0.25s ease;
--transition-slow: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

### 8.2 핵심 애니메이션 정의

#### fade-up
- from: opacity 0, translateY(16px)
- to: opacity 1, translateY(0)
- duration: 0.5s ease

#### skeleton-wave
- background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)
- background-size: 400px 100%
- animation: 1.4s infinite

#### count-up
- from: opacity 0, translateY(8px)
- to: opacity 1, translateY(0)

#### pulse-glow
- 0%,100%: box-shadow 0 0 0 0 rgba(37,99,235,0.4)
- 50%: box-shadow 0 0 0 12px rgba(37,99,235,0)
- duration: 2s infinite

#### marquee
- 0%: translateX(0)
- 100%: translateX(-50%)
- duration: 30s linear infinite

### 8.3 인터랙션 원칙

#### DO
- 모든 클릭 가능 요소: hover 시 cursor pointer + 시각 피드백
- API 호출 중: 버튼 disabled + 스피너 또는 스켈레톤
- 순위 변동: 숫자 플립/색상 변화
- 눈덩이 차감: 잔액 숫자 카운트다운/업데이트
- 에스크로 잠금: 카드 전체 반투명 오버레이 + lock 표시
- 스크롤 진입 요소: IntersectionObserver 기반 fade-up 가능

#### DON'T
- 페이지 전환 지연 300ms 초과 금지
- 배경 영상/파티클 남용 금지
- 자동 재생 팝업 금지
- 이모지 사용 금지

---

## 9. 섀도우 & 보더 반경

### 9.1 그림자 토큰

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
--shadow-md: 0 4px 16px rgba(0,0,0,0.08);
--shadow-lg: 0 12px 40px rgba(0,0,0,0.10);
--shadow-accent: 0 4px 14px rgba(37,99,235,0.25);
```

### 9.2 보더 반경 토큰

| 토큰 | 값 | 용도 |
|------|----|------|
| `--radius-sm` | 6px | 태그, 인풋, 버튼 |
| `--radius-md` | 10px | 카드, 소형 모달 |
| `--radius-lg` | 16px | 대형 카드, 모달 |
| `--radius-xl` | 24px | 대형 카드, 섹션 블록 |
| `--radius-full` | 999px | 배지, 필 버튼, 토글 |

---

## 10. 카피라이팅 톤 & 보이스

### 10.1 브랜드 보이스 원칙
- 실용적이고 직접적이다. 과장 없이 데이터로 말한다.
- 자영업자의 언어를 사용한다. 마케팅 전문 용어를 최소화한다.
- 결과 중심으로 말한다. 기능보다 효과를 먼저 서술한다.

### 10.2 올바른 카피 예시

| 상황 | 잘못된 예 | 올바른 예 |
|------|----------|----------|
| 기능 소개 | "블로그 자동화 기능 제공" | "자는 동안 블로그가 올라갑니다" |
| 유료 전환 | "Pro 플랜으로 업그레이드하세요" | "Pro로 올라가면 경쟁자 10명이 내려갑니다" |
| 에러 안내 | "오류가 발생했습니다" | "잠깐, 데이터를 못 가져왔어요. 다시 시도해볼까요?" |
| 눈덩이 부족 | "눈덩이가 부족합니다" | "눈덩이가 300 부족해요. 충전하면 바로 사용 가능합니다" |
| 빈 상태 | "데이터 없음" | "아직 등록된 미션이 없어요. 첫 의뢰를 올려보세요" |

### 10.3 숫자 포맷 규칙

| 원본 | 표시 | 규칙 |
|------|------|------|
| 1240 | "1,240 눈덩이" | 콤마 + 눈덩이 단위 |
| 39000 | "39,000원" | 원화 + 콤마 |
| 1 | "1위" | 위 접미사 |
| +3 | "+3" | 부호 + 색상 |
| -2 | "-2" | 부호 + 색상 |
| 0 | "--" | 중립 컬러 |
| 2025-06-01 | "6월 1일" | 한국식 간결 |
| T09:00 | "오늘 오전 9:00" | 상대적 표현 |

---

## 11. 접근성 기준

### 11.1 색상 대비
모든 텍스트-배경 조합은 WCAG AA 기준 (4.5:1) 이상을 필수 준수한다.

### 11.2 키보드 네비게이션
- 모든 인터랙티브 요소는 Tab 키로 접근 가능해야 한다.
- 포커스 링: 2px solid `var(--color-accent)`, outline-offset 2px
- 모달/드로어 열릴 시 포커스 트랩(Focus Trap) 적용

### 11.3 스크린 리더 대응
- 이미지: alt 텍스트 필수
- 아이콘 전용 버튼: `aria-label` 반드시 명시
- 데코 SVG 아이콘: `aria-hidden="true"` 처리
- 동적 콘텐츠 업데이트: `aria-live="polite"` 또는 `aria-live="assertive"`
- 아코디언/탭: `aria-expanded`, `aria-selected` 상태값 동적 업데이트

### 11.4 반응형 접근성
- 터치 타겟 최소 크기: 44x44px
- 모바일 메뉴: `role="dialog"` `aria-modal="true"` 처리 가능
- 포커스가 모달 외부로 나가지 않도록 Focus Trap 적용

---

## 12. 성능 기준

- LCP: 2.5초 이하 목표
- CLS: 0.1 이하 목표
- FID/INP: 입력 반응 지연 최소화
- 스켈레톤 UI: 주요 API 대기 화면에 적용 권장
- 이미지: WebP 우선, `loading="lazy"`
- SVG 아이콘: 인라인 SVG 또는 스프라이트 사용 권장
- 번들: 기능별 청크 분리 권장
- 폰트: preconnect + `font-display: swap`

---

## 13. 페이지별 섹션 구성

| 페이지 | 섹션 구성 |
|--------|----------|
| 랜딩(홈) | Hero → 소셜프루프 → 수치 통계 → 기능 그리드 → 무료기능 블록 → 요금제 → 에스크로 → 눈덩이 → FAQ → CTA |
| 대시보드 | 사이드바 + 메인: 빠른실행, 순위 카드, 눈덩이 위젯, 최근 미션, 활동 피드 |
| 플레이스 순위 | 키워드 입력 → 스켈레톤 → 순위 결과 카드 → 히스토리 차트 |
| 미션 마켓 | 필터 탭 → 리스트/테이블 → 에스크로 상태 배지 → 상세/등록 모달 |
| 눈덩이 지갑 | 잔액 + 출금 버튼 → 충전 옵션 → 거래 내역 |
| 요금제 | 토글(월/연) → 3단 플랜 카드 → 기능 비교표 → FAQ |
| 커뮤니티/문의/고객센터 | 탭 → 제목/설명 → 액션 버튼 → 검색행(필요 시) → 테이블 → 페이지네이션 → 모달 |
| 제휴/홍보/모집/의뢰 | 탭 → 제목/설명 → 액션 버튼 → 검색행 → 테이블/리스트 → 페이지네이션 → 모달 |

---

## 14. CSS 변수 전체 선언 (Master Token Sheet)

아래 내용을 `:root` 블록에 선언한다.

```css
:root {
  --color-primary: #0D1B2A;
  --color-primary-light: #1A2F45;
  --color-accent: #2563EB;
  --color-accent-hover: #1D4ED8;
  --color-accent-light: rgba(37, 99, 235, 0.08);
  --color-accent-ring: rgba(37, 99, 235, 0.12);
  --color-lime: #BFFF00;
  --color-surface: #F4F6F9;
  --color-white: #FFFFFF;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #3B82F6;
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F4F6F9;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  --font-korean: 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-brand: 'Inter', sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --space-32: 128px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 999px;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.10);
  --shadow-accent: 0 4px 14px rgba(37,99,235,0.25);

  --transition-fast: all 0.15s ease;
  --transition-base: all 0.25s ease;
  --transition-slow: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  --gradient-hero: linear-gradient(135deg, #0D1B2A 0%, #1A2F45 50%, #0D2E40 100%);
  --gradient-accent: linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%);
  --gradient-pro: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-card-hover: linear-gradient(180deg, rgba(37,99,235,0.06) 0%, transparent 100%);

  --sidebar-width: 260px;
  --sidebar-collapsed-width: 72px;
  --topbar-height: 64px;
}
```

---

## 15. 현재 구현 반영 메모 (2026-05-02)

### 15.1 실제 CSS 파일 구조
현재 워크스페이스 기준 CSS는 다음과 같이 분리되어 있다.
- `frontend/src/css/app.css`
- `frontend/src/css/topbar.css`
- `frontend/src/css/board.css`
- `frontend/src/css/marketplace.css`
- `frontend/src/css/page-shell.css` (초기 공통 파일, 일부 정리 대상)

### 15.2 탑바 실제 구현
현재 탑바는 다음 구조다.
- `frontend/src/js/topbar-core.js`
- `frontend/src/js/topbar.js`
- `frontend/src/css/topbar.css`

### 15.3 폰트 실제 기준
현재 프론트의 전체 방향은:
- 기본 텍스트: `var(--font-korean)`
- 숫자/통계: `var(--font-mono)`
- 영문 브랜드 보조: 제한적으로 `var(--font-brand)`

### 15.4 플레이스 순위 조회
플레이스 순위 조회는 현재 별도 inline style 블록이 남아 있어,
향후 `place-rank.css` 분리 작업이 필요하다.

### 15.5 상단 메뉴 페이지 통일
현재 아래 페이지는 공통 레이아웃 철학으로 정리되었다.
- 커뮤니티
- 프로그램 문의
- 고객센터
- 제휴사 및 자유홍보
- 모집 및 의뢰

---

## 16. 변경 이력

- **v1.0** 최초 작성 — 컬러, 타이포, 스페이싱, 컴포넌트 스펙 정의
- **v1.1** 이모지 금지 규칙 추가. 아이콘 시스템 섹션 신설. SVG 아이콘-용도 매핑 테이블 추가. 접근성 섹션 보강 (aria 속성, Focus Trap). 카피라이팅 톤앤보이스 섹션 추가.
- **v1.2** 액센트 컬러 변경 (#00C9A7 민트 → #2563EB 딥 블루). TK/토큰 → 눈덩이 전체 변경. 탑바 메뉴 아이콘 제거(텍스트 only) 규칙 추가. 사이드바 접기/펼치기(260px↔72px) 스펙 추가. 사이드바 프로필 영역 재구성. shadow/gradient 값 딥블루 기준 업데이트. gray 스케일 gray-50~gray-900 추가.
- **v1.2.1** 워크스페이스 최신 상태 반영. CSS 분리 구조(`board.css`, `marketplace.css`) 추가. 탑바 분리 구조(`topbar-core.js`, `topbar.js`) 추가. 탑바 높이 현재 구현값 64px 기준 명시. 문서 완전판 갱신 원칙 반영.

---

Version: 1.2.1  
작성: Sherpain21 Product Team / Current Workspace Update

본 스타일 가이드는 랜딩페이지, 대시보드, 커뮤니티, 문의, 고객센터, 제휴사, 미션 마켓 등 모든 서비스 UI에 일관되게 적용되어야 합니다. 컴포넌트 추가 시 반드시 이 문서의 토큰 시스템 내에서 확장하세요.
