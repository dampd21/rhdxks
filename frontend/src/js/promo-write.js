(function () {
  'use strict';
  var STORAGE_KEY = 'sherpa_promo_posts_v2';
  var freeKey = 'sherpa_promo_free_remaining';
  function qs(id) { return document.getElementById(id); }
  function loadRows() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
  function saveRows(rows) { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }
  function getEditor() { return qs('promo-editor-surface'); }
  function resetForm() { qs('promo-page-write-form').reset(); getEditor().innerHTML = ''; }
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'partner-promo-write') return;
    qs('promo-write-reset').addEventListener('click', resetForm);
    qs('promo-page-write-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var rows = loadRows();
      var user = window.SherpaCore && SherpaCore.getUser ? SherpaCore.getUser() : { name: '대표님', snowball: 0 };
      var freeRemaining = Number(localStorage.getItem(freeKey) || '1');
      var title = qs('promo-page-write-title').value.trim();
      var content = getEditor().innerHTML.trim();
      if (!title || !content) { alert('제목과 내용을 입력해 주세요.'); return; }
      if (freeRemaining <= 0 && Number(user.snowball || 0) < 500) { alert('눈덩이가 부족합니다. 최소 500 눈덩이가 필요합니다.'); return; }
      if (freeRemaining > 0) localStorage.setItem(freeKey, String(freeRemaining - 1));
      else if (window.SherpaCore && SherpaCore.updateSnowball) SherpaCore.updateSnowball(-500);
      var nextId = rows.length ? Number(rows[0].id || rows[0].no || 0) + 1 : 1;
      rows.unshift({ id: nextId, no: nextId, category: qs('promo-page-write-category').value, title: title, content: content, author: user.name || '대표님', date: '방금 전', views: 0, createdAt: new Date().toISOString() });
      saveRows(rows);
      window.location.href = '/app/partner/services.html#promo';
    });
  });
})();
