(function () {
  'use strict';

  function qs(id) { return document.getElementById(id); }

  function esc(v) {
    return window.SherpaCore && window.SherpaCore.escapeHTML
      ? window.SherpaCore.escapeHTML(v)
      : String(v == null ? '' : v);
  }

  function formatNumber(v) {
    return window.SherpaCore && typeof SherpaCore.formatNumber === 'function'
      ? SherpaCore.formatNumber(v)
      : Number(v || 0).toLocaleString('ko-KR');
  }

  function getId() {
    var u = new URL(window.location.href);
    return Number(u.searchParams.get('id') || 0);
  }

  async function fetchAndRender() {
    var id = getId();

    qs('promo-view-title').textContent = '불러오는 중...';
    qs('promo-view-desc').textContent = '';

    if (!window.SherpaAPI || !SherpaAPI.promo) {
      qs('promo-view-title').textContent = 'API가 연결되지 않았습니다';
      return;
    }

    if (!id) {
      qs('promo-view-title').textContent = '홍보 글을 찾을 수 없습니다';
      qs('promo-view-desc').textContent = '잘못된 접근입니다. 게시글 ID가 없습니다.';
      return;
    }

    try {
      var res  = await SherpaAPI.promo.detail(id);
      var item = res.post || null;

      if (!item) {
        qs('promo-view-title').textContent = '홍보 글을 찾을 수 없습니다';
        qs('promo-view-desc').textContent = '잘못된 경로이거나 존재하지 않는 글입니다.';
        return;
      }

      qs('promo-view-kicker').textContent = item.category || '자유홍보 게시판';
      qs('promo-view-title').textContent  = item.title || '제목 없음';
      qs('promo-view-desc').textContent   = '자유홍보 게시판 상세 내용입니다.';

      qs('promo-view-meta').innerHTML =
        '<span><strong>작성자</strong> ' + esc(item.author_name || '-') + '</span>' +
        '<span><strong>작성일</strong> ' + esc(item.created_at ? String(item.created_at).slice(0, 16).replace('T', ' ') : '-') + '</span>' +
        '<span><strong>조회수</strong> ' + formatNumber(item.view_count || 0) + '</span>';

      qs('promo-view-content').innerHTML = item.content || '<p>본문이 없습니다.</p>';

    } catch (err) {
      qs('promo-view-title').textContent = '불러오지 못했습니다';
      qs('promo-view-desc').textContent  = SherpaAPI.errorMessage(err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'partner-promo-view') return;
    fetchAndRender();
  });
})();
