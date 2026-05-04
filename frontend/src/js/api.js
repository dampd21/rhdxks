(function () {
  'use strict';

  var BASE = (window.SHERPA_CONFIG && SHERPA_CONFIG.API_URL) || '';
  var TOKEN_KEY = (window.SHERPA_CONFIG && window.SHERPA_CONFIG.STORAGE_KEYS && window.SHERPA_CONFIG.STORAGE_KEYS.token) || 'sherpa_token';

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  async function request(method, path, body, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var token = getToken();
    if (!options.noAuth && token) headers.Authorization = 'Bearer ' + token;

    var controller = new AbortController();
    var timeout = options.timeout || 20000;
    var timer = setTimeout(function () { controller.abort(); }, timeout);

    try {
      var response = await fetch(BASE + path, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      clearTimeout(timer);

      var contentType = response.headers.get('content-type') || '';
      var data = contentType.indexOf('application/json') !== -1 ? await response.json() : await response.text();

      if (!response.ok) {
        var err = new Error((data && (data.error || data.message)) || 'API Error');
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      clearTimeout(timer);
      if (error.name === 'AbortError') {
        var timeoutErr = new Error('요청 시간이 초과되었습니다.');
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw error;
    }
  }

  async function uploadFile(path, file, options) {
    options = options || {};
    var token = getToken();
    var headers = Object.assign({}, options.headers || {});
    if (!options.noAuth && token) headers.Authorization = 'Bearer ' + token;

    var form = new FormData();
    form.append('file', file, file.name || 'image');

    var controller = new AbortController();
    var timeout = options.timeout || 30000;
    var timer = setTimeout(function () { controller.abort(); }, timeout);

    try {
      var response = await fetch(BASE + path, {
        method: 'POST',
        headers: headers,
        body: form,
        signal: controller.signal
      });
      clearTimeout(timer);

      var contentType = response.headers.get('content-type') || '';
      var data = contentType.indexOf('application/json') !== -1 ? await response.json() : await response.text();

      if (!response.ok) {
        var err = new Error((data && (data.error || data.message)) || 'Upload Error');
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      clearTimeout(timer);
      if (error.name === 'AbortError') {
        var timeoutErr = new Error('업로드 시간이 초과되었습니다.');
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw error;
    }
  }

  function errorMessage(err) {
    if (!err) return '알 수 없는 오류가 발생했습니다.';
    if (err.isTimeout) return '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.';
    if (err.data && err.data.error) return err.data.error;
    return err.message || '알 수 없는 오류가 발생했습니다.';
  }

  // ── 플레이스 순위 조회 ──────────────────────────────────────
  var rank = {
    // 순위 조회 (GET /rank/place)
    place: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.keyword)    q.set('keyword',    params.keyword);
      if (params.kind)       q.set('kind',       params.kind);
      if (params.x)          q.set('x',          String(params.x));
      if (params.y)          q.set('y',          String(params.y));
      if (params.deviceType) q.set('deviceType', params.deviceType);
      if (params.display)    q.set('display',    String(params.display));
      if (params.start)      q.set('start',      String(params.start));
      if (params.store)      q.set('store',      params.store);
      return request('GET', '/rank/place?' + q.toString(), null, { timeout: 30000 });
    },
    // 추적 목록 (GET /rank/tracks)
    tracks: function (workspaceId) {
      var q = new URLSearchParams();
      q.set('workspaceId', workspaceId || 'default');
      return request('GET', '/rank/tracks?' + q.toString(), null, { timeout: 15000 });
    },
    // 추적 등록 (POST /rank/track)
    trackCreate: function (payload) {
      return request('POST', '/rank/track', payload, { timeout: 15000 });
    },
    // 추적 삭제 (DELETE /rank/track)
    trackDelete: function (workspaceId, trackId) {
      var q = new URLSearchParams();
      q.set('workspaceId', workspaceId || 'default');
      q.set('id', String(trackId));
      return request('DELETE', '/rank/track?' + q.toString(), null, { timeout: 15000 });
    },
    // 즉시 수집 (POST /rank/collect)
    collect: function (workspaceId, trackId) {
      var q = new URLSearchParams();
      q.set('workspaceId', workspaceId || 'default');
      q.set('trackId',     String(trackId));
      return request('POST', '/rank/collect?' + q.toString(), null, { timeout: 60000 });
    },
    // 타임라인 (GET /rank/timeline)
    timeline: function (workspaceId, trackId, limit) {
      var q = new URLSearchParams();
      q.set('workspaceId', workspaceId || 'default');
      q.set('trackId',     String(trackId));
      if (limit) q.set('limit', String(limit));
      return request('GET', '/rank/timeline?' + q.toString(), null, { timeout: 15000 });
    },
    // 스냅샷 상세 (GET /rank/snapshot)
    snapshot: function (workspaceId, trackId, date) {
      var q = new URLSearchParams();
      q.set('workspaceId', workspaceId || 'default');
      q.set('trackId',     String(trackId));
      q.set('date',        date);
      return request('GET', '/rank/snapshot?' + q.toString(), null, { timeout: 15000 });
    }
  };

  // ── 플레이스 상세 / SEO 분석 ───────────────────────────────
  // place-seo-analysis.js 가 SherpaAPI.place.* 로 호출함
  var place = {
    // 플레이스 상세 정보 (GET /place/detail)
    detail: function (placeId, kind) {
      var q = new URLSearchParams();
      q.set('placeId', String(placeId));
      if (kind) q.set('kind', kind);
      return request('GET', '/place/detail?' + q.toString(), null, { timeout: 15000 });
    },
    // 플레이스 키워드 (GET /place/keywords)
    keywords: function (placeId, kind) {
      var q = new URLSearchParams();
      q.set('placeId', String(placeId));
      if (kind) q.set('kind', kind);
      return request('GET', '/place/keywords?' + q.toString(), null, { timeout: 15000 });
    },
    // 플레이스 테마/리뷰 통계 (GET /place/themes)
    themes: function (placeId, kind) {
      var q = new URLSearchParams();
      q.set('placeId', String(placeId));
      if (kind) q.set('kind', kind);
      return request('GET', '/place/themes?' + q.toString(), null, { timeout: 15000 });
    },
    // 방문자 리뷰 목록 (GET /place/reviews)
    reviews: function (placeId, kind, size, sort) {
      var q = new URLSearchParams();
      q.set('placeId', String(placeId));
      if (kind) q.set('kind', kind);
      if (size) q.set('size', String(size));
      if (sort) q.set('sort', sort);
      return request('GET', '/place/reviews?' + q.toString(), null, { timeout: 15000 });
    }
  };

  // ── 리뷰 대시보드 통계 ────────────────────────────────────
  // place-seo-analysis.js 가 SherpaAPI.review.stats() 로 호출함
  var review = {
    // 리뷰 통계 (GET /review/stats)
    // businessId: 스마트플레이스 비즈니스 ID
    // startDate / endDate: YYYY-MM-DD
    // force: 캐시 무시 여부
    stats: function (businessId, startDate, endDate, force) {
      var q = new URLSearchParams();
      q.set('businessId', String(businessId));
      q.set('startDate',  String(startDate));
      q.set('endDate',    String(endDate));
      if (force) q.set('force', '1');
      return request('GET', '/review/stats?' + q.toString(), null, { timeout: 20000 });
    }
  };

  // ── 커뮤니티 ──────────────────────────────────────────────
  var community = {
    list: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.board)    q.set('board',    params.board);
      if (params.category) q.set('category', params.category);
      if (params.page)     q.set('page',     String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.scope)    q.set('scope',    params.scope);
      if (params.q)        q.set('q',        params.q);
      return request('GET', '/api/community/posts?' + q.toString(), null, { timeout: 15000 });
    },
    detail: function (id) {
      return request('GET', '/api/community/posts/' + encodeURIComponent(id), null, { timeout: 15000 });
    },
    create: function (payload) {
      return request('POST', '/api/community/posts', payload, { timeout: 15000 });
    },
    comments: function (id, params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.page)     q.set('page',     String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      var suffix = q.toString() ? ('?' + q.toString()) : '';
      return request('GET', '/api/community/posts/' + encodeURIComponent(id) + '/comments' + suffix, null, { timeout: 15000 });
    },
    addComment: function (id, payload) {
      return request('POST', '/api/community/posts/' + encodeURIComponent(id) + '/comments', payload, { timeout: 15000 });
    },
    uploadImage: function (file) {
      return uploadFile('/api/community/images', file, { timeout: 30000 });
    }
  };

  // ── 출석체크 ───────────────────────────────────────────────
  var attendance = {
    status: function () {
      return request('GET', '/api/community/attendance/status', null, { timeout: 15000 });
    },
    feed: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.page)     q.set('page',     String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      return request('GET', '/api/community/attendance/feed?' + q.toString(), null, { timeout: 15000 });
    },
    checkin: function (message) {
      return request('POST', '/api/community/attendance/checkin', { message: message }, { timeout: 15000 });
    }
  };

  // ── 에스크로 ───────────────────────────────────────────────
  var escrow = {
    create: function (payload) {
      return request('POST', '/escrow/create', payload, { timeout: 15000 });
    },
    list: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.status) q.set('status', params.status);
      if (params.page)   q.set('page',   String(params.page));
      if (params.limit)  q.set('limit',  String(params.limit));
      return request('GET', '/escrow/list?' + q.toString(), null, { timeout: 15000 });
    },
    detail: function (id) {
      return request('GET', '/escrow/detail?id=' + encodeURIComponent(id), null, { timeout: 15000 });
    },
    apply: function (missionId) {
      return request('POST', '/escrow/apply', { mission_id: missionId }, { timeout: 15000 });
    },
    approve: function (applicationId) {
      return request('POST', '/escrow/approve', { application_id: applicationId }, { timeout: 15000 });
    }
  };

  // ── CS (고객센터) ──────────────────────────────────────────
  var cs = {
    faqList: function () {
      return request('GET', '/api/cs/faqs', null, { timeout: 15000 });
    },
    faqDetail: function (id) {
      return request('GET', '/api/cs/faqs/' + encodeURIComponent(id), null, { timeout: 15000 });
    },
    qnaList: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.page)     q.set('page',     String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.scope)    q.set('scope',    params.scope);
      if (params.q)        q.set('q',        params.q);
      return request('GET', '/api/cs/qna?' + q.toString(), null, { timeout: 15000 });
    },
    qnaCreate: function (payload) {
      return request('POST', '/api/cs/qna', payload, { timeout: 15000 });
    },
    qnaDetail: function (id) {
      return request('GET', '/api/cs/qna/' + encodeURIComponent(id), null, { timeout: 15000 });
    },
    ticketList: function () {
      return request('GET', '/api/cs/tickets', null, { timeout: 15000 });
    },
    ticketCreate: function (payload) {
      return request('POST', '/api/cs/tickets', payload, { timeout: 15000 });
    },
    ticketDetail: function (id) {
      return request('GET', '/api/cs/tickets/' + encodeURIComponent(id), null, { timeout: 15000 });
    }
  };

  // ── 프로그램 문의 ──────────────────────────────────────────
  var inquiry = {
    list: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.category) q.set('category', params.category);
      if (params.page)     q.set('page',     String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.scope)    q.set('scope',    params.scope);
      if (params.q)        q.set('q',        params.q);
      return request('GET', '/api/inquiry/posts?' + q.toString(), null, { timeout: 15000 });
    },
    create: function (payload) {
      return request('POST', '/api/inquiry/posts', payload, { timeout: 15000 });
    },
    detail: function (id) {
      return request('GET', '/api/inquiry/posts/' + encodeURIComponent(id), null, { timeout: 15000 });
    }
  };

  // ── 자유홍보 / 파트너사 ────────────────────────────────────
  var promo = {
    partnerList: function () {
      return request('GET', '/api/promo/partners', null, { timeout: 15000 });
    },
    list: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.page)     q.set('page',     String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.scope)    q.set('scope',    params.scope);
      if (params.q)        q.set('q',        params.q);
      return request('GET', '/api/promo/posts?' + q.toString(), null, { timeout: 15000 });
    },
    create: function (payload) {
      return request('POST', '/api/promo/posts', payload, { timeout: 15000 });
    },
    detail: function (id) {
      return request('GET', '/api/promo/posts/' + encodeURIComponent(id), null, { timeout: 15000 });
    }
  };

  // ── 인증 ───────────────────────────────────────────────────
  var auth = {
    me: function () {
      return request('GET', '/auth/me', null, { timeout: 15000 });
    },
    signup: function (payload) {
      return request('POST', '/auth/signup', payload, { timeout: 15000 });
    },
    login: function (payload) {
      return request('POST', '/auth/login', payload, { timeout: 15000 });
    }
  };

  window.SherpaAPI = {
    request:    request,
    uploadFile: uploadFile,
    errorMessage: errorMessage,
    rank:       rank,       // place-rank.js
    place:      place,      // place-seo-analysis.js
    review:     review,     // place-seo-analysis.js
    community:  community,
    attendance: attendance,
    escrow:     escrow,
    cs:         cs,
    inquiry:    inquiry,
    promo:      promo,
    auth:       auth
  };
})();
