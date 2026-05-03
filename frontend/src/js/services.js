(function () {
  'use strict';

  var PAGE_SIZE = 30;
  var currentTab = 'premium';
  var currentPageByTab = { premium: 1, promo: 1 };
  var searchState = { scope: 'all', query: '' };
  var freeWriteRemaining = 1;

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
      description: '자유홍보 게시판은 무료 작성 1회 후 500 눈덩이 차감 정책을 예시로 반영합니다.',
      listTitle: '자유홍보 글 목록',
      searchable: true,
      actionLabel: '홍보 글쓰기'
    }
  };

  var partners = [
    {
      status: '공식 파트너',
      name: '올스 (ALLS)',
      service: '블로그 배포 / 트래픽',
      description: '네이버 블로그 상위노출과 영수증 리뷰 트래픽 관리를 전문으로 하는 마케팅 에이전시입니다.',
      owner: '제휴팀',
      ready: true
    },
    {
      status: '공식 파트너',
      name: '고트마케팅',
      service: '카페 바이럴',
      description: '맘카페, 정보성 카페 등 타겟에 맞는 자연스러운 카페 침투형 바이럴을 운영합니다.',
      owner: '제휴팀',
      ready: true
    },
    {
      status: '준비중',
      name: 'A컴퍼니',
      service: '리뷰 블라인드 관리',
      description: '악성 리뷰 차단, 블라인드 처리, 평점 밸런싱 등 통합 평판 관리 솔루션입니다.',
      owner: '제휴팀',
      ready: false
    },
    {
      status: '공식 파트너',
      name: '로컬브랜딩랩',
      service: '지역 상권 브랜딩',
      description: '병원·카페·미용실 등 로컬 업종 맞춤형 브랜드 스토리 설계와 페이지 운영을 지원합니다.',
      owner: '제휴팀',
      ready: true
    }
  ];

  function seedPromoRows(count, startNo) {
    var categories = ['블로그', '디자인', '당근마켓', '플레이스/리뷰', '인스타/스레드', '원고/촬영'];
    var authors = ['원고대행전문', '김디자이너', '로컬마케터즈', '브랜드랩', '운영스튜디오', '콘텐츠팀'];
    var rows = [];
    for (var i = 0; i < count; i += 1) {
      rows.push({
        no: startNo - i,
        category: categories[i % categories.length],
        title: categories[i % categories.length] + ' 서비스 예시 홍보글 ' + (i + 1),
        content: '자유홍보 게시판 예시입니다. 서비스 범위, 업종, 가격대, 연락 가능한 채널을 함께 적는 형식으로 구성합니다. #' + (i + 1),
        author: authors[i % authors.length],
        date: i < 3 ? '오늘 ' + String(9 + i).padStart(2, '0') + ':3' + i : '2026.04.28',
        views: 40 + i * 5
      });
    }
    return rows;
  }

  var promoRows = seedPromoRows(34, 234);

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

  function getUser() {
    if (window.SherpaCore && typeof SherpaCore.getUser === 'function') return SherpaCore.getUser();
    return { name: '대표님', snowball: 0 };
  }

  function getFilteredPromoRows() {
    var query = String(searchState.query || '').trim().toLowerCase();
    if (!query) return promoRows.slice();

    return promoRows.filter(function (row) {
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

  function getPagedRows(list) {
    var currentPage = currentPageByTab[currentTab] || 1;
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    currentPageByTab[currentTab] = currentPage;

    return {
      rows: list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
      currentPage: currentPage,
      totalPages: totalPages
    };
  }

  function renderPagination(totalPages, currentPage) {
    if (totalPages <= 1) return '';
    var html = '<div class="services-pagination">';
    for (var i = 1; i <= totalPages; i += 1) {
      html += '<button class="services-page-btn' + (i === currentPage ? ' is-active' : '') + '" type="button" data-services-page="' + i + '">' + i + '</button>';
    }
    html += '</div>';
    return html;
  }

  function renderPremiumTable() {
    var wrap = qs('services-table-wrap');
    if (!wrap) return;

    var html = '';
    html += '<div class="services-table-wrap">';
    html += '  <table class="services-table">';
    html += '    <thead><tr><th class="col-status" style="width:140px;">상태</th><th style="width:200px;">업체명</th><th style="width:180px;">서비스</th><th>소개</th><th class="col-action" style="width:130px;">문의</th></tr></thead>';
    html += '    <tbody>';
    partners.forEach(function (partner) {
      html += '      <tr>';
      html += '        <td class="col-status"><span class="badge ' + (partner.ready ? 'badge-info' : 'badge-muted') + '">' + escapeHTML(partner.status) + '</span></td>';
      html += '        <td class="services-title-cell"><span class="services-title-text">' + escapeHTML(partner.name) + '</span></td>';
      html += '        <td>' + escapeHTML(partner.service) + '</td>';
      html += '        <td><div class="services-subtext">' + escapeHTML(partner.description) + '</div></td>';
      html += '        <td class="col-action"><button class="btn ' + (partner.ready ? 'btn-primary' : 'btn-ghost') + ' btn-sm services-action-btn" ' + (partner.ready ? '' : 'disabled') + '>' + (partner.ready ? '문의/신청' : '준비중') + '</button></td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';
    html += '</div>';
    wrap.innerHTML = html;
  }

  function renderPromoTable() {
    var wrap = qs('services-table-wrap');
    if (!wrap) return;

    var filtered = getFilteredPromoRows();
    var paged = getPagedRows(filtered);

    if (!filtered.length) {
      wrap.innerHTML = '<div class="services-empty"><div class="services-empty-title">검색 결과가 없습니다</div><div class="services-empty-desc">검색 조건을 바꾸거나 다른 키워드로 다시 시도해 주세요.</div></div>';
      return;
    }

    var html = '';
    html += '<div class="services-table-wrap">';
    html += '  <table class="services-table">';
    html += '    <thead><tr><th class="col-category" style="width:120px;">분류</th><th>제목</th><th class="col-author" style="width:140px;">작성자</th><th class="col-date" style="width:120px;">작성일</th><th class="col-views" style="width:100px;">조회수</th></tr></thead>';
    html += '    <tbody>';
    paged.rows.forEach(function (row) {
      html += '      <tr>';
      html += '        <td class="col-category">' + escapeHTML(row.category) + '</td>';
      html += '        <td class="services-title-cell"><span class="services-title-text">' + escapeHTML(row.title) + '</span><div class="services-subtext">' + escapeHTML(row.content) + '</div></td>';
      html += '        <td class="col-author">' + escapeHTML(row.author) + '</td>';
      html += '        <td class="col-date">' + escapeHTML(row.date) + '</td>';
      html += '        <td class="col-views">' + formatNumber(row.views) + '</td>';
      html += '      </tr>';
    });
    html += '    </tbody>';
    html += '  </table>';
    html += '</div>';
    html += renderPagination(paged.totalPages, paged.currentPage);
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-services-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        currentPageByTab[currentTab] = Number(button.getAttribute('data-services-page'));
        renderPromoTable();
      });
    });
  }

  function syncHeader() {
    var meta = TAB_META[currentTab];
    qs('services-current-title').textContent = meta.title;
    qs('services-current-desc').textContent = meta.description;
    qs('services-list-title').innerHTML = meta.listTitle + (currentTab === 'promo' ? ' <span class="badge badge-danger" id="services-promo-free-badge">오늘 무료 작성: ' + freeWriteRemaining + '/1 남음</span>' : '');
    qs('services-primary-btn').textContent = meta.actionLabel;
    qs('services-search-box').style.display = meta.searchable ? 'flex' : 'none';

    document.querySelectorAll('[data-services-tab]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-services-tab') === currentTab);
    });

    if (!meta.searchable) {
      searchState.query = '';
      qs('services-search-input').value = '';
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

  function renderCurrentTab() {
    if (currentTab === 'premium') renderPremiumTable();
    else renderPromoTable();
  }

  function ensureModalHidden() {
    qs('services-write-modal').classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function openModal() {
    qs('services-write-modal').classList.add('is-open');
    document.body.classList.add('modal-open');
    updateSubmitLabel();
  }

  function closeModal() {
    qs('services-write-modal').classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function updateSubmitLabel() {
    var button = qs('services-write-submit');
    if (!button) return;
    button.textContent = freeWriteRemaining > 0 ? '무료로 등록하기' : '500 눈덩이 차감 후 등록';
  }

  function handleSubmit(event) {
    event.preventDefault();
    var category = qs('services-write-category').value;
    var title = qs('services-write-title').value.trim();
    var body = qs('services-write-body').value.trim();

    if (!title || !body) {
      alert('홍보 제목과 내용을 입력해 주세요.');
      return;
    }

    var user = getUser();
    if (freeWriteRemaining <= 0 && user.snowball < 500) {
      alert('눈덩이가 부족합니다. 최소 500 눈덩이가 필요합니다.');
      return;
    }

    if (freeWriteRemaining > 0) {
      freeWriteRemaining -= 1;
    } else if (window.SherpaCore && typeof SherpaCore.updateSnowball === 'function') {
      SherpaCore.updateSnowball(-500);
    }

    promoRows.unshift({
      no: promoRows.length ? Number(promoRows[0].no) + 1 : 1,
      category: category,
      title: title,
      content: body,
      author: user.name || '대표님',
      date: '방금 전',
      views: 0
    });

    qs('services-write-form').reset();
    closeModal();
    switchTab('promo');
  }

  function handlePrimaryAction() {
    if (currentTab === 'premium') {
      alert('제휴 문의 예시입니다. 실제 운영 시 상담 신청 폼 또는 외부 문의 채널로 연결됩니다.');
      return;
    }
    openModal();
  }

  function bindEvents() {
    document.querySelectorAll('[data-services-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        switchTab(button.getAttribute('data-services-tab'));
      });
    });

    qs('services-search-scope').addEventListener('change', function () {
      searchState.scope = this.value;
      currentPageByTab[currentTab] = 1;
      renderPromoTable();
    });

    qs('services-search-input').addEventListener('input', function () {
      searchState.query = this.value;
      currentPageByTab[currentTab] = 1;
      renderPromoTable();
    });

    qs('services-primary-btn').addEventListener('click', handlePrimaryAction);
    qs('services-write-form').addEventListener('submit', handleSubmit);

    document.querySelectorAll('[data-modal-close="services-write-modal"]').forEach(function (button) {
      button.addEventListener('click', closeModal);
    });

    qs('services-write-modal').addEventListener('click', function (event) {
      if (event.target === event.currentTarget) closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'partner-services') return;
    currentTab = window.location.hash === '#promo' ? 'promo' : 'premium';
    ensureModalHidden();
    bindEvents();
    syncHeader();
    renderCurrentTab();
  });
})();
