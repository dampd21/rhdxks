(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var STORAGE_KEY = 'sherpa_inquiry_posts_v3';
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

  function seedRows(prefix, content, authors, count, startNo, dateText, type) {
    var list = [];
    for (var i = 0; i < count; i += 1) {
      list.push({
        id: startNo - i,
        no: startNo - i,
        type: type,
        status: i % 3 === 0 ? 'done' : 'waiting',
        title: prefix + ' ' + (i + 1),
        content: content + ' 예시 설명 #' + (i + 1) + ' 입니다. 사용 단계와 개선 의견을 함께 남깁니다.',
        author: authors[i % authors.length],
        date: i < 3 ? '오늘 ' + String(9 + i).padStart(2, '0') + ':2' + i : dateText,
        createdAt: '2026-05-02T09:00:00'
      });
    }
    return list;
  }

  var defaultRows = {
    usage: seedRows('플레이스 추적 설정 중 오류가 발생합니다', '추적 설정 단계에서 특정 버튼 클릭 시 오류가 발생하는 사례를 정리합니다.', ['브랜드매니저', '운영담당', '병원실장', '로컬광고팀'], 34, 134, '2026.04.29', 'usage'),
    feature: seedRows('이 기능도 넣어주세요', '기능 건의 예시입니다. 실무 흐름을 줄이는 자동화/필터/리포트 기능을 제안합니다.', ['실행사A', '데이터랩', '콘텐츠팀', '가맹점운영'], 32, 232, '2026.04.28', 'feature')
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return window.SherpaCore && typeof window.SherpaCore.escapeHTML === 'function'
      ? window.SherpaCore.escapeHTML(value)
      : String(value == null ? '' : value);
  }

  function loadRows() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultRows));
      var parsed = JSON.parse(raw);
      return {
        usage: Array.isArray(parsed.usage) ? parsed.usage : defaultRows.usage.slice(),
        feature: Array.isArray(parsed.feature) ? parsed.feature : defaultRows.feature.slice()
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(defaultRows));
    }
  }

  var rows = loadRows();

  function getFilteredRows() {
    var list = (rows[currentTab] || []).slice();
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
    var currentPage = currentPageByTab[currentTab] || 1;
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    currentPageByTab[currentTab] = currentPage;
    return {
      rows: filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
      currentPage: currentPage,
      totalPages: totalPages
    };
  }

  function renderPagination(totalPages, currentPage) {
    if (totalPages <= 1) return '';
    var html = '<div class="board-pagination">';
    for (var i = 1; i <= totalPages; i += 1) {
      html += '<button class="board-page-btn' + (i === currentPage ? ' is-active' : '') + '" type="button" data-inquiry-page="' + i + '">' + i + '</button>';
    }
    html += '</div>';
    return html;
  }

  function renderTable() {
    var wrap = qs('inquiry-table-wrap');
    var filtered = getFilteredRows();
    var paged = getPagedRows(filtered);
    if (!filtered.length) {
      wrap.innerHTML = '<div class="board-empty"><div class="board-empty-title">검색 결과가 없습니다</div><div class="board-empty-desc">검색 조건을 바꾸거나 다른 키워드로 다시 시도해 주세요.</div></div>';
      return;
    }

    var html = '';
    html += '<div class="board-table-wrap">';
    html += '<table class="board-table">';
    html += '<thead><tr><th class="col-no" style="width:80px;">No</th><th class="col-status" style="width:140px;">상태</th><th>제목</th><th class="col-date" style="width:140px;">작성일</th></tr></thead>';
    html += '<tbody>';

    paged.rows.forEach(function (row) {
      html += '<tr>';
      html += '<td class="col-no">' + esc(String(row.no)) + '</td>';
      html += '<td class="col-status"><span class="badge ' + (row.status === 'done' ? 'badge-success' : 'badge-warning') + '">' + (row.status === 'done' ? '답변완료' : '답변대기') + '</span></td>';
      html += '<td class="board-title-cell"><a class="board-title-link" href="/app/support/inquiry-view.html?type=' + encodeURIComponent(currentTab) + '&id=' + row.id + '">' + esc(row.title) + '</a></td>';
      html += '<td class="col-date">' + esc(row.date) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    html += renderPagination(paged.totalPages, paged.currentPage);
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-inquiry-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        currentPageByTab[currentTab] = Number(button.getAttribute('data-inquiry-page'));
        renderTable();
      });
    });
  }

  function syncHeader() {
    var meta = TAB_META[currentTab];
    qs('inquiry-current-title').textContent = meta.title;
    qs('inquiry-current-desc').textContent = meta.description;
    qs('inquiry-open-page-btn').href = '/app/support/inquiry-write.html?type=' + encodeURIComponent(currentTab);
    document.querySelectorAll('[data-inquiry-tab]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-inquiry-tab') === currentTab);
    });
  }

  function switchTab(tab) {
    currentTab = TAB_META[tab] ? tab : 'usage';
    currentPageByTab[currentTab] = 1;
    if (window.SherpaCore && typeof window.SherpaCore.setTab === 'function') {
      window.SherpaCore.setTab(currentTab);
    }
    syncHeader();
    renderTable();
  }

  function bindEvents() {
    document.querySelectorAll('[data-inquiry-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        switchTab(button.getAttribute('data-inquiry-tab'));
      });
    });

    qs('inquiry-search-scope').addEventListener('change', function () {
      searchState.scope = this.value;
      currentPageByTab[currentTab] = 1;
      renderTable();
    });

    qs('inquiry-search-input').addEventListener('input', function () {
      searchState.query = this.value;
      currentPageByTab[currentTab] = 1;
      renderTable();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-inquiry') return;
    var state = window.SherpaCore && typeof window.SherpaCore.getURLState === 'function' ? window.SherpaCore.getURLState() : { tab: 'usage' };
    currentTab = TAB_META[state.tab] ? state.tab : 'usage';
    bindEvents();
    syncHeader();
    renderTable();
  });
})();
