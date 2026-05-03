-- Sherpain21 community module patch
-- Apply after base schema if needed.

CREATE INDEX IF NOT EXISTS idx_posts_board_category_created
ON posts(board, category, is_deleted, is_pinned, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_board_author
ON posts(board, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_post_parent_created
ON comments(post_id, parent_id, is_deleted, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_attendance_feed_date
ON attendance(check_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS post_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_post_images_post
ON post_images(post_id, sort_order, created_at);
