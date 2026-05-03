/* ================================================================
   Sherpain21 — community-api.js
   Community V2 reference module (workspace source of truth)
   ================================================================ */

export function createCommunityModule(deps) {
  const jsonResp = deps.jsonResp;
  const requireAuth = deps.requireAuth;
  const kstDateString = deps.kstDateString;
  const kstNowString = deps.kstNowString;
  const addSnowball = deps.addSnowball;

  function toInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function normalizeScope(scope) {
    const allowed = ['all', 'title', 'content', 'title_content', 'author'];
    return allowed.includes(scope) ? scope : 'all';
  }

  function escLike(value) {
    return String(value || '').replace(/[\\%_]/g, '\\$&');
  }

  function postIdFromPath(pathname) {
    const match = pathname.match(/\/api\/community\/posts\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function commentRowsToTree(rows) {
    const byId = new Map();
    const roots = [];
    rows.forEach((row) => {
      byId.set(row.id, Object.assign({}, row, { children: [] }));
    });
    rows.forEach((row) => {
      const item = byId.get(row.id);
      if (row.parent_id && byId.has(row.parent_id)) {
        byId.get(row.parent_id).children.push(item);
      } else {
        roots.push(item);
      }
    });
    return roots;
  }

  async function ensureAdmin(payload, env) {
    const db = env.DB;
    if (!payload) return false;
    if (payload.role === 'admin' || payload.role === 'operator') return true;
    const user = await db.prepare('SELECT role FROM users WHERE id=?').bind(payload.sub).first();
    return !!(user && (user.role === 'admin' || user.role === 'operator'));
  }

  async function handlePostList(request, env) {
    const db = env.DB;
    const url = new URL(request.url);
    const board = String(url.searchParams.get('board') || 'community').trim();
    const category = String(url.searchParams.get('category') || '').trim();
    const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(url.searchParams.get('pageSize'), 30)));
    const offset = (page - 1) * pageSize;
    const scope = normalizeScope(url.searchParams.get('scope') || 'all');
    const q = String(url.searchParams.get('q') || '').trim();

    const where = ['p.board=?', 'p.is_deleted=0'];
    const binds = [board];

    if (category) {
      where.push('p.category=?');
      binds.push(category);
    }

    if (q) {
      const escaped = '%' + escLike(q) + '%';
      if (scope === 'title') {
        where.push('p.title LIKE ? ESCAPE \'\\\'');
        binds.push(escaped);
      } else if (scope === 'content') {
        where.push('p.content LIKE ? ESCAPE \'\\\'');
        binds.push(escaped);
      } else if (scope === 'title_content') {
        where.push('(p.title LIKE ? ESCAPE \'\\\' OR p.content LIKE ? ESCAPE \'\\\')');
        binds.push(escaped, escaped);
      } else if (scope === 'author') {
        where.push('u.name LIKE ? ESCAPE \'\\\'');
        binds.push(escaped);
      } else {
        where.push('(p.title LIKE ? ESCAPE \'\\\' OR p.content LIKE ? ESCAPE \'\\\' OR u.name LIKE ? ESCAPE \'\\\')');
        binds.push(escaped, escaped, escaped);
      }
    }

    const whereSql = where.join(' AND ');

    const listQuery = `
      SELECT
        p.id, p.board, p.category, p.title, p.content,
        p.view_count, p.like_count, p.comment_count, p.is_pinned,
        p.created_at, p.updated_at,
        u.name AS author_name
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE ${whereSql}
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS cnt
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE ${whereSql}
    `;

    const listRes = await db.prepare(listQuery).bind(...binds, pageSize, offset).all();
    const countRes = await db.prepare(countQuery).bind(...binds).first();

    return jsonResp({
      ok: true,
      posts: listRes.results || [],
      total: countRes ? countRes.cnt : 0,
      page,
      pageSize,
    });
  }

  async function handlePostDetail(request, env, pathname) {
    const db = env.DB;
    const id = postIdFromPath(pathname);
    if (!id) return jsonResp({ ok: false, error: 'invalid post id' }, 400);

    const post = await db.prepare(`
      SELECT p.*, u.name AS author_name
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id=? AND p.is_deleted=0
    `).bind(id).first();

    if (!post) return jsonResp({ ok: false, error: 'Post not found' }, 404);

    await db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id=?').bind(id).run();
    post.view_count = (post.view_count || 0) + 1;

    const images = await db.prepare(
      'SELECT id, image_url, width, height, sort_order, created_at FROM post_images WHERE post_id=? ORDER BY sort_order ASC, id ASC'
    ).bind(id).all();

    return jsonResp({ ok: true, post, images: images.results || [] });
  }

  async function handleCommentList(request, env, pathname) {
    const db = env.DB;
    const postId = postIdFromPath(pathname);
    if (!postId) return jsonResp({ ok: false, error: 'invalid post id' }, 400);

    const url = new URL(request.url);
    const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
    const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get('pageSize'), 100)));
    const offset = (page - 1) * pageSize;

    const rows = await db.prepare(`
      SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at, c.like_count,
             u.name AS author_name
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.post_id=? AND c.is_deleted=0
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `).bind(postId, pageSize, offset).all();

    const count = await db.prepare('SELECT COUNT(*) AS cnt FROM comments WHERE post_id=? AND is_deleted=0').bind(postId).first();

    return jsonResp({
      ok: true,
      comments: rows.results || [],
      tree: commentRowsToTree(rows.results || []),
      total: count ? count.cnt : 0,
      page,
      pageSize,
    });
  }

  async function handlePostCreate(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResp({ ok: false, error: 'invalid JSON' }, 400);
    }

    const board = String(body.board || 'community').trim();
    const category = String(body.category || '').trim();
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean) : [];

    if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400);
    if (board !== 'community') return jsonResp({ ok: false, error: 'invalid board' }, 400);

    const allowedCategories = ['notice', 'greeting', 'free', 'share', 'logic'];
    if (!allowedCategories.includes(category)) return jsonResp({ ok: false, error: 'invalid category' }, 400);

    if (category === 'notice') {
      const isAdmin = await ensureAdmin(payload, env);
      if (!isAdmin) return jsonResp({ ok: false, error: '공지사항은 운영자만 작성할 수 있습니다.' }, 403);
    }

    const nowIso = new Date().toISOString();
    const result = await db.prepare(
      'INSERT INTO posts(user_id, board, category, title, content, is_pinned, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)'
    ).bind(payload.sub, board, category, title, content, category === 'notice' ? 1 : 0, nowIso, nowIso).run();

    const postId = result.meta.last_row_id;

    if (imageUrls.length) {
      const imageStmts = imageUrls.map((url, index) =>
        db.prepare('INSERT INTO post_images(post_id, image_url, sort_order, created_at) VALUES(?,?,?,?)').bind(postId, url, index, nowIso)
      );
      await db.batch(imageStmts);
    }

    return jsonResp({ ok: true, id: postId });
  }

  async function handleCommentCreate(request, env, pathname) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;
    const postId = postIdFromPath(pathname);
    if (!postId) return jsonResp({ ok: false, error: 'invalid post id' }, 400);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResp({ ok: false, error: 'invalid JSON' }, 400);
    }

    const content = String(body.content || '').trim();
    const parentId = body.parentId ? parseInt(body.parentId, 10) : null;
    if (!content) return jsonResp({ ok: false, error: 'content required' }, 400);

    if (parentId) {
      const parent = await db.prepare('SELECT id, post_id FROM comments WHERE id=? AND is_deleted=0').bind(parentId).first();
      if (!parent || parent.post_id !== postId) {
        return jsonResp({ ok: false, error: 'invalid parent comment' }, 400);
      }
    }

    const nowIso = new Date().toISOString();
    await db.batch([
      db.prepare('INSERT INTO comments(post_id, user_id, parent_id, content, created_at) VALUES(?,?,?,?,?)').bind(postId, payload.sub, parentId, content, nowIso),
      db.prepare('UPDATE posts SET comment_count = comment_count + 1, updated_at=? WHERE id=?').bind(nowIso, postId),
    ]);

    return jsonResp({ ok: true });
  }

  async function handleAttendanceStatus(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;

    const today = kstDateString();
    const todayRecord = await db.prepare('SELECT * FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, today).first();

    const monthStart = today.substring(0, 7) + '-01';
    const monthRecords = await db.prepare(`
      SELECT a.check_date, a.reward, a.streak, a.created_at, COALESCE(a.message, '') AS message
      FROM attendance a
      WHERE a.user_id=? AND a.check_date>=?
      ORDER BY a.check_date ASC
    `).bind(payload.sub, monthStart).all();

    return jsonResp({
      ok: true,
      checkedToday: !!todayRecord,
      currentStreak: todayRecord ? todayRecord.streak : 0,
      monthRecords: monthRecords.results || [],
    });
  }

  async function handleAttendanceFeed(request, env) {
    const db = env.DB;
    const url = new URL(request.url);
    const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(url.searchParams.get('pageSize'), 30)));
    const offset = (page - 1) * pageSize;

    const rows = await db.prepare(`
      SELECT a.id, a.check_date, a.reward, a.streak, a.created_at,
             COALESCE(a.message, '') AS message,
             u.name AS author_name
      FROM attendance a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.check_date DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all();

    const count = await db.prepare('SELECT COUNT(*) AS cnt FROM attendance').first();

    return jsonResp({
      ok: true,
      rows: rows.results || [],
      total: count ? count.cnt : 0,
      page,
      pageSize,
    });
  }

  async function handleAttendanceCheckin(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const message = String(body.message || '').trim();
    if (!message) return jsonResp({ ok: false, error: 'message required' }, 400);

    const today = kstDateString();
    const existing = await db.prepare('SELECT id FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, today).first();
    if (existing) return jsonResp({ ok: false, error: '오늘은 이미 출석했습니다.' }, 409);

    const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000).toISOString().slice(0, 10);
    const yesterdayRecord = await db.prepare('SELECT streak FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, yesterday).first();
    const streak = yesterdayRecord ? (yesterdayRecord.streak + 1) : 1;

    let reward = 10;
    if (streak >= 30) reward = 50;
    else if (streak >= 14) reward = 30;
    else if (streak >= 7) reward = 20;

    const newBalance = await addSnowball(db, payload.sub, reward, 'earn', '출석체크 보상 (연속 ' + streak + '일)', 'attendance', today);

    await db.prepare('INSERT INTO attendance(user_id, check_date, reward, streak, message, created_at) VALUES(?,?,?,?,?,?)')
      .bind(payload.sub, today, reward, streak, message, kstNowString())
      .run();

    return jsonResp({ ok: true, streak, reward, newBalance });
  }

  return {
    handlePostList,
    handlePostDetail,
    handleCommentList,
    handlePostCreate,
    handleCommentCreate,
    handleAttendanceStatus,
    handleAttendanceFeed,
    handleAttendanceCheckin,
  };
}
