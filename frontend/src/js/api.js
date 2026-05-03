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

  var community = {
    list: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.board) q.set('board', params.board);
      if (params.category) q.set('category', params.category);
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.scope) q.set('scope', params.scope);
      if (params.q) q.set('q', params.q);
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
      if (params.page) q.set('page', String(params.page));
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

  var attendance = {
    status: function () {
      return request('GET', '/api/community/attendance/status', null, { timeout: 15000 });
    },
    feed: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      return request('GET', '/api/community/attendance/feed?' + q.toString(), null, { timeout: 15000 });
    },
    checkin: function (message) {
      return request('POST', '/api/community/attendance/checkin', { message: message }, { timeout: 15000 });
    }
  };

  var escrow = {
    create: function (payload) {
      return request('POST', '/escrow/create', payload, { timeout: 15000 });
    },
    list: function (params) {
      params = params || {};
      var q = new URLSearchParams();
      if (params.status) q.set('status', params.status);
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
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

  window.SherpaAPI = {
    request: request,
    uploadFile: uploadFile,
    errorMessage: errorMessage,
    community: community,
    attendance: attendance,
    escrow: escrow
  };
})();
