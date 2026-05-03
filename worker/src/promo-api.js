export function createPromoModule(deps) {
  const jsonResp = deps.jsonResp;
  const requireAuth = deps.requireAuth;
  const getSnowballBalance = deps.getSnowballBalance;
  const deductSnowball = deps.deductSnowball;

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
    const match = pathname.match(/\/api\/promo\/posts\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async function ensurePartnerSeeds(db) {
    const cnt = await db.prepare('SELECT COUNT(*) AS cnt FROM partner_companies').first();
    if (cnt && cnt.cnt > 0) return;
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('INSERT INTO partner_companies(name, service_category, description, status, inquiry_url, owner_name, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('올스 (ALLS)', '블로그 배포 / 트래픽', '네이버 블로그 상위노출과 영수증 리뷰 트래픽 관리를 전문으로 하는 마케팅 에이전시입니다.', 'official', '', '제휴팀', now, now),
      db.prepare('INSERT INTO partner_companies(name, service_category, description, status, inquiry_url, owner_name, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('고트마케팅', '카페 바이럴', '맘카페, 정보성 카페 등 타겟에 맞는 자연스러운 카페 침투형 바이럴을 운영합니다.', 'official', '', '제휴팀', now, now),
      db.prepare('INSERT INTO partner_companies(name, service_category, description, status, inquiry_url, owner_name, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('A컴퍼니', '리뷰 블라인드 관리', '악성 리뷰 차단, 블라인드 처리, 평점 밸런싱 등 통합 평판 관리 솔루션입니다.', 'preparing', '', '제휴팀', now, now)
    ]);
  }

  async function handlePartnerList(request, env) {
    const db = env.DB;
    await ensurePartnerSeeds(db);
    const rows = await db.prepare('SELECT * FROM partner_companies ORDER BY created_at DESC').all();
    return jsonResp({ ok: true, partners: rows.results || [] });
  }

  async function handlePromoList(request, env) {
    const db = env.DB;
    const url = new URL(request.url);
    const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
    const pageSize = Math.min(50, Math.max(1, toInt(url.searchParams.get('pageSize'), 30)));
    const offset = (page - 1) * pageSize;
    const scope = normalizeScope(url.searchParams.get('scope') || 'all');
    const q = String(url.searchParams.get('q') || '').trim();

    const where = ['p.is_deleted=0'];
    const binds = [];
    if (q) {
      const escaped = '%' + escLike(q) + '%';
      if (scope === 'title') { where.push("p.title LIKE ? ESCAPE '\\'"); binds.push(escaped); }
      else if (scope === 'content') { where.push("p.content LIKE ? ESCAPE '\\'"); binds.push(escaped); }
      else if (scope === 'title_content') { where.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')"); binds.push(escaped, escaped); }
      else if (scope === 'author') { where.push("u.name LIKE ? ESCAPE '\\'"); binds.push(escaped); }
      else { where.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')"); binds.push(escaped, escaped, escaped); }
    }
    const whereSql = where.join(' AND ');
    const listRes = await db.prepare(`SELECT p.id, p.category, p.title, p.content, p.view_count, p.cost, p.created_at, u.name AS author_name FROM free_promotions p LEFT JOIN users u ON u.id=p.user_id WHERE ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).bind(...binds, pageSize, offset).all();
    const countRes = await db.prepare(`SELECT COUNT(*) AS cnt FROM free_promotions p LEFT JOIN users u ON u.id=p.user_id WHERE ${whereSql}`).bind(...binds).first();
    return jsonResp({ ok: true, posts: listRes.results || [], total: countRes ? countRes.cnt : 0, page, pageSize });
  }

  async function handlePromoCreate(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
    const category = String(body.category || '').trim();
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400);

    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const freeCount = await db.prepare('SELECT COUNT(*) AS cnt FROM free_promotions WHERE user_id=? AND substr(created_at,1,10)=? AND is_deleted=0').bind(payload.sub, today).first();
    var cost = 0;
    if ((freeCount && freeCount.cnt) >= 1) {
      const balance = await getSnowballBalance(db, payload.sub);
      if (balance < 500) return jsonResp({ ok: false, error: '눈덩이가 부족합니다. 최소 500 눈덩이가 필요합니다.' }, 400);
      await deductSnowball(db, payload.sub, 500, '자유홍보 게시글 작성', 'promotion', null);
      cost = 500;
    }

    const result = await db.prepare('INSERT INTO free_promotions(user_id, title, content, category, cost, created_at) VALUES(?,?,?,?,?,?)').bind(payload.sub, title, content, category, cost, new Date().toISOString()).run();
    return jsonResp({ ok: true, id: result.meta.last_row_id, cost });
  }

  async function handlePromoDetail(request, env, pathname) {
    const db = env.DB;
    const id = postIdFromPath(pathname);
    if (!id) return jsonResp({ ok: false, error: 'invalid promo id' }, 400);
    const post = await db.prepare('SELECT p.*, u.name AS author_name FROM free_promotions p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.is_deleted=0').bind(id).first();
    if (!post) return jsonResp({ ok: false, error: 'Promo post not found' }, 404);
    await db.prepare('UPDATE free_promotions SET view_count = view_count + 1 WHERE id=?').bind(id).run();
    post.view_count = (post.view_count || 0) + 1;
    return jsonResp({ ok: true, post });
  }

  return { handlePartnerList, handlePromoList, handlePromoCreate, handlePromoDetail };
}
