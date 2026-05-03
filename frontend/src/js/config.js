(function () {
  'use strict';

  var STORAGE_KEYS = {
    token: 'sherpa_token',
    user: 'sherpa_user',
    sidebarCollapsed: 'sherpa_sidebar_collapsed'
  };

  var PAGES = {
    dashboard: '/app/dashboard.html',
    placeRank: '/app/place/rank.html',
    community: '/app/community/board.html',
    partner: '/app/partner/services.html',
    missions: '/app/escrow/missions.html',
    inquiry: '/app/support/inquiry.html',
    cs: '/app/support/cs.html',
    billing: '#billing',
    profile: '#profile'
  };

  function defaultUser() {
    return {
      name: '대표님',
      email: 'owner@sherpain21.com',
      plan: 'pro',
      snowball: 125000
    };
  }

  function normalizePlan(plan) {
    var value = String(plan || 'basic').toLowerCase();
    if (value === 'a') return 'basic';
    if (value === 'b') return 'standard';
    if (value === 'c') return 'pro';
    if (['basic', 'standard', 'pro'].indexOf(value) === -1) return 'basic';
    return value;
  }

  function planLabel(plan) {
    var value = normalizePlan(plan);
    if (value === 'pro') return 'PRO';
    if (value === 'standard') return 'STANDARD';
    return 'BASIC';
  }

  function planClass(plan) {
    return normalizePlan(plan);
  }

  function parseJSON(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function mergeUser(base, next) {
    var user = Object.assign({}, base, next || {});
    user.plan = normalizePlan(user.plan);
    if (typeof user.snowball !== 'number') user.snowball = Number(user.snowball || user.token || user.tokens || 0);
    return user;
  }

  function getUser() {
    var fallback = defaultUser();
    var stored = parseJSON(localStorage.getItem(STORAGE_KEYS.user));
    if (!stored) return fallback;
    return mergeUser(fallback, stored);
  }

  function saveUser(nextUser) {
    var user = mergeUser(defaultUser(), nextUser);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('sherpa:user-updated', { detail: user }));
    return user;
  }

  function updateUser(patch) {
    return saveUser(Object.assign({}, getUser(), patch || {}));
  }

  function updateSnowball(delta) {
    var user = getUser();
    user.snowball = Math.max(0, Number(user.snowball || 0) + Number(delta || 0));
    return saveUser(user);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('ko-KR');
  }

  function formatSnowball(value) {
    return formatNumber(value) + ' 눈덩이';
  }

  function escapeHTML(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function getURLState() {
    var url = new URL(window.location.href);
    return {
      pathname: url.pathname,
      tab: url.searchParams.get('tab') || '',
      hash: url.hash || ''
    };
  }

  function setTab(tab) {
    var url = new URL(window.location.href);
    if (tab) url.searchParams.set('tab', tab);
    else url.searchParams.delete('tab');
    history.replaceState({}, '', url.toString());
  }

  function setHash(hash) {
    var url = new URL(window.location.href);
    url.hash = hash ? '#' + String(hash).replace(/^#/, '') : '';
    history.replaceState({}, '', url.toString());
  }

  function appHref(path) {
    if (!path) return '#';
    return path;
  }

  function ensureDefaultUser() {
    if (!localStorage.getItem(STORAGE_KEYS.user)) {
      saveUser(defaultUser());
    }
  }

  window.SHERPA_CONFIG = {
    API_URL: 'https://sherpa-api.sherpain21.workers.dev',
    STORAGE_KEYS: STORAGE_KEYS,
    PAGES: PAGES,
    KAKAO_CS_URL: 'https://pf.kakao.com/_placeholder',
    DEFAULT_NOTIFICATIONS: []
  };

  window.SherpaCore = {
    defaultUser: defaultUser,
    normalizePlan: normalizePlan,
    planLabel: planLabel,
    planClass: planClass,
    getUser: getUser,
    saveUser: saveUser,
    updateUser: updateUser,
    updateSnowball: updateSnowball,
    formatNumber: formatNumber,
    formatSnowball: formatSnowball,
    escapeHTML: escapeHTML,
    getURLState: getURLState,
    setTab: setTab,
    setHash: setHash,
    appHref: appHref,
    ensureDefaultUser: ensureDefaultUser
  };

  ensureDefaultUser();
})();
