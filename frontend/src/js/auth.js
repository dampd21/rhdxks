/**
 * SHERPAIN21 - Authentication Manager (v2.1)
 * JWT 저장/조회/검증, 로그인 상태 관리, 소셜 로그인 시작
 *
 * 기존 기능 100% 유지 + snowball 매핑
 * 의존: config.js (SHERPA_CONFIG)
 */
var SherpaAuth = (function() {
  'use strict';

  var SK = SHERPA_CONFIG.STORAGE_KEYS;

  // ════════════════════════════════════
  //  JWT / Token
  // ════════════════════════════════════

  function parseJWT(token) {
    try {
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }

  function isTokenExpired(token) {
    var payload = parseJWT(token);
    if (!payload || !payload.exp) return true;
    return payload.exp < Math.floor(Date.now() / 1000);
  }

  // ════════════════════════════════════
  //  Storage
  // ════════════════════════════════════

  function saveToken(token) {
    try { localStorage.setItem(SK.token, token); } catch (e) {}
  }

  function getToken() {
    try { return localStorage.getItem(SK.token) || null; } catch (e) { return null; }
  }

  /** 사용자 정보 저장 — snowball 매핑 포함 */
  function saveUser(userObj) {
    try {
      // tokens → snowball 매핑
      if (userObj && userObj.tokens !== undefined && userObj.snowball === undefined) {
        userObj.snowball = userObj.tokens;
      }
      localStorage.setItem(SK.user, JSON.stringify(userObj));
    } catch (e) {}
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(SK.user);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearAuth() {
    try {
      localStorage.removeItem(SK.token);
      localStorage.removeItem(SK.user);
    } catch (e) {}
  }

  // ════════════════════════════════════
  //  Login State
  // ════════════════════════════════════

  function isLoggedIn() {
    var token = getToken();
    if (!token) return false;
    return !isTokenExpired(token);
  }

  function getRole() {
    var user = getUser();
    if (user && user.role) return user.role;
    var token = getToken();
    if (token) {
      var payload = parseJWT(token);
      if (payload && payload.role) return payload.role;
    }
    return 'general';
  }

  function getPlan() {
    var user = getUser();
    if (user && user.plan) return user.plan;
    var token = getToken();
    if (token) {
      var payload = parseJWT(token);
      if (payload && payload.plan) return payload.plan;
    }
    return 'a';
  }

  /** 눈덩이 잔액 조회 */
  function getSnowball() {
    var user = getUser();
    if (user) return user.snowball || user.tokens || 0;
    return 0;
  }

  // ════════════════════════════════════
  //  OAuth Callback
  // ════════════════════════════════════

  function handleOAuthCallback() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');
    if (!token) return null;

    saveToken(token);
    var payload = parseJWT(token);
    if (payload) {
      saveUser({ id: payload.sub, role: payload.role, plan: payload.plan, name: payload.name || '' });
    }

    var cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    return {
      token: token,
      isNew: params.get('new') === 'true',
    };
  }

  // ════════════════════════════════════
  //  Social Login Triggers
  // ════════════════════════════════════

  function loginKakao() { window.location.href = SHERPA_CONFIG.API_URL + '/auth/kakao'; }
  function loginNaver() { window.location.href = SHERPA_CONFIG.API_URL + '/auth/naver'; }
  function loginGoogle() { window.location.href = SHERPA_CONFIG.API_URL + '/auth/google'; }

  // ════════════════════════════════════
  //  Logout
  // ════════════════════════════════════

  function logout() {
    clearAuth();
    window.location.href = SHERPA_CONFIG.PAGES.login;
  }

  // ════════════════════════════════════
  //  Guard
  // ════════════════════════════════════

  function requireLogin(opts) {
    opts = opts || {};
    if (!isLoggedIn()) {
      if (opts.message) alert(opts.message);
      window.location.href = SHERPA_CONFIG.PAGES.login;
      return false;
    }
    return true;
  }

  async function refreshUser() {
    if (!isLoggedIn()) return null;
    try {
      var res = await SherpaAPI.auth.me();
      if (res && res.user) {
        saveUser(res.user);
        return res.user;
      }
    } catch (e) {
      if (e.status === 401) {
        clearAuth();
      }
    }
    return null;
  }

  // ════════════════════════════════════
  //  Init
  // ════════════════════════════════════

  function init() {
    var token = getToken();
    if (token && isTokenExpired(token)) {
      clearAuth();
    }
    handleOAuthCallback();
  }

  init();

  // ── Public API ──
  return {
    getToken: getToken,
    saveToken: saveToken,
    parseJWT: parseJWT,
    isTokenExpired: isTokenExpired,

    getUser: getUser,
    saveUser: saveUser,
    getRole: getRole,
    getPlan: getPlan,
    getSnowball: getSnowball,
    refreshUser: refreshUser,

    isLoggedIn: isLoggedIn,
    clearAuth: clearAuth,
    logout: logout,

    loginKakao: loginKakao,
    loginNaver: loginNaver,
    loginGoogle: loginGoogle,
    handleOAuthCallback: handleOAuthCallback,

    requireLogin: requireLogin,
  };
})();
