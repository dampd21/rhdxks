(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var currentTab = 'usage';
  var currentPageByTab = { usage: 1, feature: 1 };
  var searchState = { scope: 'all', query: '' };

  var TAB_META = {
    usage: {
      title: '사용 오류/방법 문의',
      description: '화면 오류, 사용법, 설정 문제 등 실사용 중 불편을 접수합니다.'
    },
    feature: {
      title: '기능 건의',
      description: '추가되었으면 하는 기능과 운영 개선 아이디어를 제안합니다.'
    }
  };

  var state = {
    usage:   { rows: [], total: 0 },
    feature: { rows: [], total: 0 }
  };

  function qs(id) { return document.getElementById(id); }

  function esc(v) {
    return window.SherpaCore && typeof window.SherpaCore.escapeHTML === 'function'
      ? window.SherpaCore.escapeHTML(v)
      : String(v == null ? '' : v);
  }

  function setLoading() {
    var wrap = qs('inquiry-table-wrap');
    if (wrap) wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">불러오는 중...</p><p class="state-empty-desc">잠시만 기다려 주세요.</p></div>';
  }

  function renderPagination(total, page) {
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) return '';
    var html = '<div class="pagination">';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === page ? ' is-active' : '') + '" data-inquiry-page="' + i + '">' + i + '</button>';
    }
    html += '</div>';
    return html;
  }

  function renderTable() {
    var wrap = qs('inquiry-table-wrap');
    var rows = state[currentTab].rows;
    var total = state[currentTab].total;
    var page = currentPageByTab[currentTab];

    if (!rows.length) {
      wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">문의글이 없습니다</p><p class="state-empty-desc">첫 번째 문의를 남겨보세요.</p></div>';
      return;
    }

    var html = '<div class="board-table-wrap"><table class="board-table"><thead><tr>' +
      '<th>No</th><th>상태</th><th>제목</th><th>작성일</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (row) {
      var statusLabel = row.comment_count && row.comment_count > 0 ? '답변완료' : '답변대기';
      var statusClass = row.comment_count && row.comment_count > 0 ? 'badge-success' : 'badge-warning';
      html += '<tr>' +
        '<td>' + esc(String(row.id)) + '</td>' +
        '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td><a href="/app/support/inquiry-view.html?id=' + row.id + '">' + esc(row.title) + '</a></td>' +
        '<td>' + esc(row.created_at ? String(row.created_at).slice(0, 10) : '-') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    html += renderPagination(total, page);
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-inquiry-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentPageByTab[currentTab] = Number(btn.getAttribute('data-inquiry-page'));
        loadCurrentTab();
      });
    });
  }

  async function loadCurrentTab() {
    if (!window.SherpaAPI || !SherpaAPI.inquiry) {
      var wrap = qs('inquiry-table-wrap');
      if (wrap) wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">API가 연결되지 않았습니다</p></div>';
      return;
    }

    setLoading();

    try {
      var page = currentPageByTab[currentTab];
      var params = { category: currentTab, page: page, pageSize: PAGE_SIZE };
      if (searchState.query) { params.scope = searchState.scope; params.q = searchState.query; }

      var res = await SherpaAPI.inquiry.list(params);
      state[currentTab].rows  = res.posts || [];
      state[currentTab].total = res.total || 0;
      renderTable();

    } catch (err) {
      var wrap = qs('inquiry-table-wrap');
      if (wrap) {
        wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">불러오지 못했습니다</p><p class="state-empty-desc">' + esc(SherpaAPI.errorMessage(err)) + '</p></div>';
      }
    }
  }

  function syncHeader() {
    var meta = TAB_META[currentTab];
    qs('inquiry-current-title').textContent = meta.title;
    qs('inquiry-current-desc').textContent = meta.description;

    var openBtn = qs('inquiry-open-page-btn');
    if (openBtn) openBtn.href = '/app/support/inquiry-write.html?type=' + encodeURIComponent(currentTab);

    document.querySelectorAll('[data-inquiry-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-inquiry-tab') === currentTab);
    });
  }

  function switchTab(tab) {
    currentTab = TAB_META[tab] ? tab : 'usage';
    currentPageByTab[currentTab] = 1;
    if (window.SherpaCore && typeof window.SherpaCore.setTab === 'function') {
      window.SherpaCore.setTab(currentTab);
    }
    syncHeader();
    loadCurrentTab();
  }

  function bindEvents() {
    document.querySelectorAll('[data-inquiry-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-inquiry-tab')); });
    });

    var scopeEl = qs('inquiry-search-scope');
    if (scopeEl) {
      scopeEl.addEventListener('change', function () {
        searchState.scope = this.value;
        currentPageByTab[currentTab] = 1;
        loadCurrentTab();
      });
    }

    var inputEl = qs('inquiry-search-input');
    if (inputEl) {
      inputEl.addEventListener('input', function () {
        searchState.query = this.value;
        currentPageByTab[currentTab] = 1;
        loadCurrentTab();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-inquiry') return;
    var urlState = window.SherpaCore && typeof window.SherpaCore.getURLState === 'function'
      ? window.SherpaCore.getURLState() : { tab: 'usage' };
    currentTab = TAB_META[urlState.tab] ? urlState.tab : 'usage';
    bindEvents();
    syncHeader();
    loadCurrentTab();
  });
})();
