(function () {
  'use strict';

  var STORAGE_KEY = 'sherpa_inquiry_posts_v2';
  var TYPE_META = {
    usage: { title: '사용 오류/방법 문의 작성', description: '화면 오류, 사용법, 재현 순서를 구체적으로 적어 주세요.' },
    feature: { title: '기능 건의 작성', description: '실무에서 필요한 기능과 원하는 개선 방향을 자세히 적어 주세요.' }
  };

  function qs(id) { return document.getElementById(id); }
  function getType() { var url = new URL(window.location.href); var type = url.searchParams.get('type') || 'usage'; return TYPE_META[type] ? type : 'usage'; }
  function setType(type) { var meta = TYPE_META[type]; qs('inquiry-page-write-type').value = type; qs('inquiry-write-title-display').textContent = meta.title; qs('inquiry-write-desc-display').textContent = meta.description; qs('inquiry-write-back').href = '/app/support/inquiry.html?tab=' + encodeURIComponent(type); }
  function loadRows() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveRows(rows) { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }
  function getEditor() { return qs('inquiry-editor-surface'); }

  function resetForm() { qs('inquiry-page-write-form').reset(); getEditor().innerHTML = ''; setType(getType()); }

  function bindEvents() {
    qs('inquiry-page-write-type').addEventListener('change', function () { setType(this.value); });
    qs('inquiry-write-reset').addEventListener('click', function () { resetForm(); });
    qs('inquiry-page-write-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var type = qs('inquiry-page-write-type').value;
      var title = qs('inquiry-page-write-title').value.trim();
      var content = getEditor().innerHTML.trim();
      if (!title || !content) { alert('제목과 문의 내용을 입력해 주세요.'); return; }
      var rows = loadRows();
      rows[type] = Array.isArray(rows[type]) ? rows[type] : [];
      var nextId = rows[type].length ? Number(rows[type][0].id || rows[type][0].no || 0) + 1 : 1;
      rows[type].unshift({ id: nextId, no: nextId, type: type, status: 'waiting', title: title, content: content, author: (window.SherpaCore && SherpaCore.getUser ? SherpaCore.getUser().name : '대표님'), date: '방금 전', createdAt: new Date().toISOString() });
      saveRows(rows);
      window.location.href = '/app/support/inquiry.html?tab=' + encodeURIComponent(type);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-inquiry-write') return;
    setType(getType());
    bindEvents();
  });
})();
