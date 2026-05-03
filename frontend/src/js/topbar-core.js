(function () {
  'use strict';

  var notifications = (window.SHERPA_CONFIG && SHERPA_CONFIG.DEFAULT_NOTIFICATIONS) || [];

  var TOPBAR_MENU = [
    {
      id: 'community',
      label: '커뮤니티',
      href: '/app/community/board.html?tab=notice',
      columns: 2,
      items: [
        { label: '공지사항', href: '/app/community/board.html?tab=notice', description: '운영 공지와 업데이트 확인' },
        { label: '가입인사', href: '/app/community/board.html?tab=greeting', description: '새 멤버 환영과 첫 인사' },
        { label: '출석체크', href: '/app/community/board.html?tab=attendance', description: '오늘의 한 줄 출석 기록' },
        { label: '자유게시판', href: '/app/community/board.html?tab=free', description: '운영 고민과 실무 대화' },
        { label: '정보공유', href: '/app/community/board.html?tab=share', description: '레퍼런스와 노하우 공유' },
        { label: '로직분석 연구실', href: '/app/community/board.html?tab=logic', description: '로직 변동 관찰과 분석' }
      ]
    },
    {
      id: 'partner',
      label: '제휴사 및 자유홍보',
      href: '/app/partner/services.html#premium',
      columns: 1,
      items: [
        { label: '공식 제휴 파트너사', href: '/app/partner/services.html#premium', description: '공식 계약 에이전시 서비스 보기' },
        { label: '자유홍보 게시판', href: '/app/partner/services.html#promo', description: '오늘 무료 1회 작성 가능한 홍보 보드' }
      ]
    },
    {
      id: 'missions',
      label: '모집 및 의뢰',
      href: '/app/escrow/missions.html?tab=recruit',
      columns: 1,
      items: [
        { label: '모집 (의뢰하기)', href: '/app/escrow/missions.html?tab=recruit', description: '리뷰·체험단 미션 등록' },
        { label: '의뢰 (수행하기)', href: '/app/escrow/missions.html?tab=apply', description: '수행 가능한 미션 탐색' }
      ]
    },
    {
      id: 'inquiry',
      label: '프로그램 문의',
      href: '/app/support/inquiry.html?tab=usage',
      columns: 1,
      items: [
        { label: '사용 오류/방법 문의', href: '/app/support/inquiry.html?tab=usage', description: '오류, 사용법, 화면 문의 접수' },
        { label: '기능 건의', href: '/app/support/inquiry.html?tab=feature', description: '원하는 기능과 개선 제안 등록' }
      ]
    },
    {
      id: 'cs',
      label: '고객센터',
      href: '/app/support/cs.html?tab=faq',
      columns: 1,
      items: [
        { label: '자주 묻는 질문 (FAQ)', href: '/app/support/cs.html?tab=faq', description: '결제, 계정, 이용안내 빠른 확인' },
        { label: 'Q&A 게시판', href: '/app/support/cs.html?tab=qna', description: '일반 문의 게시판' },
        { label: '1:1 문의 내역', href: '/app/support/cs.html?tab=1on1', description: '민감한 문의 확인 및 작성' },
        { label: '카카오톡 실시간 상담', href: (window.SHERPA_CONFIG && SHERPA_CONFIG.KAKAO_CS_URL) || '#', external: true, description: '긴급 문의는 카카오 채널 연결' }
      ]
    }
  ];

  function getFallbackUser() {
    return {
      name: '대표님',
      email: 'owner@sherpain21.com',
      plan: 'pro',
      snowball: 125000
    };
  }

  function getUser() {
    try {
      if (window.SherpaCore && typeof SherpaCore.getUser === 'function') {
        return window.SherpaCore.getUser();
      }
      var raw = localStorage.getItem('sherpa_user');
      return raw ? JSON.parse(raw) : getFallbackUser();
    } catch (e) {
      return getFallbackUser();
    }
  }

  function getPlanLabel(plan) {
    var value = String(plan || 'basic').toLowerCase();
    if (value === 'a' || value === 'basic') return 'BASIC';
    if (value === 'b' || value === 'standard') return 'STANDARD';
    return 'PRO';
  }

  function getPlanClass(plan) {
    var value = String(plan || 'basic').toLowerCase();
    if (value === 'a' || value === 'basic') return 'badge-basic';
    if (value === 'b' || value === 'standard') return 'badge-standard';
    return 'badge-pro';
  }

  function escapeHTML(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('ko-KR');
  }

  function getURLState() {
    var url = new URL(window.location.href);
    return {
      pathname: url.pathname,
      tab: url.searchParams.get('tab') || '',
      hash: url.hash || ''
    };
  }

  function supportsHover() {
    return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function svgMenu() {
    return '<svg class="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>';
  }

  function svgBell() {
    return '<svg class="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke-linecap="round"/></svg>';
  }

  function svgUser() {
    return '<svg class="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 21a8 8 0 1 0-16 0" stroke-linecap="round"/><circle cx="12" cy="8" r="4"/></svg>';
  }

  function svgChevronRight() {
    return '<svg class="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function hrefState(href) {
    var target = new URL(href, window.location.origin);
    return {
      pathname: target.pathname,
      tab: target.searchParams.get('tab') || '',
      hash: target.hash || ''
    };
  }

  function isEntryActive(href) {
    if (/^(https?:)?\/\//.test(href)) return false;
    var current = getURLState();
    var target = hrefState(href);
    if (current.pathname !== target.pathname) return false;
    if (target.tab && current.tab !== target.tab) return false;
    if (target.hash && current.hash !== target.hash) return false;
    return true;
  }

  function pathMatches(targetHref) {
    var current = new URL(window.location.href);
    var target = new URL(targetHref, window.location.origin);
    return current.pathname === target.pathname;
  }

  function isMenuActive(menu) {
    return menu.items.some(function (item) { return isEntryActive(item.href); }) || pathMatches(menu.href);
  }

  function renderMenuItem(menu) {
    var active = isMenuActive(menu);
    var dropdownClass = menu.columns === 2 ? 'topbar-dropdown-grid two-col' : 'topbar-dropdown-grid';
    var html = '';
    html += '<div class="topbar-item' + (active ? ' is-active' : '') + '" data-topbar-item data-menu-id="' + menu.id + '">';
    html += '  <a class="topbar-link" href="' + menu.href + '" data-topbar-link data-menu-id="' + menu.id + '" data-has-dropdown="1">' + escapeHTML(menu.label) + '</a>';
    html += '  <div class="topbar-dropdown" role="menu" aria-label="' + escapeHTML(menu.label) + '">';
    html += '    <div class="' + dropdownClass + '">';
    menu.items.forEach(function (item) {
      html += '      <a class="topbar-dropdown-item' + (isEntryActive(item.href) ? ' is-active' : '') + '" href="' + item.href + '" ' + (item.external ? 'target="_blank" rel="noopener noreferrer"' : '') + '>';
      html += '        <div><strong>' + escapeHTML(item.label) + '</strong><span>' + escapeHTML(item.description || '') + '</span></div>';
      html += '      </a>';
    });
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderNotifications() {
    if (!notifications.length) {
      return '<div class="topbar-empty"><strong>새 알림이 없습니다</strong><p>새 댓글, 문의 답변, 시스템 안내가 이곳에 표시됩니다.</p></div>';
    }
    return notifications.map(function (item) {
      return '<a class="topbar-notification-item" href="' + escapeHTML(item.href || '#') + '"><strong>' + escapeHTML(item.title) + '</strong><p>' + escapeHTML(item.message || '') + '</p></a>';
    }).join('');
  }

  function renderDevtools(user) {
    return '' +
      '<div class="topbar-devtools-wrap" id="topbar-devtools-wrap">' +
      '  <button class="topbar-tool-btn" id="topbar-devtools-btn" type="button" aria-label="Developer Tools 열기" aria-expanded="false">Dev</button>' +
      '  <div class="topbar-devtools-panel" id="topbar-devtools-panel">' +
      '    <div class="topbar-panel-header"><div class="topbar-panel-title">Developer Tools</div><span class="badge badge-muted">로컬 전용</span></div>' +
      '    <div class="devtools-form">' +
      '      <div class="devtools-field">' +
      '        <label class="devtools-label" for="topbar-dev-plan">플랜</label>' +
      '        <select class="devtools-select" id="topbar-dev-plan">' +
      '          <option value="basic"' + ((String(user.plan) === 'basic' || String(user.plan) === 'a') ? ' selected' : '') + '>BASIC</option>' +
      '          <option value="standard"' + ((String(user.plan) === 'standard' || String(user.plan) === 'b') ? ' selected' : '') + '>STANDARD</option>' +
      '          <option value="pro"' + ((String(user.plan) === 'pro' || String(user.plan) === 'c') ? ' selected' : '') + '>PRO</option>' +
      '        </select>' +
      '      </div>' +
      '      <div class="devtools-field">' +
      '        <label class="devtools-label" for="topbar-dev-snowball">눈덩이</label>' +
      '        <input class="devtools-input" id="topbar-dev-snowball" type="number" min="0" value="' + escapeHTML(String(user.snowball || 0)) + '" />' +
      '      </div>' +
      '      <div class="devtools-actions">' +
      '        <button class="btn btn-ghost btn-sm" id="topbar-dev-reset" type="button">기본값</button>' +
      '        <button class="btn btn-secondary btn-sm" id="topbar-dev-login" type="button">테스트 로그인</button>' +
      '        <button class="btn btn-primary btn-sm" id="topbar-dev-apply" type="button">적용</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function renderTopbar(containerId) {
    var container = document.getElementById(containerId || 'topbar-container');
    if (!container) return;
    var user = getUser();
    var menuHtml = TOPBAR_MENU.map(renderMenuItem).join('');

    var html = '';
    html += '<div class="topbar" role="navigation" aria-label="상단 글로벌 메뉴">';
    html += '  <div class="topbar-start">';
    html += '    <button class="topbar-sidebar-btn" id="topbar-sidebar-btn" type="button" aria-label="사이드바 열기 또는 접기">' + svgMenu() + '</button>';
    html += '    <div class="topbar-menu">' + menuHtml + '</div>';
    html += '  </div>';
    html += '  <div class="topbar-end">';
    html += renderDevtools(user);
    html += '    <div class="topbar-panel-wrap" id="topbar-notification-wrap">';
    html += '      <button class="topbar-icon-btn" id="topbar-notification-btn" type="button" aria-label="알림 열기" aria-expanded="false">' + svgBell();
    if (notifications.length) html += '<span class="topbar-badge">' + (notifications.length > 99 ? '99+' : notifications.length) + '</span>';
    html += '      </button>';
    html += '      <div class="topbar-panel" id="topbar-notification-panel">';
    html += '        <div class="topbar-panel-header"><div class="topbar-panel-title">알림</div><span class="badge badge-muted">' + notifications.length + '건</span></div>';
    html += '        <div class="topbar-panel-list">' + renderNotifications() + '</div>';
    html += '      </div>';
    html += '    </div>';
    html += '    <div class="topbar-user-wrap" id="topbar-user-wrap">';
    html += '      <button class="topbar-user-btn" id="topbar-user-btn" type="button" aria-label="사용자 메뉴 열기" aria-expanded="false">' + svgUser() + '</button>';
    html += '      <div class="topbar-user-panel" id="topbar-user-panel">';
    html += '        <div class="topbar-user-summary">';
    html += '          <div class="topbar-user-name">' + escapeHTML(user.name || '대표님') + '</div>';
    html += '          <div class="topbar-user-email">' + escapeHTML(user.email || 'owner@sherpain21.com') + '</div>';
    html += '          <div class="topbar-user-meta">';
    html += '            <span class="profile-plan-badge ' + getPlanClass(user.plan) + '">' + getPlanLabel(user.plan) + '</span>';
    html += '            <span class="topbar-user-balance">보유 <strong>' + formatNumber(user.snowball) + '</strong></span>';
    html += '          </div>';
    html += '        </div>';
    html += '        <div class="topbar-user-links">';
    html += '          <a class="topbar-user-link" href="#profile">프로필/설정 ' + svgChevronRight() + '</a>';
    html += '          <a class="topbar-user-link" href="#billing">플랜/결제 ' + svgChevronRight() + '</a>';
    html += '          <div class="topbar-divider"></div>';
    html += '          <button class="topbar-user-link danger" id="topbar-logout-btn" type="button">로그아웃 ' + svgChevronRight() + '</button>';
    html += '        </div>';
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    container.innerHTML = html;
    bindTopbarEvents();
  }

  function closeMenuDropdowns(exceptId) {
    document.querySelectorAll('[data-topbar-item]').forEach(function (item) {
      if (exceptId && item.getAttribute('data-menu-id') === exceptId) return;
      item.classList.remove('is-open');
    });
  }

  function closeActionPanels() {
    ['topbar-notification-wrap', 'topbar-user-wrap', 'topbar-devtools-wrap'].forEach(function (id) {
      var wrap = document.getElementById(id);
      if (wrap) wrap.classList.remove('is-open');
    });
    ['topbar-notification-btn', 'topbar-user-btn', 'topbar-devtools-btn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function closeAllPanels() {
    closeMenuDropdowns();
    closeActionPanels();
  }

  function openDropdown(menuId) {
    closeActionPanels();
    closeMenuDropdowns(menuId);
    var item = document.querySelector('[data-topbar-item][data-menu-id="' + menuId + '"]');
    if (item) item.classList.add('is-open');
  }

  function toggleWrap(wrapId, buttonId) {
    closeMenuDropdowns();
    var targetWrap = document.getElementById(wrapId);
    var targetButton = document.getElementById(buttonId);
    if (!targetWrap || !targetButton) return;

    ['topbar-notification-wrap', 'topbar-user-wrap', 'topbar-devtools-wrap'].forEach(function (id) {
      if (id !== wrapId) {
        var wrap = document.getElementById(id);
        if (wrap) wrap.classList.remove('is-open');
      }
    });
    ['topbar-notification-btn', 'topbar-user-btn', 'topbar-devtools-btn'].forEach(function (id) {
      if (id !== buttonId) {
        var btn = document.getElementById(id);
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });

    var willOpen = !targetWrap.classList.contains('is-open');
    targetWrap.classList.toggle('is-open', willOpen);
    targetButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  async function requestDevSession() {
    var apiBase = (window.SHERPA_CONFIG && window.SHERPA_CONFIG.API_URL) || '';
    if (!apiBase) {
      alert('API URL이 설정되지 않았습니다.');
      return;
    }

    try {
      var response = await fetch(apiBase + '/api/dev/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'sherpain-dev-2026' })
      });

      var data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error((data && data.error) || '테스트 로그인 실패');
      }

      localStorage.setItem('sherpa_token', data.token);
      localStorage.setItem('sherpa_user', JSON.stringify(data.user));

      if (window.SherpaCore && typeof window.SherpaCore.saveUser === 'function') {
        window.SherpaCore.saveUser(data.user);
      } else {
        window.dispatchEvent(new CustomEvent('sherpa:user-updated', { detail: data.user }));
      }

      if (window.SidebarModule && typeof window.SidebarModule.renderSidebar === 'function') {
        window.SidebarModule.renderSidebar();
      }

      renderTopbar();
      alert('테스트 로그인 완료');
    } catch (err) {
      alert(err && err.message ? err.message : '테스트 로그인 실패');
    }
  }

  function bindDevtoolsEvents() {
    var toggleBtn = document.getElementById('topbar-devtools-btn');
    var applyBtn = document.getElementById('topbar-dev-apply');
    var resetBtn = document.getElementById('topbar-dev-reset');
    var loginBtn = document.getElementById('topbar-dev-login');
    var planEl = document.getElementById('topbar-dev-plan');
    var snowballEl = document.getElementById('topbar-dev-snowball');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleWrap('topbar-devtools-wrap', 'topbar-devtools-btn');
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (planEl) planEl.value = 'pro';
        if (snowballEl) snowballEl.value = '125000';
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', function () {
        requestDevSession();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var current = getUser();
        var updated = {
          name: current.name || '대표님',
          email: current.email || 'owner@sherpain21.com',
          plan: planEl ? planEl.value : 'pro',
          snowball: snowballEl ? Number(snowballEl.value || 0) : 0
        };

        if (window.SherpaCore && typeof window.SherpaCore.saveUser === 'function') {
          window.SherpaCore.saveUser(updated);
        } else {
          localStorage.setItem('sherpa_user', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('sherpa:user-updated', { detail: updated }));
        }

        if (window.SidebarModule && typeof window.SidebarModule.renderSidebar === 'function') {
          window.SidebarModule.renderSidebar();
        }

        renderTopbar();
      });
    }
  }

  function bindTopbarEvents() {
    var hoverEnabled = supportsHover();

    document.querySelectorAll('[data-topbar-item]').forEach(function (item) {
      var menuId = item.getAttribute('data-menu-id');
      var link = item.querySelector('[data-topbar-link]');

      if (hoverEnabled) {
        item.addEventListener('mouseenter', function () {
          openDropdown(menuId);
        });
        item.addEventListener('mouseleave', function () {
          item.classList.remove('is-open');
        });
      }

      item.addEventListener('focusin', function () {
        openDropdown(menuId);
      });

      item.addEventListener('focusout', function (event) {
        if (item.contains(event.relatedTarget)) return;
        item.classList.remove('is-open');
      });

      if (link) {
        link.addEventListener('click', function (event) {
          if (hoverEnabled) return;
          if (!item.classList.contains('is-open')) {
            event.preventDefault();
            openDropdown(menuId);
          }
        });
      }
    });

    var sidebarBtn = document.getElementById('topbar-sidebar-btn');
    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', function () {
        if (window.SidebarModule && typeof window.SidebarModule.toggleSidebar === 'function') {
          window.SidebarModule.toggleSidebar();
        }
      });
    }

    var notifBtn = document.getElementById('topbar-notification-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleWrap('topbar-notification-wrap', 'topbar-notification-btn');
      });
    }

    var userBtn = document.getElementById('topbar-user-btn');
    if (userBtn) {
      userBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleWrap('topbar-user-wrap', 'topbar-user-btn');
      });
    }

    var logoutBtn = document.getElementById('topbar-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        localStorage.removeItem('sherpa_token');
        localStorage.removeItem('sherpa_user');
        if (window.SherpaCore && typeof window.SherpaCore.ensureDefaultUser === 'function') {
          window.SherpaCore.ensureDefaultUser();
        }
        closeAllPanels();
        renderTopbar();
        if (window.SidebarModule && typeof window.SidebarModule.renderSidebar === 'function') {
          window.SidebarModule.renderSidebar();
        }
        alert('로그아웃되었습니다.');
      });
    }

    bindDevtoolsEvents();
  }

  document.addEventListener('click', function (event) {
    if (!event.target.closest('#topbar-container')) {
      closeAllPanels();
      return;
    }
    var insideAction = event.target.closest('#topbar-notification-wrap, #topbar-user-wrap, #topbar-devtools-wrap');
    if (!insideAction) {
      closeActionPanels();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeAllPanels();
  });

  window.addEventListener('sherpa:user-updated', function () {
    renderTopbar();
  });

  function init() {
    renderTopbar();
  }

  window.TopbarCore = {
    init: init,
    renderTopbar: renderTopbar,
    setNotifications: function (items) {
      notifications = Array.isArray(items) ? items.slice() : [];
      renderTopbar();
    },
    closeAllPanels: closeAllPanels,
    requestDevSession: requestDevSession,
    menu: TOPBAR_MENU
  };
})();
