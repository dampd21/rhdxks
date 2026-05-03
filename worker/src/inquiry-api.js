export function createInquiryModule(deps) {
  const jsonResp = deps.jsonResp;
  const requireAuth = deps.requireAuth;

  function toInt(v, fallback) {
    const n = parseInt(v, 10);
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
    const match = pathname.match(/\/api\/inquiry\/posts\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async function handleList(request, env) {
    const db = env.DB;
    const url = new URL(request.url);
    const category = String(url.searchParams.get('category') || 'usage').trim();
    const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(url.searchParams.get('pageSize'), 30)));
    const offset = (page - 1) * pageSize;
    const scope = normalizeScope(url.searchParams.get('scope') || 'all');
    const q = String(url.searchParams.get('q') || '').trim();

    const where = ['p.board=?', 'p.category=?', 'p.is_deleted=0'];
    const binds = ['inquiry', category];

    if (q) {
      const escaped = '%' + escLike(q) + '%';
      if (scope === 'title') {
        where.push("p.title LIKE ? ESCAPE '\\'");
        binds.push(escaped);
      } else if (scope === 'content') {
        where.push("p.content LIKE ? ESCAPE '\\'");
        binds.push(escaped);
      } else if (scope === 'title_content') {
        where.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')");
        binds.push(escaped, escaped);
      } else if (scope === 'author') {
        where.push("u.name LIKE ? ESCAPE '\\'");
        binds.push(escaped);
      } else {
        where.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
        binds.push(escaped, escaped, escaped);
      }
    }

    const whereSql = where.join(' AND ');
    const listSql = `SELECT p.id, p.category, p.title, p.content, p.comment_count, p.created_at, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) AS cnt FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE ${whereSql}`;

    const listRes = await db.prepare(listSql).bind(...binds, pageSize, offset).all();
    const countRes = await db.prepare(countSql).bind(...binds).first();

    return jsonResp({ ok: true, posts: listRes.results || [], total: countRes ? countRes.cnt : 0, page, pageSize });
  }

  async function handleCreate(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }

    const category = String(body.category || '').trim();
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!['usage', 'feature'].includes(category)) return jsonResp({ ok: false, error: 'invalid category' }, 400);
    if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400);

    const nowIso = new Date().toISOString();
    const result = await db.prepare('INSERT INTO posts(user_id, board, category, title, content, created_at, updated_at) VALUES(?,?,?,?,?,?,?)').bind(payload.sub, 'inquiry', category, title, content, nowIso, nowIso).run();
    return jsonResp({ ok: true, id: result.meta.last_row_id });
  }

  async function handleDetail(request, env, pathname) {
    const db = env.DB;
    const id = postIdFromPath(pathname);
    if (!id) return jsonResp({ ok: false, error: 'invalid post id' }, 400);
    const post = await db.prepare('SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.board=? AND p.is_deleted=0').bind(id, 'inquiry').first();
    if (!post) return jsonResp({ ok: false, error: 'Post not found' }, 404);
    return jsonResp({ ok: true, post });
  }

  return { handleList, handleCreate, handleDetail };
}
