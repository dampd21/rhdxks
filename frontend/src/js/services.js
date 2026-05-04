(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var currentTab = 'premium';
  var currentPageByTab = { premium: 1, promo: 1 };
  var searchState = { scope: 'all', query: '' };

  var TAB_META = {
    premium: {
      title: '공식 제휴 파트너사',
      description: '플랫폼과 공식 계약을 맺은 전문 대행사 및 솔루션 목록입니다.',
      listTitle: '제휴사 목록',
      searchable: false,
      actionLabel: '문의/신청하기'
    },
    promo: {
      title: '자유홍보 게시판',
      description: '자유홍보 게시판은 무료 작성 1회 후 500 눈덩이 차감 정책이 적용됩니다.',
      listTitle: '자유홍보 글 목록',
      searchable: true,
      actionLabel: '홍보 글쓰기'
    }
  };

  var state = {
    partners: [],
    promo: { rows: [], total: 0 }
  };

  function qs(id) { return document.getElementById(id); }

  function esc(v) {
    return window.SherpaCore && typeof SherpaCore.escapeHTML === 'function'
      ? SherpaCore.escapeHTML(v)
      : String(v == null ? '' : v)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  }

  function formatNumber(v) {
    return window.SherpaCore && typeof SherpaCore.formatNumber === 'function'
      ? SherpaCore.formatNumber(v)
      : Number(v || 0).toLocaleString('ko-KR');
  }

  function setLoading(msg) {
    var wrap = qs('services-table-wrap');
    if (wrap) wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">' + (msg || '불러오는 중...') + '</p></div>';
  }

  function renderPagination(total, page) {
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) return '';
    var html = '<div class="pagination">';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === page ? ' is-active' : '') + '" data-services-page="' + i + '">' + i + '</button>';
    }
    html += '</div>';
    return html;
  }

  // ── 파트너사 렌더 ──
  function renderPremiumTable() {
    var wrap = qs('services-table-wrap');
    var partners = state.partners;

    if (!partners.length) {
      wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">등록된 파트너사가 없습니다</p></div>';
      return;
    }

    var html = '<div class="board-table-wrap"><table class="board-table"><thead><tr>' +
      '<th>상태</th><th>업체명</th><th>서비스</th><th>소개</th><th>문의</th>' +
      '</tr></thead><tbody>';

    partners.forEach(function (p) {
      var isOfficial = p.status === 'official';
      html += '<tr>' +
        '<td><span class="badge ' + (isOfficial ? 'badge-success' : 'badge-muted') + '">' + esc(isOfficial ? '공식 파트너' : '준비중') + '</span></td>' +
        '<td><strong>' + esc(p.name) + '</strong></td>' +
        '<td>' + esc(p.service_category || '-') + '</td>' +
        '<td>' + esc(p.description || '-') + '</td>' +
        '<td>' + (isOfficial && p.inquiry_url
          ? '<a href="' + esc(p.inquiry_url) + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline">문의/신청</a>'
          : '<span class="text-muted">준비중</span>') +
        '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  // ── 자유홍보 렌더 ──
  function renderPromoTable() {
    var wrap = qs('services-table-wrap');
    var rows  = state.promo.rows;
    var total = state.promo.total;
    var page  = currentPageByTab['promo'];

    if (!rows.length) {
      wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">자유홍보 글이 없습니다</p><p class="state-empty-desc">첫 번째 홍보글을 등록해 보세요.</p></div>';
      return;
    }

    var html = '<div class="board-table-wrap"><table class="board-table"><thead><tr>' +
      '<th>분류</th><th>제목</th><th>작성자</th><th>작성일</th><th>조회수</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (row) {
      html += '<tr>' +
        '<td>' + esc(row.category || '-') + '</td>' +
        '<td><a href="/app/partner/promo-view.html?id=' + row.id + '">' + esc(row.title) + '</a></td>' +
        '<td>' + esc(row.author_name || '-') + '</td>' +
        '<td>' + esc(row.created_at ? String(row.created_at).slice(0, 10) : '-') + '</td>' +
        '<td>' + formatNumber(row.view_count || 0) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    html += renderPagination(total, page);
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-services-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentPageByTab['promo'] = Number(btn.getAttribute('data-services-page'));
        loadPromo();
      });
    });
  }

  // ── 로드: 파트너사 ──
  async function loadPremium() {
    if (!window.SherpaAPI || !SherpaAPI.promo) { setLoading('API가 연결되지 않았습니다.'); return; }
    setLoading();
    try {
      var res = await SherpaAPI.promo.partnerList();
      state.partners = res.partners || [];
      renderPremiumTable();
    } catch (err) {
      var wrap = qs('services-table-wrap');
      if (wrap) wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">불러오지 못했습니다</p><p class="state-empty-desc">' + esc(SherpaAPI.errorMessage(err)) + '</p></div>';
    }
  }

  // ── 로드: 자유홍보 ──
  async function loadPromo() {
    if (!window.SherpaAPI || !SherpaAPI.promo) { setLoading('API가 연결되지 않았습니다.'); return; }
    setLoading();
    try {
      var page = currentPageByTab['promo'];
      var params = { page: page, pageSize: PAGE_SIZE };
      if (searchState.query) { params.scope = searchState.scope; params.q = searchState.query; }
      var res = await SherpaAPI.promo.list(params);
      state.promo.rows  = res.posts || [];
      state.promo.total = res.total || 0;
      renderPromoTable();
    } catch (err) {
      var wrap = qs('services-table-wrap');
      if (wrap) wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">불러오지 못했습니다</p><p class="state-empty-desc">' + esc(SherpaAPI.errorMessage(err)) + '</p></div>';
    }
  }

  function renderCurrentTab() {
    if (currentTab === 'premium') loadPremium();
    else loadPromo();
  }

  function syncHeader() {
    var meta = TAB_META[currentTab];
    qs('services-current-title').textContent = meta.title;
    qs('services-current-desc').textContent = meta.description;
    qs('services-list-title').textContent = meta.listTitle;

    var primaryBtn = qs('services-primary-btn');
    if (primaryBtn) primaryBtn.textContent = meta.actionLabel;

    var searchBox = qs('services-search-box');
    if (searchBox) searchBox.style.display = meta.searchable ? 'flex' : 'none';

    document.querySelectorAll('[data-services-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-services-tab') === currentTab);
    });

    if (!meta.searchable) {
      searchState.query = '';
      var inputEl = qs('services-search-input');
      if (inputEl) inputEl.value = '';
      currentPageByTab[currentTab] = 1;
    }
  }

  function switchTab(tab) {
    currentTab = TAB_META[tab] ? tab : 'premium';
    currentPageByTab[currentTab] = 1;
    history.replaceState({}, '', currentTab === 'promo' ? '#promo' : '#premium');
    syncHeader();
    renderCurrentTab();
  }

  // ── 홍보 글쓰기 버튼 ──
  function handlePrimaryBtn() {
    if (currentTab === 'promo') {
      window.location.href = '/app/partner/promo-write.html';
    }
  }

  function bindEvents() {
    document.querySelectorAll('[data-services-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-services-tab')); });
    });

    var primaryBtn = qs('services-primary-btn');
    if (primaryBtn) primaryBtn.addEventListener('click', handlePrimaryBtn);

    var scopeEl = qs('services-search-scope');
    if (scopeEl) {
      scopeEl.addEventListener('change', function () {
        searchState.scope = this.value;
        currentPageByTab[currentTab] = 1;
        loadPromo();
      });
    }

    var inputEl = qs('services-search-input');
    if (inputEl) {
      inputEl.addEventListener('input', function () {
        searchState.query = this.value;
        currentPageByTab[currentTab] = 1;
        loadPromo();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'partner-services') return;

    // URL hash로 초기 탭 결정
    var hash = window.location.hash;
    if (hash === '#promo') currentTab = 'promo';
    else currentTab = 'premium';

    bindEvents();
    syncHeader();
    renderCurrentTab();
  });
})();
