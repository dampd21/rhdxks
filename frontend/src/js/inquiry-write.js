(function () {
  'use strict';

  var TYPE_META = {
    usage: {
      title: '사용 오류/방법 문의 작성',
      description: '화면 오류, 사용법, 재현 순서를 구체적으로 적어 주세요.'
    },
    feature: {
      title: '기능 건의 작성',
      description: '실무에서 필요한 기능과 원하는 개선 방향을 자세히 적어 주세요.'
    }
  };

  function qs(id) { return document.getElementById(id); }

  function getType() {
    var url = new URL(window.location.href);
    var type = url.searchParams.get('type') || 'usage';
    return TYPE_META[type] ? type : 'usage';
  }

  function setType(type) {
    var meta = TYPE_META[type];
    qs('inquiry-page-write-type').value = type;
    qs('inquiry-write-title-display').textContent = meta.title;
    qs('inquiry-write-desc-display').textContent = meta.description;
    qs('inquiry-write-back').href = '/app/support/inquiry.html?tab=' + encodeURIComponent(type);
  }

  function getEditor() { return qs('inquiry-editor-surface'); }

  function resetForm() {
    qs('inquiry-page-write-form').reset();
    getEditor().innerHTML = '';
    setType(getType());
  }

  function setSubmitLoading(loading) {
    var btn = qs('inquiry-submit-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? '제출 중...' : '문의 제출하기';
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!window.SherpaAPI || !SherpaAPI.inquiry) {
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

    var type    = qs('inquiry-page-write-type').value;
    var title   = qs('inquiry-page-write-title').value.trim();
    var content = getEditor().innerHTML.trim();

    if (!title || !content) {
      alert('제목과 문의 내용을 입력해 주세요.');
      return;
    }

    setSubmitLoading(true);

    try {
      await SherpaAPI.inquiry.create({ category: type, title: title, content: content });
      window.location.href = '/app/support/inquiry.html?tab=' + encodeURIComponent(type);
    } catch (err) {
      alert(SherpaAPI.errorMessage(err));
      setSubmitLoading(false);
    }
  }

  function bindEvents() {
    var typeEl = qs('inquiry-page-write-type');
    if (typeEl) typeEl.addEventListener('change', function () { setType(this.value); });

    var resetBtn = qs('inquiry-write-reset');
    if (resetBtn) resetBtn.addEventListener('click', function () { resetForm(); });

    var form = qs('inquiry-page-write-form');
    if (form) form.addEventListener('submit', handleSubmit);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-inquiry-write') return;
    setType(getType());
    bindEvents();
  });
})();
