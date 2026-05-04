(function () {
  'use strict';

  function qs(id) { return document.getElementById(id); }

  function esc(v) {
    return window.SherpaCore && SherpaCore.escapeHTML
      ? SherpaCore.escapeHTML(v)
      : String(v == null ? '' : v);
  }

  function getParams() {
    var u = new URL(window.location.href);
    return {
      tab: u.searchParams.get('tab') || 'faq',
      id:  Number(u.searchParams.get('id') || 0)
    };
  }

  function renderItem(p, item) {
    var labelMap = { faq: '자주 묻는 질문 (FAQ)', qna: 'Q&A 게시판', '1on1': '1:1 문의' };
    var label = labelMap[p.tab] || 'CS';

    qs('cs-view-kicker').textContent = label;
    qs('cs-view-back').href = '/app/support/cs.html?tab=' + encodeURIComponent(p.tab);

    var writeBtn = qs('cs-view-write');
    if (writeBtn) writeBtn.style.display = p.tab === '1on1' ? 'inline-flex' : 'none';

    if (!item) {
      qs('cs-view-title').textContent = '항목을 찾을 수 없습니다';
      qs('cs-view-desc').textContent = '잘못된 경로이거나 존재하지 않는 항목입니다.';
      return;
    }

    qs('cs-view-title').textContent = item.title || '제목 없음';

    if (p.tab === 'faq') {
      qs('cs-view-desc').textContent = 'FAQ 상세 내용입니다.';
    } else if (p.tab === 'qna') {
      qs('cs-view-desc').textContent = 'Q&A 게시글 상세입니다.';
    } else {
      var status = item.status || 'waiting';
      qs('cs-view-desc').textContent = status === 'done' ? '답변완료 상태의 1:1 문의입니다.' : '답변대기 상태의 1:1 문의입니다.';
    }

    var meta = [];
    if (item.category) meta.push('<span><strong>분류</strong> ' + esc(item.category) + '</span>');
    if (item.author_name || item.author) meta.push('<span><strong>작성자</strong> ' + esc(item.author_name || item.author) + '</span>');
    if (item.created_at || item.date) meta.push('<span><strong>작성일</strong> ' + esc(item.created_at ? String(item.created_at).slice(0, 16).replace('T', ' ') : item.date) + '</span>');
    if (item.status) meta.push('<span><strong>상태</strong> ' + (item.status === 'done' ? '답변완료' : '답변대기') + '</span>');
    qs('cs-view-meta').innerHTML = meta.join('');

    qs('cs-view-content').innerHTML = item.content || '<p>본문이 없습니다.</p>';

    // 관리자 답변 표시 (1:1 티켓)
    if (p.tab === '1on1' && item.admin_reply) {
      var replyEl = qs('cs-view-admin-reply');
      if (replyEl) {
        replyEl.style.display = 'block';
        var replyContent = qs('cs-view-admin-reply-content');
        if (replyContent) replyContent.innerHTML = esc(item.admin_reply).replace(/\n/g, '<br>');
      }
    }
  }

  async function fetchAndRender() {
    var p = getParams();

    qs('cs-view-title').textContent = '불러오는 중...';
    qs('cs-view-desc').textContent = '';

    if (!window.SherpaAPI || !SherpaAPI.cs) {
      qs('cs-view-title').textContent = 'API가 연결되지 않았습니다';
      return;
    }

    try {
      var item = null;

      if (p.tab === 'faq') {
        var res = await SherpaAPI.cs.faqDetail(p.id);
        item = res.faq || null;

      } else if (p.tab === 'qna') {
        var res2 = await SherpaAPI.cs.qnaDetail(p.id);
        item = res2.post || null;

      } else if (p.tab === '1on1') {
        // 1:1 티켓은 로그인 필요
        if (window.SherpaAuth && !SherpaAuth.isLoggedIn()) {
          qs('cs-view-title').textContent = '로그인이 필요합니다';
          qs('cs-view-desc').textContent = '1:1 문의는 로그인 후 확인할 수 있습니다.';
          return;
        }
        var res3 = await SherpaAPI.cs.ticketDetail(p.id);
        item = res3.ticket || null;
      }

      renderItem(p, item);

    } catch (err) {
      qs('cs-view-title').textContent = '불러오지 못했습니다';
      qs('cs-view-desc').textContent = SherpaAPI.errorMessage(err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-cs-view') return;
    fetchAndRender();
  });
})();
