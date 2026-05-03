(function () {
  'use strict';

  var WRITABLE_TABS = ['greeting', 'free', 'share', 'logic'];
  var SEARCHABLE_TABS = ['free', 'share', 'logic'];
  var PAGE_SIZE = 30;

  var TAB_META = {
    notice: { title: '공지사항', description: '셰르파인의 새로운 업데이트와 운영 소식을 확인하세요.' },
    greeting: { title: '가입인사', description: '새로 합류한 회원들과 첫 인사를 나누는 공간입니다.' },
    attendance: { title: '출석체크', description: '출석 문구를 남기고 오늘의 방문 기록을 확인하세요.' },
    free: { title: '자유게시판', description: '실무 고민, 운영 이슈, 현장 반응을 자유롭게 나누는 게시판입니다.' },
    share: { title: '정보공유', description: '캠페인 사례, 자료, 체크리스트를 예시와 함께 공유하는 공간입니다.' },
    logic: { title: '로직분석 연구실', description: '플레이스·리뷰·순위 변동을 관찰하고 기록하는 실험 메모 공간입니다.' }
  };

  var currentTab = 'notice';
  var currentPageByTab = { notice: 1, greeting: 1, attendance: 1, free: 1, share: 1, logic: 1 };
  var searchState = { scope: 'all', query: '' };
  var state = {
    posts: [],
    total: 0,
    attendanceRows: [],
    attendanceTotal: 0,
    attendanceStatus: { checkedToday: false, currentStreak: 0 }
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    if (window.SherpaCore && typeof SherpaCore.escapeHTML === 'function') return SherpaCore.escapeHTML(value);
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatNumber(value) {
    if (window.SherpaCore && typeof SherpaCore.formatNumber === 'function') return SherpaCore.formatNumber(value);
    return Number(value || 0).toLocaleString('ko-KR');
  }

  function writableTab(tab) {
    return WRITABLE_TABS.indexOf(tab) !== -1;
  }

  function searchableTab(tab) {
    return SEARCHABLE_TABS.indexOf(tab) !== -1;
  }

  function setLoading(targetId) {
    var mount = qs(targetId);
    if (!mount) return;
    mount.innerHTML = '<div class="board-empty"><div class="board-empty-title">불러오는 중...</div><div class="board-empty-desc">잠시만 기다려 주세요.</div></div>';
  }

  async function fetchPosts() {
    setLoading('community-board-wrap');

    if (!window.SherpaAPI || !SherpaAPI.community) {
      qs('community-board-wrap').innerHTML = '<div class="board-empty"><div class="board-empty-title">API 연결이 필요합니다</div><div class="board-empty-desc">community API가 로드되지 않았습니다.</div></div>';
      return;
    }

    try {
      var res = await SherpaAPI.community.list({
        board: 'community',
        category: currentTab,
        page: currentPageByTab[currentTab],
        pageSize: PAGE_SIZE,
        scope: searchState.scope,
        q: searchState.query
      });
      state.posts = res.posts || [];
      state.total = res.total || 0;
      renderBoardTable();
    } catch (err) {
      qs('community-board-wrap').innerHTML = '<div class="board-empty"><div class="board-empty-title">목록을 불러오지 못했습니다</div><div class="board-empty-desc">' + escapeHTML(window.SherpaAPI.errorMessage(err)) + '</div></div>';
    }
  }

  async function fetchAttendance() {
    setLoading('community-attendance-wrap');

    if (!window.SherpaAPI || !SherpaAPI.attendance) {
      qs('community-attendance-wrap').innerHTML = '<div class="board-empty"><div class="board-empty-title">API 연결이 필요합니다</div><div class="board-empty-desc">attendance API가 로드되지 않았습니다.</div></div>';
      return;
    }

    try {
      var feedRes = await SherpaAPI.attendance.feed({
        page: currentPageByTab.attendance,
        pageSize: PAGE_SIZE
      });
      var statusRes = await SherpaAPI.attendance.status();
      state.attendanceRows = feedRes.rows || [];
      state.attendanceTotal = feedRes.total || 0;
      state.attendanceStatus = statusRes || { checkedToday: false, currentStreak: 0 };
      renderAttendance();
    } catch (err) {
      qs('community-attendance-wrap').innerHTML = '<div class="board-empty"><div class="board-empty-title">출석 기록을 불러오지 못했습니다</div><div class="board-empty-desc">' + escapeHTML(window.SherpaAPI.errorMessage(err)) + '</div></div>';
    }
  }

  function renderPagination(total, currentPage, mountId, pageType) {
    var mount = qs(mountId);
    if (!mount) return;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) {
      mount.innerHTML = '';
      return;
    }

    var html = '<div class="board-pagination">';
    for (var i = 1; i <= totalPages; i += 1) {
      html += '<button class="board-page-btn' + (i === currentPage ? ' is-active' : '') + '" type="button" data-page-type="' + pageType + '" data-page-num="' + i + '">' + i + '</button>';
    }
    html += '</div>';
    mount.innerHTML = html;

    mount.querySelectorAll('[data-page-num]').forEach(function (button) {
      button.addEventListener('click', function () {
        var pageNum = Number(button.getAttribute('data-page-num'));
        currentPageByTab[pageType] = pageNum;
        if (pageType === 'attendance') fetchAttendance();
        else fetchPosts();
      });
    });
  }

  function renderBoardTable() {
    var wrap = qs('community-board-wrap');
    if (!wrap) return;

    if (!state.posts.length) {
      wrap.innerHTML = '<div class="board-empty"><div class="board-empty-title">게시글이 없습니다</div><div class="board-empty-desc">첫 번째 글을 등록해 현재 게시판을 시작해 보세요.</div></div>';
      return;
    }

    var html = '';
    html += '<div class="board-table-wrap">';
    html += '  <table class="board-table">';
    html += '    <thead><tr><th class="col-no" style="width:88px;">No</th><th>제목</th><th class="col-author" style="width:140px;">작성자</th><th class="col-date" style="width:140px;">작성일</th><th class="col-views" style="width:100px;">조회수</th></tr></thead>';
    html += '    <tbody>';
    state.posts.forEach(function (row) {
      var commentSuffix = row.comment_count && row.comment_count > 0 ? ' <span style="color:var(--color-accent); font-weight:700;">+' + row.comment_count + '</span>' : '';
      html += '      <tr' + (row.is_pinned ? ' class="board-highlight"' : '') + '>';
      html += '        <td class="col-no">' + escapeHTML(String(row.is_pinned ? '공지' : row.id)) + '</td>';
      html += '        <td class="board-title-cell"><a class="board-title-link" href="/app/community/view.html?id=' + row.id + '">' + escapeHTML(row.title) + commentSuffix + '</a></td>';
      html += '        <td class="col-author">' + escapeHTML(row.author_name || '-') + '</td>';
      html += '        <td class="col-date">' + escapeHTML(row.created_at ? String(row.created_at).slice(0, 10) : '-') + '</td>';
      html += '        <td class="col-views">' + formatNumber(row.view_count || 0) + '</td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';
    html += '</div>';
    html += '<div id="community-board-pagination"></div>';
    wrap.innerHTML = html;

    renderPagination(state.total, currentPageByTab[currentTab], 'community-board-pagination', currentTab);
  }

  function renderAttendance() {
    var wrap = qs('community-attendance-wrap');
    if (!wrap) return;

    if (!state.attendanceRows.length) {
      wrap.innerHTML = '<div class="board-empty"><div class="board-empty-title">출석 기록이 없습니다</div><div class="board-empty-desc">오늘 첫 번째 출석 문구를 남겨보세요.</div></div>';
      return;
    }

    var html = '';
    html += '<div class="board-modal-note">오늘 출석 여부: <strong>' + (state.attendanceStatus.checkedToday ? '완료' : '미완료') + '</strong> · 현재 연속 출석: <strong>' + (state.attendanceStatus.currentStreak || 0) + '일</strong></div>';
    html += '<div class="board-table-wrap">';
    html += '  <table class="board-table">';
    html += '    <thead><tr><th class="col-no" style="width:88px;">No</th><th>내용 (인사말)</th><th class="col-author" style="width:140px;">작성자</th><th class="col-date" style="width:140px;">작성일</th></tr></thead>';
    html += '    <tbody>';
    state.attendanceRows.forEach(function (row, idx) {
      html += '      <tr>';
      html += '        <td class="col-no">' + escapeHTML(String(state.attendanceTotal - ((currentPageByTab.attendance - 1) * PAGE_SIZE) - idx)) + '</td>';
      html += '        <td class="board-title-cell"><span class="board-title-text">' + escapeHTML(row.message || '출석체크 완료') + '</span></td>';
      html += '        <td class="col-author">' + escapeHTML(row.author_name || '-') + '</td>';
      html += '        <td class="col-date">' + escapeHTML(row.created_at ? String(row.created_at).slice(0, 16).replace('T', ' ') : row.check_date || '-') + '</td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';
    html += '</div>';
    html += '<div id="community-attendance-pagination"></div>';
    wrap.innerHTML = html;

    renderPagination(state.attendanceTotal, currentPageByTab.attendance, 'community-attendance-pagination', 'attendance');
  }

  function updateSearchVisibility() {
    var showSearch = searchableTab(currentTab);
    qs('community-search-box').style.display = showSearch ? 'flex' : 'none';
    if (!showSearch) {
      searchState.query = '';
      qs('community-search-input').value = '';
      currentPageByTab[currentTab] = 1;
    }
  }

  function renderCurrentView() {
    var meta = TAB_META[currentTab] || TAB_META.notice;
    qs('community-current-title').textContent = meta.title;
    qs('community-current-desc').textContent = meta.description;

    document.querySelectorAll('[data-board-tab]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-board-tab') === currentTab);
    });

    var isAttendance = currentTab === 'attendance';
    qs('community-board-panel').style.display = isAttendance ? 'none' : 'grid';
    qs('community-attendance-panel').style.display = isAttendance ? 'grid' : 'none';
    qs('community-write-btn').style.display = writableTab(currentTab) ? 'inline-flex' : 'none';

    updateSearchVisibility();

    if (isAttendance) fetchAttendance();
    else fetchPosts();
  }

  function switchTab(tab) {
    currentTab = TAB_META[tab] ? tab : 'notice';
    currentPageByTab[currentTab] = 1;
    if (window.SherpaCore && typeof SherpaCore.setTab === 'function') {
      SherpaCore.setTab(currentTab);
    }
    renderCurrentView();
  }

  function openWritePage() {
    var category = writableTab(currentTab) ? currentTab : 'greeting';
    window.location.href = '/app/community/write.html?category=' + encodeURIComponent(category);
  }

  async function handleAttendanceSubmit(event) {
    event.preventDefault();
    var input = qs('attendance-message-input');
    var value = input.value.trim();
    if (!value) {
      alert('한 줄 인사말을 입력해 주세요.');
      input.focus();
      return;
    }

    try {
      await SherpaAPI.attendance.checkin(value);
      input.value = '';
      currentPageByTab.attendance = 1;
      fetchAttendance();
      if (window.SidebarModule && typeof SidebarModule.renderSidebar === 'function') SidebarModule.renderSidebar();
      if (window.TopbarCore && typeof TopbarCore.renderTopbar === 'function') TopbarCore.renderTopbar();
    } catch (err) {
      alert(window.SherpaAPI.errorMessage(err));
    }
  }

  function bindEvents() {
    document.querySelectorAll('[data-board-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        switchTab(button.getAttribute('data-board-tab'));
      });
    });

    qs('community-search-scope').addEventListener('change', function () {
      searchState.scope = this.value;
      currentPageByTab[currentTab] = 1;
      fetchPosts();
    });

    qs('community-search-input').addEventListener('input', function () {
      searchState.query = this.value;
      currentPageByTab[currentTab] = 1;
      fetchPosts();
    });

    qs('community-write-btn').addEventListener('click', openWritePage);
    qs('attendance-form').addEventListener('submit', handleAttendanceSubmit);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'community-board') return;
    var stateUrl = window.SherpaCore && typeof SherpaCore.getURLState === 'function' ? SherpaCore.getURLState() : { tab: 'notice' };
    currentTab = TAB_META[stateUrl.tab] ? stateUrl.tab : 'notice';
    bindEvents();
    renderCurrentView();
  });
})();
