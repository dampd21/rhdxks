(function () {
  'use strict';
  var STORAGE_KEY = 'sherpa_promo_posts_v2';
  function qs(id) { return document.getElementById(id); }
  function esc(v) { return window.SherpaCore && window.SherpaCore.escapeHTML ? window.SherpaCore.escapeHTML(v) : String(v == null ? '' : v); }
  function loadRows() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
  function getId() { var u = new URL(window.location.href); return Number(u.searchParams.get('id') || 0); }
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'partner-promo-view') return;
    var rows = loadRows();
    var id = getId();
    var item = rows.find(function (r) { return Number(r.id) === id; });
    if (!item) { qs('promo-view-title').textContent = '홍보 글을 찾을 수 없습니다'; qs('promo-view-desc').textContent = '잘못된 경로이거나 저장되지 않은 데이터입니다.'; return; }
    qs('promo-view-kicker').textContent = item.category || '자유홍보 게시판';
    qs('promo-view-title').textContent = item.title;
    qs('promo-view-desc').textContent = '자유홍보 게시판 상세 내용입니다.';
    qs('promo-view-meta').innerHTML = '<span><strong>작성자</strong> ' + esc(item.author || '-') + '</span><span><strong>작성일</strong> ' + esc(item.date || '-') + '</span><span><strong>조회수</strong> ' + Number(item.views || 0).toLocaleString('ko-KR') + '</span>';
    qs('promo-view-content').innerHTML = item.content || '<p>본문이 없습니다.</p>';
  });
})();
