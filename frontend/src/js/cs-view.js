(function () {
  'use strict';

  var STORAGE_KEY = 'sherpa_cs_posts_v2';
  var FAQ_ROWS = [
    { id: 7, category: '결제/환불', title: 'PRO 요금제에서 결제 수단을 변경하고 싶습니다.', content: '결제 수단 변경 방법과 적용 시점을 안내합니다.' },
    { id: 6, category: '계정/로그인', title: '카카오 간편 가입 후 이메일 계정과 연동할 수 있나요?', content: '소셜 계정과 이메일 계정 연동 가능 여부를 설명합니다.' },
    { id: 5, category: '이용안내', title: '영수증 리뷰 모집/의뢰 시 플랫폼 수수료는 어떻게 되나요?', content: '미션 보상과 플랫폼 수수료 계산 기준을 정리합니다.' },
    { id: 4, category: '이용안내', title: '출석체크는 하루에 한 번만 가능한가요?', content: '출석체크 가능 횟수와 리워드 정책을 안내합니다.' },
    { id: 3, category: '플레이스', title: 'Place ID는 어디에서 확인하나요?', content: '네이버 플레이스 URL에서 Place ID를 확인하는 방법을 설명합니다.' },
    { id: 2, category: '계정/탈퇴', title: '회원 탈퇴 전에 데이터 백업이 가능한가요?', content: '탈퇴 전 필요한 데이터 확인 절차를 안내합니다.' },
    { id: 1, category: '고객센터', title: '카카오톡 상담 가능 시간은 언제인가요?', content: '실시간 상담 운영 시간을 안내합니다.' }
  ];
  function qs(id) { return document.getElementById(id); }
  function esc(v) { return window.SherpaCore && SherpaCore.escapeHTML ? SherpaCore.escapeHTML(v) : String(v == null ? '' : v); }
  function loadRows() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function getParams() { var u = new URL(window.location.href); return { tab: u.searchParams.get('tab') || 'faq', id: Number(u.searchParams.get('id') || 0) }; }
  function findItem(tab, id) { if (tab === 'faq') return FAQ_ROWS.find(function (r) { return Number(r.id) === id; }) || null; var rows = loadRows(); var list = Array.isArray(rows[tab]) ? rows[tab] : []; for (var i = 0; i < list.length; i += 1) if (Number(list[i].id) === id) return list[i]; return null; }
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'support-cs-view') return;
    var p = getParams();
    var item = findItem(p.tab, p.id);
    var label = p.tab === 'faq' ? '자주 묻는 질문 (FAQ)' : p.tab === 'qna' ? 'Q&A 게시판' : '1:1 문의';
    qs('cs-view-kicker').textContent = label;
    qs('cs-view-back').href = '/app/support/cs.html?tab=' + encodeURIComponent(p.tab);
    qs('cs-view-write').style.display = p.tab === '1on1' ? 'inline-flex' : 'none';
    if (!item) { qs('cs-view-title').textContent = '항목을 찾을 수 없습니다'; qs('cs-view-desc').textContent = '잘못된 경로이거나 저장되지 않은 데이터입니다.'; return; }
    qs('cs-view-title').textContent = item.title;
    qs('cs-view-desc').textContent = p.tab === 'faq' ? 'FAQ 상세 내용입니다.' : p.tab === 'qna' ? 'Q&A 게시글 상세입니다.' : (item.status === 'done' ? '답변완료 상태의 1:1 문의입니다.' : '답변대기 상태의 1:1 문의입니다.');
    var meta = [];
    if (item.category) meta.push('<span><strong>분류</strong> ' + esc(item.category) + '</span>');
    if (item.author) meta.push('<span><strong>작성자</strong> ' + esc(item.author) + '</span>');
    if (item.date) meta.push('<span><strong>작성일</strong> ' + esc(item.date) + '</span>');
    if (item.status) meta.push('<span><strong>상태</strong> ' + (item.status === 'done' ? '답변완료' : '답변대기') + '</span>');
    qs('cs-view-meta').innerHTML = meta.join('');
    qs('cs-view-content').innerHTML = item.content || '<p>본문이 없습니다.</p>';
  });
})();
