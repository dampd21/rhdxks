(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var STORAGE_KEY = 'sherpa_cs_posts_v2';
  var currentTab = 'faq';
  var currentPageByTab = { faq: 1, qna: 1, '1on1': 1 };
  var searchState = { scope: 'all', query: '' };

  var TAB_META = {
    faq: { title: '자주 묻는 질문 (FAQ)', description: '결제, 계정, 이용 흐름 관련 자주 받는 질문을 빠르게 확인합니다.', listTitle: 'FAQ 목록', searchable: false },
    qna: { title: 'Q&A 게시판', description: '일반 문의를 공개 게시판 형식으로 확인하는 영역입니다.', listTitle: 'Q&A 목록', searchable: true },
    '1on1': { title: '1:1 문의 내역', description: '민감한 계정/결제/환불 문의는 1:1로 남기고 상태를 확인합니다.', listTitle: '1:1 문의 내역', searchable: true }
  };

  var faqRows = [
    { id: 7, no: 7, category: '결제/환불', title: 'PRO 요금제에서 결제 수단을 변경하고 싶습니다.', content: '결제 수단 변경 방법과 적용 시점을 안내합니다.' },
    { id: 6, no: 6, category: '계정/로그인', title: '카카오 간편 가입 후 이메일 계정과 연동할 수 있나요?', content: '소셜 계정과 이메일 계정 연동 가능 여부를 설명합니다.' },
    { id: 5, no: 5, category: '이용안내', title: '영수증 리뷰 모집/의뢰 시 플랫폼 수수료는 어떻게 되나요?', content: '미션 보상과 플랫폼 수수료 계산 기준을 정리합니다.' },
    { id: 4, no: 4, category: '이용안내', title: '출석체크는 하루에 한 번만 가능한가요?', content: '출석체크 가능 횟수와 리워드 정책을 안내합니다.' },
    { id: 3, no: 3, category: '플레이스', title: 'Place ID는 어디에서 확인하나요?', content: '네이버 플레이스 URL에서 Place ID를 확인하는 방법을 설명합니다.' },
    { id: 2, no: 2, category: '계정/탈퇴', title: '회원 탈퇴 전에 데이터 백업이 가능한가요?', content: '탈퇴 전 필요한 데이터 확인 절차를 안내합니다.' },
    { id: 1, no: 1, category: '고객센터', title: '카카오톡 상담 가능 시간은 언제인가요?', content: '실시간 상담 운영 시간을 안내합니다.' }
  ];

  function seedRows(prefix, content, authors, count, startNo, dateText, type) {
    var list = [];
    for (var i = 0; i < count; i += 1) {
      list.push({
        id: startNo - i,
        no: startNo - i,
        type: type,
        title: prefix + ' ' + (i + 1),
        content: content + ' 예시 설명 #' + (i + 1) + ' 입니다.',
        author: authors[i % authors.length],
        date: i < 3 ? '오늘 ' + String(9 + i).padStart(2, '0') + ':1' + i : dateText,
        status: type === '1on1' ? (i % 3 === 0 ? 'done' : 'waiting') : null,
        createdAt: '2026-05-02T09:00:00'
      });
    }
    return list;
  }

  function loadRows() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        qna: Array.isArray(raw.qna) ? raw.qna : seedRows('플레이스 조회량이 갑자기 늘었는데 제한이 있나요', '플레이스 순위 조회 사용량과 제한 정책에 대한 일반 문의 예시입니다.', ['소상공인A', '브랜드매니저', '광고운영팀', '점주지원'], 34, 234, '2026.04.28', 'qna'),
        '1on1': Array.isArray(raw['1on1']) ? raw['1on1'] : seedRows('결제 취소 요청 드립니다', '결제 및 계정 관련 민감한 문의 예시입니다.', ['대표님'], 31, 131, '2026.04.27', '1on1')
      };
    } catch (e) {
      return {
        qna: seedRows('플레이스 조회량이 갑자기 늘었는데 제한이 있나요', '플레이스 순위 조회 사용량과 제한 정책에 대한 일반 문의 예시입니다.', ['소상공인A', '브랜드매니저', '광고운영팀', '점주지원'], 34, 234, '2026.04.28', 'qna'),
        '1on1': seedRows('결제 취소 요청 드립니다', '결제 및 계정 관련 민감한 문의 예시입니다.', ['대표님'], 31, 131, '2026.04.27', '1on1')
      };
    }
  }

  function qs(id) { return document.getElementById(id); }
  function esc(v) { return window.SherpaCore && SherpaCore.escapeHTML ? SherpaCore.escapeHTML(v) : String(v == null ? '' : v); }
  var rows = loadRows();

  function getCurrentRows() {
    if (currentTab === 'faq') return faqRows.slice();
    return (rows[currentTab] || []).slice();
  }

  function getFilteredRows() {
    var list = getCurrentRows();
    if (!TAB_META[currentTab].searchable) return list;
    var query = String(searchState.query || '').trim().toLowerCase();
    if (!query) return list;
    return list.filter(function (row) {
      var title = String(row.title || '').toLowerCase();
      var content = String(row.content || '').toLowerCase();
      var author = String(row.author || '').toLowerCase();
      if (searchState.scope === 'title') return title.indexOf(query) !== -1;
      if (searchState.scope === 'content') return content.indexOf(query) !== -1;
      if (searchState.scope === 'title_content') return (title + ' ' + content).indexOf(query) !== -1;
      if (searchState.scope === 'author') return author.indexOf(query) !== -1;
      return (title + ' ' + content + ' ' + author).indexOf(query) !== -1;
    });
  }

  function getPagedRows(filtered) {
    var page = currentPageByTab[currentTab] || 1;
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    currentPageByTab[currentTab] = page;
    return { rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page: page, totalPages: totalPages };
  }

  function renderPagination(totalPages, currentPage) {
    if (totalPages <= 1) return '';
    var html = '<div class="board-pagination">';
    for (var i = 1; i <= totalPages; i += 1) html += '<button class="board-page-btn' + (i === currentPage ? ' is-active' : '') + '" type="button" data-cs-page="' + i + '">' + i + '</button>';
    html += '</div>';
    return html;
  }

  function renderTable() {
    var wrap = qs('cs-table-wrap');
    var filtered = getFilteredRows();
    var paged = getPagedRows(filtered);
    if (!filtered.length) { wrap.innerHTML = '<div class="board-empty"><div class="board-empty-title">검색 결과가 없습니다</div><div class="board-empty-desc">검색 조건을 바꾸거나 다른 키워드로 다시 시도해 주세요.</div></div>'; return; }
    var html = '<div class="board-table-wrap"><table class="board-table">';
    if (currentTab === 'faq') {
      html += '<thead><tr><th class="col-no" style="width:80px;">No</th><th style="width:160px;">분류</th><th>질문 제목</th></tr></thead><tbody>';
      paged.rows.forEach(function (row) {
        html += '<tr><td class="col-no">' + row.no + '</td><td>' + esc(row.category) + '</td><td class="board-title-cell"><a class="board-title-link" href="/app/support/cs-view.html?tab=faq&id=' + row.id + '">' + esc(row.title) + '</a></td></tr>';
      });
    } else if (currentTab === 'qna') {
      html += '<thead><tr><th class="col-no" style="width:80px;">No</th><th>제목</th><th class="col-author" style="width:140px;">작성자</th><th class="col-date" style="width:140px;">작성일</th></tr></thead><tbody>';
      paged.rows.forEach(function (row) {
        html += '<tr><td class="col-no">' + row.no + '</td><td class="board-title-cell"><a class="board-title-link" href="/app/support/cs-view.html?tab=qna&id=' + row.id + '">' + esc(row.title) + '</a></td><td class="col-author">' + esc(row.author) + '</td><td class="col-date">' + esc(row.date) + '</td></tr>';
      });
    } else {
      html += '<thead><tr><th class="col-no" style="width:80px;">No</th><th class="col-status" style="width:140px;">상태</th><th>제목</th><th class="col-date" style="width:140px;">작성일</th></tr></thead><tbody>';
      paged.rows.forEach(function (row) {
        html += '<tr><td class="col-no">' + row.no + '</td><td class="col-status"><span class="badge ' + (row.status === 'done' ? 'badge-success' : 'badge-warning') + '">' + (row.status === 'done' ? '답변완료' : '답변대기') + '</span></td><td class="board-title-cell"><a class="board-title-link" href="/app/support/cs-view.html?tab=1on1&id=' + row.id + '">' + esc(row.title) + '</a></td><td class="col-date">' + esc(row.date) + '</td></tr>';
      });
    }
    html += '</tbody></table></div>' + renderPagination(paged.totalPages, paged.page);
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-cs-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        currentPageByTab[currentTab] = Number(button.getAttribute('data-cs-page'));
        renderTable();
      });
    });
  }

  function syncHeader() {
    var meta = TAB_META[currentTab];
    qs('cs-current-title').textContent = meta.title;
    qs('cs-current-desc').textContent = meta.description;
    qs('cs-list-title').textContent = meta.listTitle;
    document.querySelectorAll('[data-cs-tab]').forEach(function (button) { button.classList.toggle('is-active', button.getAttribute('data-cs-tab') === currentTab); });
    qs('cs-open-modal-btn').style.display = currentTab === '1on1' ? 'inline-flex' : 'none';
    qs('cs-open-modal-btn').onclick = function () { window.location.href = '/app/support/cs-write.html'; };
    qs('cs-search-box').style.display = meta.searchable ? 'flex' : 'none';
    if (!meta.searchable) { searchState.query = ''; qs('cs-search-input').value = ''; currentPageByTab[currentTab] = 1; }
  }

  function switchTab(tab) {
    currentTab = TAB_META[tab] ? tab : 'faq';
    currentPageByTab[currentTab] = 1;
    if (window.SherpaCore && SherpaCore.setTab) SherpaCore.setTab(currentTab);
    syncHeader();
    renderTable();
  }

  function bindEvents() {
    document.querySelectorAll('[data-cs-tab]').forEach(function (button) { button.addEventListener('click', function () { switchTab(button.getAttribute('data-cs-tab')); }); });
    qs('cs-search-scope').addEventListener('change', function () { searchState.scope = this.value; currentPageByTab[currentTab] = 1; renderTable(); });
    qs('cs-search-input').addEventListener('input', function () { searchState.query = this.value; currentPageByTab[currentTab] = 1; renderTable(); });
    qs('cs-kakao-btn').addEventListener('click', function () { window.open((window.SHERPA_CONFIG && window.SHERPA_CONFIG.KAKAO_CS_URL) || '#', '_blank', 'noopener'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-cs') return;
    var stateUrl = window.SherpaCore && window.SherpaCore.getURLState ? window.SherpaCore.getURLState() : { tab: 'faq' };
    currentTab = TAB_META[stateUrl.tab] ? stateUrl.tab : 'faq';
    bindEvents();
    syncHeader();
    renderTable();
  });
})();
