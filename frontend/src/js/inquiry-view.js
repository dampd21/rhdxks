(function () {
  'use strict';

  var STORAGE_KEY = 'sherpa_inquiry_posts_v2';
  var LABELS = { usage: '사용 오류/방법 문의', feature: '기능 건의' };

  function qs(id) { return document.getElementById(id); }
  function esc(value) { return window.SherpaCore && SherpaCore.escapeHTML ? SherpaCore.escapeHTML(value) : String(value == null ? '' : value); }
  function getParams() { var url = new URL(window.location.href); return { type: url.searchParams.get('type') || 'usage', id: Number(url.searchParams.get('id') || 0) }; }
  function loadRows() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }

  function findItem(type, id) {
    var rows = loadRows();
    var list = Array.isArray(rows[type]) ? rows[type] : [];
    for (var i = 0; i < list.length; i += 1) if (Number(list[i].id) === id) return list[i];
    return null;
  }

  function render() {
    var p = getParams();
    var item = findItem(p.type, p.id);
    qs('inquiry-view-kicker').textContent = LABELS[p.type] || '프로그램 문의';
    qs('inquiry-view-back').href = '/app/support/inquiry.html?tab=' + encodeURIComponent(p.type);
    qs('inquiry-view-write').href = '/app/support/inquiry-write.html?type=' + encodeURIComponent(p.type);
    if (!item) {
      qs('inquiry-view-title').textContent = '문의글을 찾을 수 없습니다';
      qs('inquiry-view-desc').textContent = '잘못된 경로이거나 저장되지 않은 문의입니다.';
      return;
    }
    qs('inquiry-view-title').textContent = item.title;
    qs('inquiry-view-desc').textContent = item.status === 'done' ? '답변완료 상태의 문의입니다.' : '답변대기 상태의 문의입니다.';
    qs('inquiry-view-meta').innerHTML = '<span><strong>작성자</strong> ' + esc(item.author || '대표님') + '</span><span><strong>작성일</strong> ' + esc(item.date || '-') + '</span><span><strong>상태</strong> ' + (item.status === 'done' ? '답변완료' : '답변대기') + '</span>';
    qs('inquiry-view-content').innerHTML = item.content || '<p>본문이 없습니다.</p>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-inquiry-view') return;
    render();
  });
})();
