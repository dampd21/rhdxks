(function () {
  'use strict';

  var ALLOWED_CATEGORIES = ['greeting', 'free', 'share', 'logic'];
  var CATEGORY_META = {
    greeting: { title: '가입인사 작성', description: '처음 합류한 이유와 운영 중인 업종, 기대하는 점을 자유롭게 적어 주세요.' },
    free: { title: '자유게시판 작성', description: '운영 중 겪은 고민, 실무 질문, 최근 이슈를 자유롭게 작성해 주세요.' },
    share: { title: '정보공유 작성', description: '자료, 사례, 템플릿, 체크리스트를 공유하는 글을 작성해 주세요.' },
    logic: { title: '로직분석 연구실 작성', description: '순위/리뷰/저장수 변동에 대한 관찰 메모를 자세히 기록해 주세요.' }
  };

  var uploads = [];

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    if (window.SherpaCore && typeof window.SherpaCore.escapeHTML === 'function') return window.SherpaCore.escapeHTML(value);
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function getCategoryFromUrl() {
    var url = new URL(window.location.href);
    var category = url.searchParams.get('category') || 'greeting';
    return ALLOWED_CATEGORIES.indexOf(category) !== -1 ? category : 'greeting';
  }

  function setCategory(category) {
    var meta = CATEGORY_META[category] || CATEGORY_META.greeting;
    qs('community-page-write-category').value = category;
    qs('community-write-title-display').textContent = meta.title;
    qs('community-write-desc-display').textContent = meta.description;
    qs('community-write-back').href = '/app/community/board.html?tab=' + encodeURIComponent(category);
  }

  function getEditor() {
    return qs('community-editor-surface');
  }

  function getEditorRange() {
    var editor = getEditor();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  }

  function insertHtmlAtCaret(html, savedRange) {
    var editor = getEditor();
    editor.focus();
    var sel = window.getSelection();

    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    if (!sel || !sel.rangeCount) {
      document.execCommand('insertHTML', false, html);
      return;
    }

    var range = sel.getRangeAt(0);
    range.deleteContents();
    var temp = document.createElement('div');
    temp.innerHTML = html;
    var frag = document.createDocumentFragment();
    var node;
    var lastNode = null;
    while ((node = temp.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);
    if (lastNode) {
      range = range.cloneRange();
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function renderUploads() {
    var mount = qs('community-upload-previews');
    if (!uploads.length) {
      mount.innerHTML = '';
      return;
    }

    mount.innerHTML = uploads.map(function (item, index) {
      var statusText = item.status === 'uploading' ? '업로드 중...' : item.status === 'error' ? '업로드 실패' : '업로드 완료';
      return '' +
        '<div class="board-upload-preview">' +
        '  <img src="' + item.src + '" alt="첨부 미리보기" />' +
        '  <div class="board-upload-preview-meta">' +
        '    <div>' + escapeHTML(item.name) + '</div>' +
        '    <div style="margin-top:4px; color:' + (item.status === 'error' ? 'var(--color-danger)' : 'var(--color-gray-500)') + ';">' + statusText + '</div>' +
        '    <button class="btn btn-ghost btn-sm" type="button" data-upload-remove="' + index + '" style="margin-top:6px; padding:0; min-height:auto;">제거</button>' +
        '  </div>' +
        '</div>';
    }).join('');

    mount.querySelectorAll('[data-upload-remove]').forEach(function (button) {
      button.addEventListener('click', function () {
        uploads.splice(Number(button.getAttribute('data-upload-remove')), 1);
        renderUploads();
      });
    });
  }

  async function uploadSingleFile(file, savedRange) {
    var item = {
      name: file.name || 'image',
      src: '',
      status: 'uploading',
      url: ''
    };
    uploads.push(item);
    renderUploads();

    try {
      var res = await SherpaAPI.community.uploadImage(file);
      var image = res.image || {};
      item.src = image.url || (image.variants && image.variants[0]) || '';
      item.url = item.src;
      item.status = 'done';
      renderUploads();

      if (item.url) {
        insertHtmlAtCaret('<p><img src="' + item.url + '" alt="첨부 이미지" style="max-width:100%; border-radius:12px;" /></p>', savedRange);
      }
    } catch (err) {
      item.status = 'error';
      renderUploads();
      alert(SherpaAPI.errorMessage(err));
    }
  }

  async function handleFiles(fileList, savedRange) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    for (var i = 0; i < files.length; i += 1) {
      var file = files[i];
      if (!file || !file.type || file.type.indexOf('image/') !== 0) continue;
      await uploadSingleFile(file, savedRange);
    }
  }

  function getEditorHtml() {
    return getEditor().innerHTML.trim();
  }

  function resetEditor() {
    qs('community-page-write-form').reset();
    uploads = [];
    renderUploads();
    getEditor().innerHTML = '';
    setCategory(getCategoryFromUrl());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    var category = qs('community-page-write-category').value;
    var title = qs('community-page-write-title').value.trim();
    var content = getEditorHtml();

    if (!title || !content) {
      alert('제목과 본문을 입력해 주세요.');
      return;
    }

    try {
      await SherpaAPI.community.create({
        board: 'community',
        category: category,
        title: title,
        content: content,
        imageUrls: uploads.filter(function (item) {
          return item.status === 'done' && item.url;
        }).map(function (item) {
          return item.url;
        })
      });
      window.location.href = '/app/community/board.html?tab=' + encodeURIComponent(category);
    } catch (err) {
      alert(SherpaAPI.errorMessage(err));
    }
  }

  function bindEvents() {
    var editor = getEditor();

    editor.addEventListener('paste', function (event) {
      var items = event.clipboardData && event.clipboardData.items ? event.clipboardData.items : [];
      var imageFiles = [];
      var savedRange = getEditorRange();
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          imageFiles.push(items[i].getAsFile());
        }
      }
      if (imageFiles.length) {
        event.preventDefault();
        handleFiles(imageFiles, savedRange);
      }
    });

    qs('community-upload-trigger').addEventListener('click', function () {
      qs('community-upload-input').click();
    });

    qs('community-upload-input').addEventListener('change', function () {
      var savedRange = getEditorRange();
      handleFiles(this.files, savedRange);
      this.value = '';
    });

    qs('community-upload-clear').addEventListener('click', function () {
      uploads = [];
      renderUploads();
    });

    qs('community-write-reset').addEventListener('click', function () {
      resetEditor();
    });

    qs('community-page-write-category').addEventListener('change', function () {
      setCategory(this.value);
    });

    qs('community-page-write-form').addEventListener('submit', handleSubmit);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'community-write') return;
    setCategory(getCategoryFromUrl());
    bindEvents();
  });
})();
