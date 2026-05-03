-- ══════════════════════════════════════════════════
-- SHERPAIN21 - D1 Schema (v2.1 통합)
-- 실행: npm run db:migrate
--
-- [v2.1 변경사항]
-- - 기존 테이블 전부 유지 (users, stores, tracks, snapshots, snapshot_items, reviews, payments)
-- - 신규: escrow_missions, escrow_applications, snowball_transactions
-- - 신규: posts, comments, attendance
-- - 신규: free_promotions
-- - DB 컬럼 tokens는 유지 (코드에서 snowball로 매핑)
-- ══════════════════════════════════════════════════

-- ── 사용자 ──
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'general',
  plan TEXT NOT NULL DEFAULT 'a',
  provider TEXT,
  provider_id TEXT,
  biz_type TEXT,
  store_name TEXT,
  store_url TEXT,
  agency_name TEXT,
  tokens INTEGER DEFAULT 150,          -- 눈덩이 (코드에서 snowball로 매핑)
  referral_code TEXT,
  login_id TEXT,
  password_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 매장 ──
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  place_url TEXT,
  place_id TEXT,
  category TEXT,
  keywords TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 순위 추적 대상 ──
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  kind TEXT DEFAULT 'restaurant',
  keyword TEXT NOT NULL,
  target_place_id TEXT NOT NULL,
  target_name TEXT,
  region_city TEXT,
  region_district TEXT,
  x TEXT NOT NULL,
  y TEXT NOT NULL,
  device_type TEXT DEFAULT 'pc',
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 일별 스냅샷 ──
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL,
  base_date TEXT NOT NULL,
  collected_at TEXT,
  total INTEGER,
  target_rank INTEGER,
  FOREIGN KEY (track_id) REFERENCES tracks(id)
);

-- ── 스냅샷 상세 (업체별) ──
CREATE TABLE IF NOT EXISTS snapshot_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  rank INTEGER,
  place_id TEXT,
  name TEXT,
  category TEXT,
  businessCategory TEXT,
  blog_count INTEGER DEFAULT 0,
  visitor_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  score TEXT,
  image_count INTEGER DEFAULT 0,
  microReview TEXT,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
);

-- ── 리뷰 ──
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  content TEXT,
  rating INTEGER,
  sentiment TEXT,
  is_blocked INTEGER DEFAULT 0,
  source TEXT,
  created_at DATETIME,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- ── 결제 ──
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT,
  status TEXT DEFAULT 'pending',
  toss_payment_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ══════════════════════════════════════════════════
-- v2.1 신규 테이블
-- ══════════════════════════════════════════════════

-- ── 눈덩이 거래내역 ──
-- tokens 컬럼은 DB에 유지하되, 프론트/API에서는 "눈덩이"로 표시
CREATE TABLE IF NOT EXISTS snowball_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                  -- 'charge' | 'use' | 'earn' | 'refund' | 'withdraw' | 'escrow_deposit' | 'escrow_payout' | 'escrow_fee'
  amount INTEGER NOT NULL,             -- 양수: 증가, 음수: 차감
  balance_after INTEGER NOT NULL,      -- 거래 후 잔액
  description TEXT,                    -- "플레이스 순위 조회", "에스크로 미션 #42 수수료" 등
  ref_type TEXT,                       -- 'escrow' | 'payment' | 'promotion' | 'attendance' | null
  ref_id TEXT,                         -- 참조 ID (미션ID, 결제ID 등)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 에스크로 미션 ──
