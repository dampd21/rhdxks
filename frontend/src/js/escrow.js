(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var currentTab = 'recruit';
  var currentPageByTab = { recruit: 1, apply: 1 };
  var searchState = { scope: 'all', query: '' };
  var state = { missions: [], total: 0 };

  var TAB_META = {
    recruit: {
      title: '모집 (의뢰하기)',
      description: '리뷰/체험단 미션을 등록하고 플랫폼에 예치해 안전하게 모집을 진행합니다.',
      listTitle: '모집 리스트',
      status: 'open'
    },
    apply: {
      title: '의뢰 (수행하기)',
      description: '지금 지원 가능한 미션을 찾아 수행자 관점에서 확인합니다.',
      listTitle: '수행 가능 미션',
      status: 'open'
    }
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    return window.SherpaCore && typeof SherpaCore.escapeHTML === 'function'
      ? SherpaCore.escapeHTML(value)
      : String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    return window.SherpaCore && typeof SherpaCore.formatNumber === 'function'
      ? SherpaCore.formatNumber(value)
      : Number(value || 0).toLocaleString('ko-KR');
  }

  function getCurrentRows() {
    return state.missions.slice();
  }

  function getFilteredRows() {
    var list = getCurrentRows();
    var query = String(searchState.query || '').trim().toLowerCase();
    if (!query) return list;

    return list.filter(function (row) {
      var title = String(row.title || '').toLowerCase();
      var content = String(row.description || '').toLowerCase();
      var author = String(row.requester_name || row.owner || '').toLowerCase();

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
    var html = '<div class="missions-pagination">';
    for (var i = 1; i <= totalPages; i += 1) {
      html += '<button class="missions-page-btn' + (i === currentPage ? ' is-active' : '') + '" type="button" data-mission-page="' + i + '">' + i + '</button>';
    }
    html += '</div>';
    return html;
  }

  function statusInfo(status) {
    if (status === 'in_progress') return { label: '진행중', badge: 'badge-warning', actionLabel: currentTab === 'apply' ? '상세 보기' : '상세 보기', disabled: false };
    if (status === 'completed') return { label: '완료', badge: 'badge-success', actionLabel: '상세 보기', disabled: false };
    if (status === 'cancelled') return { label: '취소', badge: 'badge-muted', actionLabel: '상세 보기', disabled: false };
    return { label: '모집중', badge: 'badge-info', actionLabel: currentTab === 'apply' ? '상세 보기' : '상세 보기', disabled: false };
  }

  function renderTable() {
    var wrap = qs('missions-table-wrap');
    var filtered = getFilteredRows();
    var paged = getPagedRows(filtered);

    if (!filtered.length) {
      wrap.innerHTML = '<div class="missions-empty"><div class="missions-empty-title">검색 결과가 없습니다</div><div class="missions-empty-desc">검색 조건을 바꾸거나 다른 키워드로 다시 시도해 주세요.</div></div>';
      return;
    }

    var html = '';
    html += '<div class="missions-table-wrap">';
    html += '  <table class="missions-table">';
    html += '    <thead><tr><th class="col-type" style="width:140px;">유형</th><th class="col-status" style="width:120px;">상태</th><th>제목</th><th class="col-owner" style="width:140px;">등록자</th><th class="col-reward" style="width:140px;">보상 눈덩이</th><th class="col-date" style="width:120px;">등록일</th><th class="col-action" style="width:120px;">액션</th></tr></thead>';
    html += '    <tbody>';
    paged.rows.forEach(function (row) {
      var status = statusInfo(row.status);
      html += '      <tr>';
      html += '        <td class="col-type">' + escapeHTML(row.mission_type || row.type || '-') + '</td>';
      html += '        <td class="col-status"><span class="badge ' + status.badge + '">' + status.label + '</span></td>';
      html += '        <td class="missions-title-cell"><a class="board-title-link" href="/app/escrow/view.html?id=' + row.id + '">' + escapeHTML(row.title) + '</a><div class="missions-subtext">' + escapeHTML(row.description || '') + '</div></td>';
      html += '        <td class="col-owner">' + escapeHTML(row.requester_name || row.owner || '-') + '</td>';
      html += '        <td class="col-reward">' + formatNumber(row.reward_per_person || row.reward || 0) + '</td>';
      html += '        <td class="col-date">' + escapeHTML(row.created_at ? String(row.created_at).slice(0, 10) : row.date || '-') + '</td>';
      html += '        <td class="col-action"><a class="btn btn-primary btn-sm missions-action-btn" href="/app/escrow/view.html?id=' + row.id + '">' + status.actionLabel + '</a></td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';
    html += '</div>';
    html += renderPagination(paged.totalPages, paged.currentPage);
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-mission-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        currentPageByTab[currentTab] = Number(button.getAttribute('data-mission-page'));
        renderTable();
      });
    });
  }

  function syncHeader() {
    var meta = TAB_META[currentTab];
    qs('missions-current-title').textContent = meta.title;
    qs('missions-current-desc').textContent = meta.description;
    qs('missions-list-title').textContent = meta.listTitle;
    document.querySelectorAll('[data-mission-tab]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-mission-tab') === currentTab);
    });
  }

  async function loadMissions() {
    var wrap = qs('missions-table-wrap');
    wrap.innerHTML = '<div class="missions-empty"><div class="missions-empty-title">불러오는 중...</div><div class="missions-empty-desc">잠시만 기다려 주세요.</div></div>';

    try {
      var meta = TAB_META[currentTab];
      var res = await SherpaAPI.escrow.list({ status: meta.status, page: 1, limit: 100 });
      state.missions = res.missions || [];
      state.total = res.total || 0;
      renderTable();
    } catch (err) {
      wrap.innerHTML = '<div class="missions-empty"><div class="missions-empty-title">미션을 불러오지 못했습니다</div><div class="missions-empty-desc">' + escapeHTML(SherpaAPI.errorMessage(err)) + '</div></div>';
    }
  }

  function switchTab(tab) {
    currentTab = TAB_META[tab] ? tab : 'recruit';
    currentPageByTab[currentTab] = 1;
    if (window.SherpaCore && typeof SherpaCore.setTab === 'function') {
      SherpaCore.setTab(currentTab);
    }
    syncHeader();
    loadMissions();
  }

  function updateReceipt() {
    var reward = Number(qs('mission-reward-input').value || 0);
    var safeReward = reward < 0 ? 0 : reward;
    var fee = Math.ceil(safeReward * 0.1);
    var total = safeReward + fee;
    qs('receipt-reward').textContent = formatNumber(safeReward) + ' 눈덩이';
    qs('receipt-fee').textContent = formatNumber(fee) + ' 눈덩이';
    qs('receipt-total').textContent = formatNumber(total) + ' 눈덩이';
  }

  function ensureModalHidden() {
    qs('mission-create-modal').classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function openModal() {
    qs('mission-create-modal').classList.add('is-open');
    document.body.classList.add('modal-open');
    updateReceipt();
  }

  function closeModal() {
    qs('mission-create-modal').classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  async function handleCreate(event) {
    event.preventDefault();
    var type = qs('mission-type-input').value;
    var title = qs('mission-title-input').value.trim();
    var desc = qs('mission-desc-input').value.trim();
    var reward = Number(qs('mission-reward-input').value || 0);
    var maxApplicants = 1;

    if (!title || !desc) {
      alert('미션 제목과 상세 가이드를 입력해 주세요.');
      return;
    }

    if (reward < 500) {
      alert('보상 눈덩이는 최소 500 이상이어야 합니다.');
      return;
    }

    try {
      await SherpaAPI.escrow.create({
        title: title,
        description: desc,
        mission_type: type,
        reward_per_person: reward,
        max_applicants: maxApplicants,
        category: '',
        location: '',
        requirements: desc
      });
      qs('mission-create-form').reset();
      updateReceipt();
      closeModal();
      switchTab('recruit');
    } catch (err) {
      alert(SherpaAPI.errorMessage(err));
    }
  }

  function bindEvents() {
    document.querySelectorAll('[data-mission-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        switchTab(button.getAttribute('data-mission-tab'));
      });
    });

    qs('missions-search-scope').addEventListener('change', function () {
      searchState.scope = this.value;
      currentPageByTab[currentTab] = 1;
      renderTable();
    });

    qs('missions-search-input').addEventListener('input', function () {
      searchState.query = this.value;
      currentPageByTab[currentTab] = 1;
      renderTable();
    });

    qs('mission-open-modal-btn').addEventListener('click', openModal);
    qs('mission-create-form').addEventListener('submit', handleCreate);
    qs('mission-reward-input').addEventListener('input', updateReceipt);

    document.querySelectorAll('[data-modal-close="mission-create-modal"]').forEach(function (button) {
      button.addEventListener('click', closeModal);
    });

    qs('mission-create-modal').addEventListener('click', function (event) {
      if (event.target === event.currentTarget) closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'missions') return;
    var stateUrl = window.SherpaCore && typeof SherpaCore.getURLState === 'function' ? SherpaCore.getURLState() : { tab: 'recruit' };
    currentTab = TAB_META[stateUrl.tab] ? stateUrl.tab : 'recruit';
    ensureModalHidden();
    bindEvents();
    syncHeader();
    loadMissions();
    updateReceipt();
  });
})();
