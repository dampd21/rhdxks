(function () {
  'use strict';

  var LABELS = { usage: '사용 오류/방법 문의', feature: '기능 건의' };

  function qs(id) { return document.getElementById(id); }

  function esc(v) {
    return window.SherpaCore && SherpaCore.escapeHTML
      ? SherpaCore.escapeHTML(v)
      : String(v == null ? '' : v);
  }

  function getParams() {
    var url = new URL(window.location.href);
    return {
      id: Number(url.searchParams.get('id') || 0)
    };
  }

  async function fetchAndRender() {
    var p = getParams();

    qs('inquiry-view-title').textContent = '불러오는 중...';
    qs('inquiry-view-desc').textContent = '';

    if (!window.SherpaAPI || !SherpaAPI.inquiry) {
      qs('inquiry-view-title').textContent = 'API가 연결되지 않았습니다';
      return;
    }

    if (!p.id) {
      qs('inquiry-view-title').textContent = '문의글을 찾을 수 없습니다';
      qs('inquiry-view-desc').textContent = '잘못된 접근입니다. 게시글 ID가 없습니다.';
      return;
    }

    try {
      var res = await SherpaAPI.inquiry.detail(p.id);
      var item = res.post || null;

      if (!item) {
        qs('inquiry-view-title').textContent = '문의글을 찾을 수 없습니다';
        qs('inquiry-view-desc').textContent = '잘못된 경로이거나 존재하지 않는 문의입니다.';
        return;
      }

      var category = item.category || 'usage';
      var label = LABELS[category] || '프로그램 문의';

      qs('inquiry-view-kicker').textContent = label;
      qs('inquiry-view-back').href = '/app/support/inquiry.html?tab=' + encodeURIComponent(category);

      var writeBtn = qs('inquiry-view-write');
      if (writeBtn) writeBtn.href = '/app/support/inquiry-write.html?type=' + encodeURIComponent(category);

      qs('inquiry-view-title').textContent = item.title || '제목 없음';

      var hasAnswer = item.comment_count && item.comment_count > 0;
      qs('inquiry-view-desc').textContent = hasAnswer ? '답변완료 상태의 문의입니다.' : '답변대기 상태의 문의입니다.';

      var meta = [];
      meta.push('<span><strong>작성자</strong> ' + esc(item.author_name || '-') + '</span>');
      meta.push('<span><strong>작성일</strong> ' + esc(item.created_at ? String(item.created_at).slice(0, 16).replace('T', ' ') : '-') + '</span>');
      meta.push('<span><strong>상태</strong> ' + (hasAnswer ? '답변완료' : '답변대기') + '</span>');
      qs('inquiry-view-meta').innerHTML = meta.join('');

      qs('inquiry-view-content').innerHTML = item.content || '<p>본문이 없습니다.</p>';

    } catch (err) {
      qs('inquiry-view-title').textContent = '불러오지 못했습니다';
      qs('inquiry-view-desc').textContent = SherpaAPI.errorMessage(err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-inquiry-view') return;
    fetchAndRender();
  });
})();