CREATE TABLE IF NOT EXISTS escrow_missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id TEXT NOT NULL,          -- 의뢰자 (owner/marketer)
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT DEFAULT 'review',  -- 'review' | 'blog' | 'visit' | 'sns' | 'etc'
  category TEXT,                       -- 'restaurant' | 'cafe' | 'beauty' | 'hospital' 등
  location TEXT,                       -- 지역/위치
  place_id TEXT,                       -- 네이버 플레이스 ID (선택)
  place_name TEXT,                     -- 매장명
  reward_per_person INTEGER NOT NULL,  -- 1인당 보상 눈덩이
  max_applicants INTEGER DEFAULT 1,    -- 최대 수행자 수
  total_deposit INTEGER NOT NULL,      -- 총 예치금 (reward * max + 수수료 10%)
  platform_fee INTEGER NOT NULL,       -- 플랫폼 수수료 (total의 10%)
  deadline DATETIME,                   -- 마감일
  requirements TEXT,                   -- 미션 요구사항 (JSON 또는 텍스트)
  status TEXT DEFAULT 'open',          -- 'open' | 'in_progress' | 'completed' | 'cancelled' | 'expired'
  is_locked INTEGER DEFAULT 0,         -- max_applicants 달성 시 1
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id)
);

-- ── 에스크로 신청 ──
CREATE TABLE IF NOT EXISTS escrow_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL,
  applicant_id TEXT NOT NULL,          -- 수행자 (blogger)
  status TEXT DEFAULT 'pending',       -- 'pending' | 'accepted' | 'rejected' | 'submitted' | 'approved' | 'cancelled'
  submission_url TEXT,                 -- 수행 결과 URL (블로그 링크 등)
  submission_note TEXT,                -- 수행 메모
  submitted_at DATETIME,
  approved_at DATETIME,
  payout_amount INTEGER,              -- 정산금 (reward - 수수료 이미 차감됨)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES escrow_missions(id),
  FOREIGN KEY (applicant_id) REFERENCES users(id)
);

-- ── 커뮤니티 게시판 ──
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  board TEXT NOT NULL DEFAULT 'community',  -- 'community' | 'promotion' | 'notice'
  category TEXT,                       -- 'general' | 'question' | 'info' | 'review' 등
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 댓글 ──
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  parent_id INTEGER,                   -- 대댓글 시 상위 댓글 ID
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 출석체크 ──
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  check_date TEXT NOT NULL,            -- YYYY-MM-DD (KST)
  reward INTEGER DEFAULT 0,           -- 출석 보상 눈덩이
  streak INTEGER DEFAULT 1,           -- 연속 출석일
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 자유홍보 게시판 (토큰 차감) ──
CREATE TABLE IF NOT EXISTS free_promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link_url TEXT,
  image_url TEXT,
  category TEXT,                       -- 'store' | 'product' | 'service' | 'event'
  view_count INTEGER DEFAULT 0,
  cost INTEGER DEFAULT 0,             -- 차감된 눈덩이 (첫 1회 무료, 이후 500)
  is_deleted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ══════════════════════════════════════════════════
-- 인덱스 (기존 유지 + 신규)
-- ══════════════════════════════════════════════════

-- 기존 인덱스
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_stores_user ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_workspace ON tracks(workspace_id, active);
CREATE INDEX IF NOT EXISTS idx_snapshots_track_date ON snapshots(track_id, base_date);
CREATE INDEX IF NOT EXISTS idx_snapshot_items_snapshot ON snapshot_items(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_items_place ON snapshot_items(snapshot_id, place_id);
CREATE INDEX IF NOT EXISTS idx_reviews_store ON reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- v2.1 신규 인덱스
CREATE INDEX IF NOT EXISTS idx_snowball_tx_user ON snowball_transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snowball_tx_ref ON snowball_transactions(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_escrow_missions_requester ON escrow_missions(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_escrow_missions_status ON escrow_missions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_escrow_apps_mission ON escrow_applications(mission_id, status);
CREATE INDEX IF NOT EXISTS idx_escrow_apps_applicant ON escrow_applications(applicant_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board, is_deleted, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, check_date);
CREATE INDEX IF NOT EXISTS idx_free_promotions_user ON free_promotions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_free_promotions_date ON free_promotions(is_deleted, created_at);
