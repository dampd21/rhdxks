(function () {
  'use strict';

  var currentPost = null;
  var currentComments = [];

  var CATEGORY_LABELS = {
    notice: '공지사항',
    greeting: '가입인사',
    attendance: '출석체크',
    free: '자유게시판',
    share: '정보공유',
    logic: '로직분석 연구실'
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    if (window.SherpaCore && typeof SherpaCore.escapeHTML === 'function') return SherpaCore.escapeHTML(value);
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatNumber(value) {
    if (window.SherpaCore && typeof SherpaCore.formatNumber === 'function') return SherpaCore.formatNumber(value);
    return Number(value || 0).toLocaleString('ko-KR');
  }

  function getPostId() {
    var url = new URL(window.location.href);
    return Number(url.searchParams.get('id') || 0);
  }

  function renderCommentNode(node, depth) {
    depth = depth || 0;
    var html = '';
    html += '<div class="board-comment-item' + (depth > 0 ? ' is-child' : '') + '">';
    html += '  <div class="board-comment-head">';
    html += '    <div class="board-comment-author">' + escapeHTML(node.author_name || '익명') + '</div>';
    html += '    <div class="board-comment-date">' + escapeHTML(node.created_at ? String(node.created_at).slice(0, 16).replace('T', ' ') : '-') + '</div>';
    html += '  </div>';
    html += '  <div class="board-comment-body">' + escapeHTML(node.content || '') + '</div>';
    html += '  <div class="board-comment-actions"><button class="board-comment-reply" type="button" data-reply-id="' + node.id + '" data-reply-name="' + escapeHTML(node.author_name || '익명') + '">답글</button></div>';
    html += '</div>';
    if (node.children && node.children.length) {
      node.children.forEach(function (child) {
        html += renderCommentNode(child, depth + 1);
      });
    }
    return html;
  }

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = '32px';
    el.style.height = Math.max(32, el.scrollHeight) + 'px';
  }

  function renderComments() {
    var list = qs('community-comment-list');
    if (!currentComments.length) {
      list.innerHTML = '<div class="board-empty"><div class="board-empty-title">댓글이 없습니다</div><div class="board-empty-desc">첫 번째 댓글을 남겨보세요.</div></div>';
      qs('community-comment-count').textContent = '댓글 0개';
      return;
    }

    qs('community-comment-count').textContent = '댓글 ' + currentComments.length + '개';
    list.innerHTML = '<div class="board-comment-thread">' + currentComments.map(function (node) { return renderCommentNode(node, 0); }).join('') + '</div>';

    list.querySelectorAll('[data-reply-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        qs('community-comment-parent-id').value = button.getAttribute('data-reply-id');
        qs('community-reply-label').textContent = button.getAttribute('data-reply-name') + '님에게 답글 작성 중';
        qs('community-reply-banner').classList.add('is-visible');
        qs('community-comment-input').focus();
      });
    });
  }

  function renderPost() {
    if (!currentPost) return;

    var label = CATEGORY_LABELS[currentPost.category] || '게시글';
    qs('community-view-kicker').textContent = label;
    qs('community-view-title').textContent = currentPost.title || '제목 없음';
    qs('community-view-desc').textContent = currentPost.category === 'notice'
      ? '운영 공지 및 업데이트 안내입니다.'
      : label + ' 상세 내용과 댓글을 확인할 수 있습니다.';

    var meta = [];
    meta.push('<span><strong>작성자</strong> ' + escapeHTML(currentPost.author_name || '-') + '</span>');
    meta.push('<span><strong>작성일</strong> ' + escapeHTML(currentPost.created_at ? String(currentPost.created_at).slice(0, 16).replace('T', ' ') : '-') + '</span>');
    meta.push('<span><strong>조회수</strong> ' + formatNumber(currentPost.view_count || 0) + '</span>');
    meta.push('<span><strong>댓글</strong> ' + formatNumber(currentPost.comment_count || 0) + '</span>');
    qs('community-view-meta').innerHTML = meta.join('');

    qs('community-view-content').innerHTML = currentPost.content || '<p>본문이 없습니다.</p>';

    var backCategory = currentPost.category || 'free';
    qs('community-view-back').href = '/app/community/board.html?tab=' + encodeURIComponent(backCategory);
    qs('community-view-write').href = '/app/community/write.html?category=' + encodeURIComponent(backCategory);
  }

  async function fetchDetail() {
    var postId = getPostId();
    if (!postId) {
      qs('community-view-title').textContent = '잘못된 접근입니다';
      qs('community-view-desc').textContent = '게시글 ID가 없습니다.';
      return;
    }

    try {
      var postRes = await SherpaAPI.community.detail(postId);
      var commentRes = await SherpaAPI.community.comments(postId, { page: 1, pageSize: 100 });
      currentPost = postRes.post || null;
      currentComments = commentRes.tree || [];
      renderPost();
      renderComments();
    } catch (err) {
      qs('community-view-title').textContent = '게시글을 불러오지 못했습니다';
      qs('community-view-desc').textContent = SherpaAPI.errorMessage(err);
      qs('community-comment-list').innerHTML = '';
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    if (!currentPost) return;

    var textarea = qs('community-comment-input');
    var content = textarea.value.trim();
    var parentId = qs('community-comment-parent-id').value;
    if (!content) {
      alert('댓글 내용을 입력해 주세요.');
      return;
    }

    try {
      await SherpaAPI.community.addComment(currentPost.id, {
        content: content,
        parentId: parentId ? Number(parentId) : null
      });
      qs('community-comment-form').reset();
      textarea.style.height = '32px';
      qs('community-comment-parent-id').value = '';
      qs('community-reply-banner').classList.remove('is-visible');
      await fetchDetail();
    } catch (err) {
      alert(SherpaAPI.errorMessage(err));
    }
  }

  function bindEvents() {
    var textarea = qs('community-comment-input');
    qs('community-comment-form').addEventListener('submit', handleCommentSubmit);
    qs('community-reply-cancel').addEventListener('click', function () {
      qs('community-comment-parent-id').value = '';
      qs('community-reply-banner').classList.remove('is-visible');
    });
    textarea.addEventListener('input', function () {
      autoResizeTextarea(textarea);
    });
    autoResizeTextarea(textarea);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'community-view') return;
    bindEvents();
    fetchDetail();
  });
})();
