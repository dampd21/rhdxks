export function createCsModule(deps) {
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

  function detailIdFromPath(pathname, prefix) {
    const match = pathname.match(new RegExp(prefix + '/(\\d+)'));
    return match ? parseInt(match[1], 10) : 0;
  }

  async function ensureFaqSeeds(db) {
    const cnt = await db.prepare('SELECT COUNT(*) AS cnt FROM faq_items').first();
    if (cnt && cnt.cnt > 0) return;
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('INSERT INTO faq_items(category, title, content, sort_order, created_at, updated_at) VALUES(?,?,?,?,?,?)').bind('결제/환불', 'PRO 요금제에서 결제 수단을 변경하고 싶습니다.', '결제 수단 변경 방법과 적용 시점을 안내합니다.', 1, now, now),
      db.prepare('INSERT INTO faq_items(category, title, content, sort_order, created_at, updated_at) VALUES(?,?,?,?,?,?)').bind('계정/로그인', '카카오 간편 가입 후 이메일 계정과 연동할 수 있나요?', '소셜 계정과 이메일 계정 연동 가능 여부를 설명합니다.', 2, now, now),
      db.prepare('INSERT INTO faq_items(category, title, content, sort_order, created_at, updated_at) VALUES(?,?,?,?,?,?)').bind('이용안내', '영수증 리뷰 모집/의뢰 시 플랫폼 수수료는 어떻게 되나요?', '미션 보상과 플랫폼 수수료 계산 기준을 정리합니다.', 3, now, now)
    ]);
  }

  async function handleFaqList(request, env) {
    const db = env.DB;
    await ensureFaqSeeds(db);
    const rows = await db.prepare('SELECT id, category, title, content, sort_order, created_at FROM faq_items WHERE is_active=1 ORDER BY sort_order ASC, created_at DESC').all();
    return jsonResp({ ok: true, faqs: rows.results || [] });
  }

  async function handleFaqDetail(request, env, pathname) {
    const db = env.DB;
    await ensureFaqSeeds(db);
    const id = detailIdFromPath(pathname, '/api/cs/faqs');
    if (!id) return jsonResp({ ok: false, error: 'invalid faq id' }, 400);
    const faq = await db.prepare('SELECT * FROM faq_items WHERE id=? AND is_active=1').bind(id).first();
    if (!faq) return jsonResp({ ok: false, error: 'FAQ not found' }, 404);
    return jsonResp({ ok: true, faq });
  }

  async function handleQnaList(request, env) {
    const db = env.DB;
    const url = new URL(request.url);
    const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(url.searchParams.get('pageSize'), 30)));
    const offset = (page - 1) * pageSize;
    const scope = normalizeScope(url.searchParams.get('scope') || 'all');
    const q = String(url.searchParams.get('q') || '').trim();
    const where = ['p.board=?', 'p.is_deleted=0'];
    const binds = ['cs'];
    if (q) {
      const escaped = '%' + escLike(q) + '%';
      if (scope === 'title') { where.push("p.title LIKE ? ESCAPE '\\'"); binds.push(escaped); }
      else if (scope === 'content') { where.push("p.content LIKE ? ESCAPE '\\'"); binds.push(escaped); }
      else if (scope === 'title_content') { where.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')"); binds.push(escaped, escaped); }
      else if (scope === 'author') { where.push("u.name LIKE ? ESCAPE '\\'"); binds.push(escaped); }
      else { where.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')"); binds.push(escaped, escaped, escaped); }
    }
    const whereSql = where.join(' AND ');
    const listRes = await db.prepare(`SELECT p.id, p.title, p.content, p.comment_count, p.created_at, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).bind(...binds, pageSize, offset).all();
    const countRes = await db.prepare(`SELECT COUNT(*) AS cnt FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE ${whereSql}`).bind(...binds).first();
    return jsonResp({ ok: true, posts: listRes.results || [], total: countRes ? countRes.cnt : 0, page, pageSize });
  }

  async function handleQnaCreate(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400);
    const now = new Date().toISOString();
    const result = await db.prepare('INSERT INTO posts(user_id, board, category, title, content, created_at, updated_at) VALUES(?,?,?,?,?,?,?)').bind(payload.sub, 'cs', 'qna', title, content, now, now).run();
    return jsonResp({ ok: true, id: result.meta.last_row_id });
  }

  async function handleQnaDetail(request, env, pathname) {
    const db = env.DB;
    const id = detailIdFromPath(pathname, '/api/cs/qna');
    if (!id) return jsonResp({ ok: false, error: 'invalid qna id' }, 400);
    const post = await db.prepare('SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.board=? AND p.is_deleted=0').bind(id, 'cs').first();
    if (!post) return jsonResp({ ok: false, error: 'Q&A not found' }, 404);
    return jsonResp({ ok: true, post });
  }

  async function handleTicketList(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;
    const rows = await db.prepare('SELECT * FROM support_tickets WHERE user_id=? ORDER BY created_at DESC').bind(payload.sub).all();
    return jsonResp({ ok: true, tickets: rows.results || [] });
  }

  async function handleTicketCreate(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
    const category = String(body.category || '').trim();
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400);
    const now = new Date().toISOString();
    const result = await db.prepare('INSERT INTO support_tickets(user_id, category, title, content, status, created_at, updated_at) VALUES(?,?,?,?,?,?,?)').bind(payload.sub, category, title, content, 'waiting', now, now).run();
    return jsonResp({ ok: true, id: result.meta.last_row_id });
  }

  async function handleTicketDetail(request, env, pathname) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;
    const id = detailIdFromPath(pathname, '/api/cs/tickets');
    if (!id) return jsonResp({ ok: false, error: 'invalid ticket id' }, 400);
    const ticket = await db.prepare('SELECT * FROM support_tickets WHERE id=? AND user_id=?').bind(id, payload.sub).first();
    if (!ticket) return jsonResp({ ok: false, error: 'Ticket not found' }, 404);
    return jsonResp({ ok: true, ticket });
  }

  return { handleFaqList, handleFaqDetail, handleQnaList, handleQnaCreate, handleQnaDetail, handleTicketList, handleTicketCreate, handleTicketDetail };
}
