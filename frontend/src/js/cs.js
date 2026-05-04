(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var currentTab = 'faq';
  var currentPageByTab = { faq: 1, qna: 1, '1on1': 1 };
  var searchState = { scope: 'all', query: '' };

  var TAB_META = {
    faq:   { title: '자주 묻는 질문 (FAQ)', description: '결제, 계정, 이용 흐름 관련 자주 받는 질문을 빠르게 확인합니다.', listTitle: 'FAQ 목록', searchable: false },
    qna:   { title: 'Q&A 게시판', description: '일반 문의를 공개 게시판 형식으로 확인하는 영역입니다.', listTitle: 'Q&A 목록', searchable: true },
    '1on1':{ title: '1:1 문의 내역', description: '민감한 계정/결제/환불 문의는 1:1로 남기고 상태를 확인합니다.', listTitle: '1:1 문의 내역', searchable: true }
  };

  // 상태
  var state = {
    faq:   { rows: [], total: 0 },
    qna:   { rows: [], total: 0 },
    '1on1':{ rows: [], total: 0 }
  };

  function qs(id) { return document.getElementById(id); }

  function esc(v) {
    return window.SherpaCore && SherpaCore.escapeHTML
      ? SherpaCore.escapeHTML(v)
      : String(v == null ? '' : v);
  }

  function setLoading(msg) {
    var wrap = qs('cs-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">' + (msg || '불러오는 중...') + '</p></div>';
  }

  function renderPagination(total, currentPage, tab) {
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) return '';
    var html = '<div class="pagination">';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === currentPage ? ' is-active' : '') + '" data-cs-page="' + i + '">' + i + '</button>';
    }
    html += '</div>';
    return html;
  }

  // ── FAQ 렌더 ──
  function renderFaqTable(rows) {
    var wrap = qs('cs-table-wrap');
    if (!rows.length) {
      wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">FAQ가 없습니다</p></div>';
      return;
    }
    var html = '<div class="board-table-wrap"><table class="board-table"><thead><tr>' +
      '<th>No</th><th>분류</th><th>질문 제목</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (row, idx) {
      html += '<tr>' +
        '<td>' + (rows.length - idx) + '</td>' +
        '<td>' + esc(row.category || '-') + '</td>' +
        '<td><a href="/app/support/cs-view.html?tab=faq&id=' + row.id + '">' + esc(row.title) + '</a></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  // ── Q&A 렌더 ──
  function renderQnaTable(rows, total, page) {
    var wrap = qs('cs-table-wrap');
    if (!rows.length) {
      wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">게시글이 없습니다</p><p class="state-empty-desc">첫 번째 Q&amp;A를 작성해 보세요.</p></div>';
      return;
    }
    var html = '<div class="board-table-wrap"><table class="board-table"><thead><tr>' +
      '<th>No</th><th>제목</th><th>작성자</th><th>작성일</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (row) {
      var commentSuffix = row.comment_count && row.comment_count > 0
        ? ' <span class="comment-count">+' + row.comment_count + '</span>' : '';
      html += '<tr>' +
        '<td>' + esc(String(row.id)) + '</td>' +
        '<td><a href="/app/support/cs-view.html?tab=qna&id=' + row.id + '">' + esc(row.title) + commentSuffix + '</a></td>' +
        '<td>' + esc(row.author_name || '-') + '</td>' +
        '<td>' + esc(row.created_at ? String(row.created_at).slice(0, 10) : '-') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += renderPagination(total, page, 'qna');
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-cs-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentPageByTab['qna'] = Number(btn.getAttribute('data-cs-page'));
        loadCurrentTab();
      });
    });
  }

  // ── 1:1 티켓 렌더 ──
  function renderTicketTable(rows) {
    var wrap = qs('cs-table-wrap');
    if (!rows.length) {
      wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">1:1 문의 내역이 없습니다</p><p class="state-empty-desc">문의 글쓰기 버튼으로 첫 문의를 남겨보세요.</p></div>';
      return;
    }
    var html = '<div class="board-table-wrap"><table class="board-table"><thead><tr>' +
      '<th>No</th><th>상태</th><th>제목</th><th>작성일</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (row, idx) {
      var statusLabel = row.status === 'done' ? '답변완료' : '답변대기';
      var statusClass = row.status === 'done' ? 'badge-success' : 'badge-warning';
      html += '<tr>' +
        '<td>' + (rows.length - idx) + '</td>' +
        '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td><a href="/app/support/cs-view.html?tab=1on1&id=' + row.id + '">' + esc(row.title) + '</a></td>' +
        '<td>' + esc(row.created_at ? String(row.created_at).slice(0, 10) : '-') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  // ── 데이터 로드 ──
  async function loadCurrentTab() {
    if (!window.SherpaAPI || !SherpaAPI.cs) {
      setLoading('API가 연결되지 않았습니다.');
      return;
    }

    setLoading();

    try {
      if (currentTab === 'faq') {
        var res = await SherpaAPI.cs.faqList();
        state.faq.rows = res.faqs || [];
        renderFaqTable(state.faq.rows);

      } else if (currentTab === 'qna') {
        var page = currentPageByTab['qna'];
        var params = { page: page, pageSize: PAGE_SIZE };
        if (searchState.query) { params.scope = searchState.scope; params.q = searchState.query; }
        var res2 = await SherpaAPI.cs.qnaList(params);
        state.qna.rows = res2.posts || [];
        state.qna.total = res2.total || 0;
        renderQnaTable(state.qna.rows, state.qna.total, page);

      } else if (currentTab === '1on1') {
        // 1:1 티켓은 로그인 필요
        if (window.SherpaAuth && !SherpaAuth.isLoggedIn()) {
          qs('cs-table-wrap').innerHTML = '<div class="state-empty"><p class="state-empty-title">로그인이 필요합니다</p><p class="state-empty-desc">1:1 문의는 로그인 후 확인할 수 있습니다.</p></div>';
          return;
        }
        var res3 = await SherpaAPI.cs.ticketList();
        state['1on1'].rows = res3.tickets || [];
        renderTicketTable(state['1on1'].rows);
      }
    } catch (err) {
      var wrap = qs('cs-table-wrap');
      if (wrap) {
        wrap.innerHTML = '<div class="state-empty"><p class="state-empty-title">불러오지 못했습니다</p><p class="state-empty-desc">' + esc(SherpaAPI.errorMessage(err)) + '</p></div>';
      }
    }
  }

  function syncHeader() {
    var meta = TAB_META[currentTab];
    qs('cs-current-title').textContent = meta.title;
    qs('cs-current-desc').textContent = meta.description;
    qs('cs-list-title').textContent = meta.listTitle;

    document.querySelectorAll('[data-cs-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-cs-tab') === currentTab);
    });

    // 1:1 문의 글쓰기 버튼
    var writeBtn = qs('cs-open-modal-btn');
    if (writeBtn) {
      writeBtn.style.display = currentTab === '1on1' ? 'inline-flex' : 'none';
      writeBtn.onclick = function () { window.location.href = '/app/support/cs-write.html'; };
    }

    // 검색창
    var searchBox = qs('cs-search-box');
    if (searchBox) {
      searchBox.style.display = meta.searchable ? 'flex' : 'none';
    }
    if (!meta.searchable) {
      searchState.query = '';
      var searchInput = qs('cs-search-input');
      if (searchInput) searchInput.value = '';
      currentPageByTab[currentTab] = 1;
    }
  }

  function switchTab(tab) {
    currentTab = TAB_META[tab] ? tab : 'faq';
    currentPageByTab[currentTab] = 1;
    if (window.SherpaCore && SherpaCore.setTab) SherpaCore.setTab(currentTab);
    syncHeader();
    loadCurrentTab();
  }

  function bindEvents() {
    document.querySelectorAll('[data-cs-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-cs-tab')); });
    });

    var scopeEl = qs('cs-search-scope');
    if (scopeEl) {
      scopeEl.addEventListener('change', function () {
        searchState.scope = this.value;
        currentPageByTab[currentTab] = 1;
        loadCurrentTab();
      });
    }

    var inputEl = qs('cs-search-input');
    if (inputEl) {
      inputEl.addEventListener('input', function () {
        searchState.query = this.value;
        currentPageByTab[currentTab] = 1;
        loadCurrentTab();
      });
    }

    var kakaoBtn = qs('cs-kakao-btn');
    if (kakaoBtn) {
      kakaoBtn.addEventListener('click', function () {
        window.open((window.SHERPA_CONFIG && window.SHERPA_CONFIG.KAKAO_CS_URL) || '#', '_blank', 'noopener');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-cs') return;
    var urlState = window.SherpaCore && window.SherpaCore.getURLState ? window.SherpaCore.getURLState() : { tab: 'faq' };
    currentTab = TAB_META[urlState.tab] ? urlState.tab : 'faq';
    bindEvents();
    syncHeader();
    loadCurrentTab();
  });
})();
