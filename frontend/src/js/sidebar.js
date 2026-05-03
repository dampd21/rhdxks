/* ================================================================
 Sherpain21 — sidebar.js (restored menu version)
 ================================================================ */

(function () {
  'use strict';

  var SIDEBAR_CATEGORIES = [
    {
      id: 'naver',
      title: '네이버',
      icon: 'N',
      items: [
        {
          id: 'place', name: '플레이스', icon: 'P',
          items: [
            { id: 'place-rank', name: '플레이스 순위 조회', url: '/app/place/rank.html' },
            { id: 'place-seo', name: '플레이스 SEO 분석', url: '/app/place/seo.html' },
            { id: 'place-logic', name: '플레이스 리뷰 로직분석', url: '/app/place/logic.html' }
          ]
        },
        {
          id: 'blog', name: '블로그/카페', icon: 'B',
          items: [
            { id: 'blog-index', name: '블로그 지수 분석', url: '/app/blog/index.html' },
            { id: 'blog-rank', name: '키워드별 블로그 순위 분석', url: '/app/blog/rank.html' },
            { id: 'blog-post', name: '블로그 자동 포스팅', url: '/app/blog/post.html' },
            { id: 'blog-url', name: '블로그 상위노출 URL 생성기', url: '/app/blog/url.html' }
          ]
        },
        {
          id: 'review', name: '리뷰', icon: 'R',
          items: [
            { id: 'review-seo', name: '플레이스 리뷰 SEO분석', url: '/app/review/seo.html' },
            { id: 'review-qr', name: '영수증 리뷰 QR코드', url: '/app/review/qr.html' }
          ]
        }
      ]
    },
    {
      id: 'platform', title: '기타 플랫폼', icon: '▣',
      items: [
        { id: 'daangn', name: '당근', url: '/app/platform/daangn.html', badge: '개발예정' },
        { id: 'google', name: '구글', url: '/app/platform/google.html', badge: '개발예정' },
        { id: 'kakao', name: '카카오', url: '/app/platform/kakao.html', badge: '개발예정' }
      ]
    },
    {
      id: 'keyword', title: '키워드', icon: '#',
      items: [
        { id: 'keyword-volume', name: '키워드 검색량/조합', url: '/app/keyword/volume.html' },
        { id: 'keyword-trend', name: '트렌드 키워드', url: '/app/keyword/trend.html' },
        { id: 'keyword-map', name: '키워드 마인드맵', url: '/app/keyword/map.html' }
      ]
    },
    {
      id: 'ad', title: '광고', icon: 'A',
      items: [
        { id: 'ad-fraud', name: '광고 부정클릭 관리', url: '/app/ad/fraud.html' },
        { id: 'ad-cpc', name: 'CPC 순위별 단가 추적', url: '/app/ad/cpc.html' },
        { id: 'ad-optimize', name: '네이버 검색 광고 최적화', url: '/app/ad/time.html' },
        { id: 'ad-ai', name: '플랫폼 광고 소재 생성기', url: '/app/ad/ai.html' },
        { id: 'ad-campaign', name: 'CPC 캠페인 생성 자동화', url: '/app/ad/campaign.html' }
      ]
    },
    {
      id: 'review-manage', title: '리뷰 종합관리', icon: '★',
      items: [
        { id: 'review-block', name: '리뷰 블라인드/차단/삭제', url: '/app/review-manage/block.html' },
        { id: 'review-sync', name: '플랫폼 리뷰 연동', url: '/app/review-manage/sync.html' },
        { id: 'review-sns', name: '리뷰 SNS 자동업로드', url: '/app/review-manage/sns.html' }
      ]
    },
    {
      id: 'data', title: '데이터 운영 관리', icon: 'D',
      items: [
        { id: 'data-biz', name: '소상공인 데이터 수집', url: '/app/data/biz.html' },
        { id: 'data-realestate', name: '부동산 데이터 수집', url: '/app/data/realestate.html' },
        { id: 'data-parking', name: '주차 데이터 관리', url: '/app/data/parking.html' },
        { id: 'data-calc', name: '손익계산 원가율', url: '/app/data/calc.html' },
        { id: 'data-sales', name: '매출연동', url: '/app/data/sales.html' },
        { id: 'data-photo', name: '사진 메타정보 변경', url: '/app/data/photo.html' },
        { id: 'data-youtube', name: '유튜브 분석', url: '/app/data/youtube.html' }
      ]
    },
    {
      id: 'settings', title: '기타 기능', icon: 'S',
      items: [
        { id: 'settings-education', name: '강의 및 문서', url: '/app/settings/education.html' },
        { id: 'settings-report', name: '카카오 보고서 알림', url: '/app/settings/report.html' },
        { id: 'settings-guide', name: '가이드', url: '/app/settings/guide.html' }
      ]
    }
  ];

  var userProfile = {
    name: '대표님',
    email: 'owner@sherpain21.com',
    plan: 'c',
    snowball: 50000
  };

  function getPlanName(plan) {
    var m = { a: 'BASIC', b: 'STANDARD', c: 'PRO', basic: 'BASIC', standard: 'STANDARD', pro: 'PRO' };
    return m[plan] || String(plan || 'BASIC').toUpperCase();
  }

  function getPlanBadgeClass(plan) {
    var m = { a: 'badge-a', b: 'badge-b', c: 'badge-c', basic: 'badge-basic', standard: 'badge-standard', pro: 'badge-pro' };
    return m[plan] || 'badge-basic';
  }

  function isPageActive(url) {
    if (!url) return false;
    var p = window.location.pathname;
    return p === url || p.endsWith(url);
  }

  function isDashboardActive() {
    return window.location.pathname.indexOf('dashboard') !== -1;
  }

  function hasActiveItem(cat) {
    return cat.items.some(function (i) {
      if (i.items) return i.items.some(function (s) { return isPageActive(s.url); });
      return isPageActive(i.url);
    });
  }

  function escapeHTML(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function numFmt(n) {
    return Number(n || 0).toLocaleString('ko-KR');
  }

  function getStoredUser() {
    try {
      var saved = localStorage.getItem('sherpa_user');
      if (!saved) return null;
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }

  function normalizeUser(user) {
    if (!user) return userProfile;
    return {
      name: user.name || userProfile.name,
      email: user.email || userProfile.email,
      plan: user.plan || userProfile.plan,
      snowball: Number(user.snowball != null ? user.snowball : (user.token != null ? user.token : userProfile.snowball))
    };
  }

  function renderSidebar(containerId) {
    var container = document.getElementById(containerId || 'sidebar-container');
    if (!container) return;

    var stored = getStoredUser();
    if (stored) userProfile = normalizeUser(stored);

    var html = '';
    html += '<aside class="sidebar" id="sidebar">';
    html += '  <div class="sidebar-header">';
    html += '    <a href="/app/dashboard.html" class="sidebar-logo">';
    html += '      <div class="sidebar-logo-icon"><i>S</i></div>';
    html += '      <span class="logo-text">Sherpain</span>';
    html += '    </a>';
    html += '    <button id="btn-sidebar-collapse" class="sidebar-collapse-btn" title="메뉴 접기" type="button">';
    html += '      <i>≡</i>';
    html += '    </button>';
    html += '  </div>';

    html += '  <div class="sidebar-profile">';
    html += '    <div class="profile-top">';
    html += '      <div class="profile-avatar"><i>U</i></div>';
    html += '      <div class="profile-details">';
    html += '        <div class="profile-name">' + escapeHTML(userProfile.name) + '</div>';
    html += '        <div class="profile-meta">';
    html += '          <div class="profile-meta-row"><span class="profile-meta-label">플랜</span><span class="profile-plan-badge ' + getPlanBadgeClass(userProfile.plan) + '">' + getPlanName(userProfile.plan) + '</span></div>';
    html += '          <div class="profile-meta-row"><span class="profile-meta-label">보유 눈덩이</span><span class="profile-snowball">' + numFmt(userProfile.snowball) + '</span></div>';
    html += '        </div>';
    html += '      </div>';
    html += '    </div>';
    html += '    <div class="profile-actions">';
    html += '      <a href="#profile" class="profile-action-btn">정보 수정</a>';
    html += '      <a href="#billing" class="profile-action-btn">결제 및 구독</a>';
    html += '    </div>';
    html += '  </div>';

    html += '  <nav class="sidebar-nav">';
    html += '    <a href="/app/dashboard.html" class="sidebar-dashboard-link' + (isDashboardActive() ? ' active' : '') + '">';
    html += '      <i>⌂</i><span>대시보드</span>';
    html += '    </a>';

    SIDEBAR_CATEGORIES.forEach(function (cat) {
      html += renderCategory(cat);
    });

    html += '    <div class="sidebar-footer">';
    html += '      <a href="/app/settings/guide.html" class="sidebar-footer-link"><i>?</i><span class="sidebar-footer-text">가이드</span></a>';
    html += '      <a href="/app/support/cs.html?tab=faq" class="sidebar-footer-link"><i>◎</i><span class="sidebar-footer-text">고객센터</span></a>';
    html += '      <a href="#" id="btn-sidebar-logout" class="sidebar-footer-link"><i>↪</i><span class="sidebar-footer-text">로그아웃</span></a>';
    html += '    </div>';
    html += '  </nav>';

    html += '</aside>';

    container.innerHTML = html;
    bindSidebarEvents();
  }

  function renderCategory(cat) {
    var active = hasActiveItem(cat);
    var html = '';
    html += '<div class="sidebar-category' + (active ? ' active' : '') + '" data-category-id="' + escapeHTML(cat.id) + '">';
    html += '  <div class="sidebar-category-header">';
    html += '    <i>' + escapeHTML(cat.icon || '•') + '</i>';
    html += '    <span class="category-title">' + escapeHTML(cat.title) + '</span>';
    html += '    <i class="chevron-icon">▾</i>';
    html += '  </div>';
    html += '  <div class="sidebar-subcategories">';

    cat.items.forEach(function (item) {
      if (item.items) {
        html += renderSubcategory(item);
      } else {
        html += '<a href="' + item.url + '" class="sidebar-item' + (isPageActive(item.url) ? ' active' : '') + '">';
        html += '  <span>' + escapeHTML(item.name) + '</span>';
        if (item.badge) html += '<span class="sidebar-badge">' + escapeHTML(item.badge) + '</span>';
        html += '</a>';
      }
    });

    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderSubcategory(item) {
    var subActive = item.items.some(function (sub) { return isPageActive(sub.url); });
    var html = '';
    html += '<div class="sidebar-subcategory' + (subActive ? ' active' : '') + '">';
    html += '  <div class="sidebar-subcategory-header">';
    html += '    <i>' + escapeHTML(item.icon || '·') + '</i>';
    html += '    <span>' + escapeHTML(item.name) + '</span>';
    html += '    <i class="sub-chevron">▾</i>';
    html += '  </div>';
    html += '  <div class="sidebar-subcategory-items">';

    item.items.forEach(function (sub) {
      html += '<a href="' + sub.url + '" class="sidebar-sub-item' + (isPageActive(sub.url) ? ' active' : '') + '">';
      html += '  <span>' + escapeHTML(sub.name) + '</span>';
      if (sub.badge) html += '<span class="sidebar-badge">' + escapeHTML(sub.badge) + '</span>';
      html += '</a>';
    });

    html += '  </div>';
    html += '</div>';
    return html;
  }

  function bindSidebarEvents() {
    document.querySelectorAll('.sidebar-category-header').forEach(function (el) {
      el.addEventListener('click', function () {
        el.closest('.sidebar-category').classList.toggle('collapsed');
      });
    });

    document.querySelectorAll('.sidebar-subcategory-header').forEach(function (el) {
      el.addEventListener('click', function () {
        el.closest('.sidebar-subcategory').classList.toggle('collapsed');
      });
    });

    var collapseBtn = document.getElementById('btn-sidebar-collapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', toggleCollapse);
    }

    var logoutBtn = document.getElementById('btn-sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (confirm('정말 로그아웃 하시겠습니까?')) {
          localStorage.removeItem('sherpa_token');
          localStorage.removeItem('sherpa_user');
          window.location.reload();
        }
      });
    }
  }

  function toggleCollapse() {
    if (window.innerWidth <= 1100) {
      document.body.classList.toggle('sidebar-open');
      return;
    }
    var isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sherpa_sidebar_collapsed', isCollapsed ? '1' : '0');
  }

  function toggleSidebar() {
    if (window.innerWidth <= 1100) {
      document.body.classList.toggle('sidebar-open');
    } else {
      toggleCollapse();
    }
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }

  function setUserProfile(profile) {
    userProfile = Object.assign({}, userProfile, normalizeUser(profile));
  }

  function updateSnowballDisplay(val) {
    userProfile.snowball = val || 0;
    var saved = getStoredUser() || {};
    saved.snowball = userProfile.snowball;
    localStorage.setItem('sherpa_user', JSON.stringify(Object.assign({}, saved, { snowball: userProfile.snowball })));
    renderSidebar();
  }

  document.addEventListener('click', function (event) {
    if (window.innerWidth > 1100) return;
    var sidebar = document.getElementById('sidebar-container');
    var toggleBtn = document.getElementById('topbar-sidebar-btn');
    if (!document.body.classList.contains('sidebar-open')) return;
    if (sidebar && sidebar.contains(event.target)) return;
    if (toggleBtn && toggleBtn.contains(event.target)) return;
    closeSidebar();
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1100) {
      document.body.classList.remove('sidebar-open');
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    var saved = getStoredUser();
    if (saved) {
      try {
        setUserProfile(saved);
      } catch (e) {}
    }
    renderSidebar();
  });

  window.SidebarModule = {
    renderSidebar: renderSidebar,
    setUserProfile: setUserProfile,
    updateSnowballDisplay: updateSnowballDisplay,
    toggleCollapse: toggleCollapse,
    toggleSidebar: toggleSidebar,
    closeSidebar: closeSidebar
  };
})();
