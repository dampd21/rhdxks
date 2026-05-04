/**
 * SHERPAIN21 - rank-api.js
 * 플레이스 순위 조회 + 추적(트래커) + 스냅샷/타임라인
 *
 * index.js에서 import 후 라우팅만 연결하면 됨.
 * 의존: utils.js의 jsonResp, kstDateString, kstNowString, sleep
 *       naverFetchResults (index.js 또는 place-api.js 에서 주입)
 */

export function createRankModule(deps) {
  var jsonResp         = deps.jsonResp;
  var kstDateString    = deps.kstDateString;
  var kstNowString     = deps.kstNowString;
  var sleep            = deps.sleep;
  var naverFetchResults = deps.naverFetchResults;   // index.js에서 주입

  // ────────────────────────────────────────
  // 순위 조회 (GET /rank/place)
  // ────────────────────────────────────────
  async function handleRankPlace(request) {
    var url        = new URL(request.url);
    var keyword    = url.searchParams.get('keyword')    || '';
    var store      = url.searchParams.get('store')      || '';
    var kind       = url.searchParams.get('kind')       || 'restaurant';
    var start      = parseInt(url.searchParams.get('start'))   || 1;
    var display    = parseInt(url.searchParams.get('display'))  || 50;
    var x          = url.searchParams.get('x')          || '126.9783882';
    var y          = url.searchParams.get('y')          || '37.5666103';
    var deviceType = url.searchParams.get('deviceType') || 'pc';

    if (!keyword) return jsonResp({ error: 'keyword required' }, 400);

    try {
      var result = await naverFetchResults(kind, keyword, start, display, x, y, deviceType);

      var myRank = null;
      if (store) {
        for (var i = 0; i < result.items.length; i++) {
          if (result.items[i].name.indexOf(store) !== -1) { myRank = i + 1; break; }
        }
      }

      return jsonResp({
        keyword:    keyword,
        store:      store,
        kind:       kind,
        myRank:     myRank,
        total:      result.total,
        results:    result.items,
        nlu:        result.nlu || null,
        checkedAt:  kstNowString()
      });
    } catch (e) {
      return jsonResp({ error: e.message, snippet: e.snippet || null }, 502);
    }
  }

  // ────────────────────────────────────────
  // 순위 프록시 (POST /rank/proxy)
  // ────────────────────────────────────────
  async function handleRankProxy(request, env) {
    var ORACLE_PUPPETEER_URL = deps.ORACLE_PUPPETEER_URL;
    var ORACLE_API_KEY       = deps.ORACLE_API_KEY;
    var buildGraphQL         = deps.buildGraphQL;
    var corsHeaders          = deps.corsHeaders;

    var url        = new URL(request.url);
    var kind       = url.searchParams.get('kind')       || 'restaurant';
    var keyword    = url.searchParams.get('keyword')    || '';
    var start      = parseInt(url.searchParams.get('start'))   || 1;
    var display    = parseInt(url.searchParams.get('display'))  || 100;
    var x          = url.searchParams.get('x')          || '126.9783882';
    var y          = url.searchParams.get('y')          || '37.5666103';
    var deviceType = url.searchParams.get('deviceType') || 'pc';

    if (!keyword) return jsonResp({ error: 'keyword required' }, 400);

    var gql = buildGraphQL(kind, keyword, start, display, x, y, deviceType);
    try {
      var resp = await fetch(ORACLE_PUPPETEER_URL + '/naver/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ORACLE_API_KEY },
        body: JSON.stringify([gql])
      });
      var data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: { 'Content-Type': resp.headers.get('content-type') || 'application/json', ...corsHeaders() }
      });
    } catch (e) {
      return jsonResp({ error: e.message }, 500);
    }
  }

  // ────────────────────────────────────────
  // 추적 등록 (POST /rank/track)
  // ────────────────────────────────────────
  async function handleTrackCreate(request, env) {
    var db = env.DB;
    try {
      var body = await request.json();
      var workspaceId   = String(body.workspaceId   || 'default').trim();
      var kind          = String(body.kind          || 'restaurant').trim();
      var keyword       = String(body.keyword       || '').trim();
      var targetPlaceId = String(body.targetPlaceId || '').trim();
      var targetName    = body.targetName ? String(body.targetName).trim() : null;
      var regionCity    = String(body.regionCity    || '').trim();
      var regionDistrict = body.regionDistrict ? String(body.regionDistrict).trim() : null;
      var bx            = String(body.x || '').trim();
      var by            = String(body.y || '').trim();
      var deviceType    = String(body.deviceType    || 'pc').trim();

      if (!keyword || !targetPlaceId || !bx || !by) {
        return jsonResp({ ok: false, error: 'keyword, targetPlaceId, x, y required' }, 400);
      }

      var r = await db.prepare(
        'INSERT INTO tracks(workspace_id, kind, keyword, target_place_id, target_name, region_city, region_district, x, y, device_type, created_at, active) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)'
      ).bind(workspaceId, kind, keyword, targetPlaceId, targetName, regionCity, regionDistrict, bx, by, deviceType, new Date().toISOString()).run();

      return jsonResp({ ok: true, id: r.meta.last_row_id });
    } catch (e) {
      return jsonResp({ ok: false, error: e.message }, 500);
    }
  }

  // ────────────────────────────────────────
  // 추적 목록 (GET /rank/tracks)
  // ────────────────────────────────────────
  async function handleTrackList(request, env) {
    var db  = env.DB;
    var url = new URL(request.url);
    var wid = url.searchParams.get('workspaceId') || 'default';
    var rows = await db.prepare(
      'SELECT id, kind, keyword, target_place_id, target_name, region_city, region_district, x, y, device_type, created_at FROM tracks WHERE workspace_id=? AND active=1 ORDER BY id DESC'
    ).bind(wid).all();
    return jsonResp({ ok: true, tracks: rows.results });
  }

  // ────────────────────────────────────────
  // 추적 삭제 (DELETE /rank/track)
  // ────────────────────────────────────────
  async function handleTrackDelete(request, env) {
    var db  = env.DB;
    var url = new URL(request.url);
    var wid = url.searchParams.get('workspaceId') || 'default';
    var id  = url.searchParams.get('id');
    if (!id) return jsonResp({ ok: false, error: 'id required' }, 400);
    await db.prepare('UPDATE tracks SET active=0 WHERE id=? AND workspace_id=?').bind(id, wid).run();
    return jsonResp({ ok: true });
  }

  // ────────────────────────────────────────
  // 즉시 수집 (POST /rank/collect)
  // ────────────────────────────────────────
  async function handleCollect(request, env) {
    var db  = env.DB;
    var url = new URL(request.url);
    var wid = url.searchParams.get('workspaceId') || 'default';
    var tid = url.searchParams.get('trackId');
    if (!tid) return jsonResp({ ok: false, error: 'trackId required' }, 400);

    var tr = await db.prepare('SELECT * FROM tracks WHERE id=? AND workspace_id=? AND active=1').bind(tid, wid).first();
    if (!tr) return jsonResp({ ok: false, error: 'track not found' }, 404);

    try {
      var collected = await collectTrack(db, tr);
      return jsonResp({ ok: true, collected: collected });
    } catch (e) {
      return jsonResp({ ok: false, error: e.message, snippet: e.snippet || null }, 502);
    }
  }

  // ────────────────────────────────────────
  // 타임라인 (GET /rank/timeline)
  // ────────────────────────────────────────
  async function handleTimeline(request, env) {
    var db    = env.DB;
    var url   = new URL(request.url);
    var wid   = url.searchParams.get('workspaceId') || 'default';
    var tid   = url.searchParams.get('trackId');
    var limit = parseInt(url.searchParams.get('limit') || '30');
    if (!tid) return jsonResp({ ok: false, error: 'trackId required' }, 400);

    var tr = await db.prepare('SELECT * FROM tracks WHERE id=? AND workspace_id=?').bind(tid, wid).first();
    if (!tr) return jsonResp({ ok: false, error: 'track not found' }, 404);

    var snaps = await db.prepare(
      'SELECT s.base_date AS date, s.total, s.target_rank AS targetRank, ' +
      'i.blog_count AS blogCount, i.visitor_count AS visitorCount, ' +
      'i.save_count AS saveCount, i.image_count AS imageCount ' +
      'FROM snapshots s ' +
      'LEFT JOIN snapshot_items i ON i.snapshot_id = s.id AND i.place_id = ? ' +
      'WHERE s.track_id = ? ' +
      'ORDER BY s.base_date DESC LIMIT ?'
    ).bind(String(tr.target_place_id), tid, limit).all();

    var arr = snaps.results || [];
    var timeline = [];
    for (var i = 0; i < arr.length; i++) {
      var cur  = arr[i];
      var prev = arr[i + 1] || null;
      var rankDelta = null;
      if (cur.targetRank != null && prev && prev.targetRank != null) {
        rankDelta = prev.targetRank - cur.targetRank;
      }
      timeline.push({
        date:         cur.date,
        total:        cur.total,
        targetRank:   cur.targetRank,
        rankDelta:    rankDelta,
        blogCount:    cur.blogCount,
        visitorCount: cur.visitorCount,
        saveCount:    cur.saveCount,
        imageCount:   cur.imageCount
      });
    }

    return jsonResp({
      ok: true,
      track: {
        id:            tr.id,
        keyword:       tr.keyword,
        targetPlaceId: tr.target_place_id,
        targetName:    tr.target_name
      },
      timeline: timeline
    });
  }

  // ────────────────────────────────────────
  // 스냅샷 상세 (GET /rank/snapshot)
  // ────────────────────────────────────────
  async function handleSnapshot(request, env) {
    var db   = env.DB;
    var url  = new URL(request.url);
    var wid  = url.searchParams.get('workspaceId') || 'default';
    var tid  = url.searchParams.get('trackId');
    var date = url.searchParams.get('date');
    if (!tid || !date) return jsonResp({ ok: false, error: 'trackId, date required' }, 400);

    var tr = await db.prepare('SELECT * FROM tracks WHERE id=? AND workspace_id=?').bind(tid, wid).first();
    if (!tr) return jsonResp({ ok: false, error: 'track not found' }, 404);

    var snap = await db.prepare(
      'SELECT id, base_date, collected_at, total, target_rank FROM snapshots WHERE track_id=? AND base_date=?'
    ).bind(tid, date).first();
    if (!snap) return jsonResp({ ok: true, snapshot: null, items: [] });

    var prevSnap = await db.prepare(
      'SELECT id, base_date FROM snapshots WHERE track_id=? AND base_date<? ORDER BY base_date DESC LIMIT 1'
    ).bind(tid, date).first();

    var curItems = await db.prepare(
      'SELECT rank, place_id, name, category, businessCategory, blog_count, visitor_count, save_count, score, image_count, microReview ' +
      'FROM snapshot_items WHERE snapshot_id=? ORDER BY rank ASC'
    ).bind(snap.id).all();

    var prevMap = {};
    if (prevSnap) {
      var prevItems = await db.prepare(
        'SELECT rank, place_id, blog_count, visitor_count, save_count, score, image_count ' +
        'FROM snapshot_items WHERE snapshot_id=?'
      ).bind(prevSnap.id).all();
      prevItems.results.forEach(function (p) {
        prevMap[String(p.place_id)] = p;
      });
    }

    var items = curItems.results.map(function (it) {
      var p = prevMap[String(it.place_id)] || null;
      return {
        rank:             it.rank,
        place_id:         it.place_id,
        name:             it.name,
        category:         it.category,
        businessCategory: it.businessCategory,
        blog_count:       it.blog_count,
        visitor_count:    it.visitor_count,
        save_count:       it.save_count,
        score:            it.score,
        image_count:      it.image_count,
        microReview:      it.microReview,
        isTarget:         String(it.place_id) === String(tr.target_place_id),
        delta: p ? {
          rankDelta:    p.rank - it.rank,
          blogDelta:    (it.blog_count    || 0) - (p.blog_count    || 0),
          visitorDelta: (it.visitor_count || 0) - (p.visitor_count || 0),
          saveDelta:    (it.save_count    || 0) - (p.save_count    || 0),
          imgDelta:     (it.image_count   || 0) - (p.image_count   || 0)
        } : null
      };
    });

    return jsonResp({
      ok:       true,
      snapshot: snap,
      prevDate: prevSnap ? prevSnap.base_date : null,
      items:    items
    });
  }

  // ────────────────────────────────────────
  // 내부: 트래커 1건 수집
  // ────────────────────────────────────────
  async function collectTrack(db, tr) {
    var baseDate    = kstDateString();
    var collectedAt = kstNowString();

    var exists = await db.prepare(
      'SELECT id FROM snapshots WHERE track_id=? AND base_date=?'
    ).bind(tr.id, baseDate).first();
    if (exists) return { skipped: true, baseDate: baseDate };

    var kind   = tr.kind || 'restaurant';
    var result = await naverFetchResults(kind, tr.keyword, 1, 50, tr.x, tr.y, tr.device_type || 'pc');
    var items  = result.items;
    var total  = result.total;

    var targetRank = null;
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(tr.target_place_id)) { targetRank = i + 1; break; }
    }

    var ins = await db.prepare(
      'INSERT INTO snapshots(track_id, base_date, collected_at, total, target_rank) VALUES(?,?,?,?,?)'
    ).bind(tr.id, baseDate, collectedAt, total, targetRank).run();

    var snapshotId = ins.meta.last_row_id;
    var stmts = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      stmts.push(
        db.prepare(
          'INSERT INTO snapshot_items(snapshot_id, rank, place_id, name, category, businessCategory, blog_count, visitor_count, save_count, score, image_count, microReview) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(
          snapshotId, j + 1, String(it.id), it.name, it.category, it.businessCategory,
          it.blogCafeReviewCount  || 0,
          it.visitorReviewCount   || 0,
          it.saveCount            || 0,
          it.visitorReviewScore   != null ? String(it.visitorReviewScore) : null,
          it.imageCount           || 0,
          it.microReview          || null
        )
      );
    }
    if (stmts.length > 0) await db.batch(stmts);

    return { ok: true, baseDate, total, count: items.length, targetRank };
  }

  // scheduled cron에서도 사용하도록 export
  return {
    handleRankPlace,
    handleRankProxy,
    handleTrackCreate,
    handleTrackList,
    handleTrackDelete,
    handleCollect,
    handleTimeline,
    handleSnapshot,
    collectTrack,   // scheduled cron에서 직접 호출
  };
}
