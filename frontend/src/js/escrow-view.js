(function () {
  'use strict';

  function qs(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return window.SherpaCore && typeof SherpaCore.escapeHTML === 'function'
      ? SherpaCore.escapeHTML(value)
      : String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  }

  function num(value) {
    return window.SherpaCore && typeof SherpaCore.formatNumber === 'function'
      ? SherpaCore.formatNumber(value)
      : Number(value || 0).toLocaleString('ko-KR');
  }

  function getMissionId() {
    var url = new URL(window.location.href);
    return Number(url.searchParams.get('id') || 0);
  }

  function statusLabel(status) {
    if (status === 'in_progress') return '진행중';
    if (status === 'completed') return '완료';
    if (status === 'cancelled') return '취소';
    if (status === 'expired') return '만료';
    return '모집중';
  }

  function renderApplications(applications) {
    var mount = qs('mission-application-list');
    if (!applications || !applications.length) {
      mount.innerHTML = '<div class="board-empty"><div class="board-empty-title">아직 참여자가 없습니다</div><div class="board-empty-desc">첫 번째 리뷰어가 지원하면 이곳에 상태가 표시됩니다.</div></div>';
      return;
    }

    var html = '<div class="board-comment-thread">';
    applications.forEach(function (app) {
      html += '<div class="board-comment-item">';
      html += '<div class="board-comment-head">';
      html += '<div class="board-comment-author">' + esc(app.applicant_name || '지원자') + '</div>';
      html += '<div class="board-comment-date">' + esc(app.created_at ? String(app.created_at).slice(0, 16).replace('T', ' ') : '-') + '</div>';
      html += '</div>';
      html += '<div class="board-comment-body">';
      html += '상태: ' + esc(app.status || 'pending');
      if (app.submission_note) html += '<br />메모: ' + esc(app.submission_note);
      if (app.submission_url) html += '<br />제출 링크: <a href="' + esc(app.submission_url) + '" target="_blank" rel="noopener noreferrer">' + esc(app.submission_url) + '</a>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    mount.innerHTML = html;
  }

  async function fetchMission() {
    var missionId = getMissionId();
    if (!missionId) {
      qs('mission-view-title').textContent = '잘못된 접근입니다';
      qs('mission-view-desc').textContent = '미션 ID가 없습니다.';
      return;
    }

    try {
      var res = await SherpaAPI.escrow.detail(missionId);
      var mission = res.mission || null;
      var applications = res.applications || [];
      if (!mission) {
        qs('mission-view-title').textContent = '미션을 찾을 수 없습니다';
        qs('mission-view-desc').textContent = '잘못된 경로이거나 존재하지 않는 미션입니다.';
        return;
      }

      qs('mission-view-kicker').textContent = mission.mission_type || '모집 및 의뢰';
      qs('mission-view-title').textContent = mission.title || '제목 없음';
      qs('mission-view-desc').textContent = mission.place_name || mission.category || '모집 및 의뢰 상세 정보';

      qs('mission-view-meta').innerHTML = [
        '<span><strong>등록자</strong> ' + esc(mission.requester_name || '-') + '</span>',
        '<span><strong>상태</strong> ' + esc(statusLabel(mission.status)) + '</span>',
        '<span><strong>보상</strong> ' + num(mission.reward_per_person || 0) + ' 눈덩이</span>',
        '<span><strong>최대 인원</strong> ' + num(mission.max_applicants || 1) + '명</span>',
        '<span><strong>수수료</strong> ' + num(mission.platform_fee || 0) + ' 눈덩이</span>'
      ].join('');

      qs('mission-view-notice').innerHTML = '총 예치금 <strong>' + num(mission.total_deposit || 0) + ' 눈덩이</strong> · 플랫폼 수수료 <strong>' + num(mission.platform_fee || 0) + ' 눈덩이</strong>';
      qs('mission-view-content').innerHTML = '<p>' + esc(mission.description || '상세 설명이 없습니다.').replace(/\n/g, '</p><p>') + '</p>';

      renderApplications(applications);

      var applyBtn = qs('mission-view-apply-btn');
      applyBtn.disabled = mission.status !== 'open';
      applyBtn.textContent = mission.status === 'open' ? '지원하기' : '지원 불가';
      applyBtn.onclick = async function () {
        try {
          await SherpaAPI.escrow.apply(mission.id);
          alert('지원이 완료되었습니다.');
          fetchMission();
        } catch (err) {
          alert(SherpaAPI.errorMessage(err));
        }
      };
    } catch (err) {
      qs('mission-view-title').textContent = '미션을 불러오지 못했습니다';
      qs('mission-view-desc').textContent = SherpaAPI.errorMessage(err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.body.dataset.page || document.body.dataset.page !== 'missions-view') return;
    fetchMission();
  });
})();
