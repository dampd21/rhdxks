(function () {
  'use strict';

  function qs(id) { return document.getElementById(id); }
  function getEditor() { return qs('promo-editor-surface'); }

  function resetForm() {
    qs('promo-page-write-form').reset();
    getEditor().innerHTML = '';
  }

  function setSubmitLoading(loading) {
    var btn = qs('promo-submit-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? '등록 중...' : '홍보글 등록하기';
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!window.SherpaAPI || !SherpaAPI.promo) {
      alert('API가 연결되지 않았습니다.');
      return;
    }

    // 로그인 확인
    if (window.SherpaAuth && !SherpaAuth.isLoggedIn()) {
      if (confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?')) {
        window.location.href = window.SHERPA_CONFIG && SHERPA_CONFIG.PAGES
          ? SHERPA_CONFIG.PAGES.login || '/login.html'
          : '/login.html';
      }
      return;
    }

    var category = qs('promo-page-write-category').value;
    var title    = qs('promo-page-write-title').value.trim();
    var content  = getEditor().innerHTML.trim();

    if (!title || !content) {
      alert('제목과 내용을 입력해 주세요.');
      return;
    }

    setSubmitLoading(true);

    try {
      var res = await SherpaAPI.promo.create({ category: category, title: title, content: content });

      // 눈덩이 차감됐으면 로컬 잔액도 갱신
      if (res.cost && res.cost > 0 && window.SherpaCore && typeof SherpaCore.updateSnowball === 'function') {
        SherpaCore.updateSnowball(-res.cost);
      }

      window.location.href = '/app/partner/services.html#promo';
    } catch (err) {
      alert(SherpaAPI.errorMessage(err));
      setSubmitLoading(false);
    }
  }

  function bindEvents() {
    var resetBtn = qs('promo-write-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetForm);

    var form = qs('promo-page-write-form');
    if (form) form.addEventListener('submit', handleSubmit);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'partner-promo-write') return;
    bindEvents();
  });
})();
