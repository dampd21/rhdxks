/**
 * SHERPAIN21 - Place Rank Page Logic (restored-compatible)
 * 순위 조회 + 추적 관리 + 요금제 정책 + 차트/스냅샷 UI
 */
(function () {
  'use strict';

  var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  var KIND_LABELS = {
    restaurant: '음식점',
    hairshop: '미용실',
    nailshop: '네일샵',
    hospital: '병원',
    accommodation: '숙박'
  };

  var SEARCH_LOG_KEY = 'sherpa_place_search_log';
  var WORKSPACE = 'default';
  var MAX_RESULTS = 300;
  var PAGE_SIZE = 50;

  var lastSearchData = null;
  var rankTrendChart = null;
  var allResults = [];
  var searchTotal = 0;
  var searchKeyword = '';
  var searchPlaceId = '';
  var isLoadingMore = false;
  var retryTimer = null;

  var $keyword;
  var $placeId;
  var $store;
  var $kind;
  var $x;
  var $y;
  var $device;
  var userPlan = 'a';
  var planCfg;

  var PLAN_CONFIG = {
    a: { searchLimit: 5, searchWindow: 3600000, trackSlots: 1, canBuySlot: false, snapshotBlur: true, label: 'BASIC' },
    b: { searchLimit: 999999, searchWindow: 0, trackSlots: 3, canBuySlot: true, snapshotBlur: false, label: 'STANDARD' },
    c: { searchLimit: 999999, searchWindow: 0, trackSlots: 10, canBuySlot: true, snapshotBlur: false, label: 'PRO' },
    basic: { searchLimit: 5, searchWindow: 3600000, trackSlots: 1, canBuySlot: false, snapshotBlur: true, label: 'BASIC' },
    standard: { searchLimit: 999999, searchWindow: 0, trackSlots: 3, canBuySlot: true, snapshotBlur: false, label: 'STANDARD' },
    pro: { searchLimit: 999999, searchWindow: 0, trackSlots: 10, canBuySlot: true, snapshotBlur: false, label: 'PRO' }
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function show(id) {
    var el = qs(id);
    if (el) el.style.display = '';
  }

  function hide(id) {
    var el = qs(id);
    if (el) el.style.display = 'none';
  }

  function esc(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function comma(n) {
    if (n == null || n === '') return '-';
    return Number(n).toLocaleString('ko-KR');
  }

  function fmtDateLabel(ds) {
    var d = new Date(ds + 'T00:00:00+09:00');
    return String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' ' + dayNames[d.getDay()];
  }

  function fmtRankDelta(n) {
    if (n == null) return '';
    if (n === 0) return '<span class="snap-delta snap-flat">-</span>';
    if (n > 0) return '<span class="snap-delta snap-up">+' + n + '</span>';
    return '<span class="snap-delta snap-down">' + n + '</span>';
  }

  function fmtMetricDelta(n) {
    if (n == null || n === 0) return '';
    if (n > 0) return '<span class="snap-delta snap-up">+' + comma(n) + '</span>';
    return '<span class="snap-delta snap-down">' + comma(n) + '</span>';
  }

  function rankBadge(r) {
    if (r === 1) return 'r1';
    if (r <= 3) return 'r2';
    if (r <= 5) return 'r3';
    return 'r4';
  }

  function getUserPlan() {
    try {
      if (window.SherpaAuth && typeof window.SherpaAuth.getPlan === 'function') {
        return window.SherpaAuth.getPlan() || 'a';
      }
      if (window.SherpaCore && typeof window.SherpaCore.getUser === 'function') {
        return window.SherpaCore.getUser().plan || 'a';
      }
      var raw = localStorage.getItem('sherpa_user');
      if (raw) {
        return JSON.parse(raw).plan || 'a';
      }
    } catch (e) {}
    return 'a';
  }

  function apiErrorMessage(err) {
    if (window.SherpaAPI && typeof window.SherpaAPI.errorMessage === 'function') {
      return window.SherpaAPI.errorMessage(err);
    }
    if (err && err.data && (err.data.error || err.data.message)) return err.data.error || err.data.message;
    if (err && err.message) return err.message;
    return '요청 처리 중 오류가 발생했습니다.';
  }

  function getSearchCount() {
    try {
      var log = JSON.parse(localStorage.getItem(SEARCH_LOG_KEY) || '[]');
      var cutoff = Date.now() - planCfg.searchWindow;
      log = log.filter(function (t) { return t > cutoff; });
      localStorage.setItem(SEARCH_LOG_KEY, JSON.stringify(log));
      return log.length;
    } catch (e) {
      return 0;
    }
  }

  function recordSearch() {
    try {
      var log = JSON.parse(localStorage.getItem(SEARCH_LOG_KEY) || '[]');
      log.push(Date.now());
      var cutoff = Date.now() - planCfg.searchWindow;
      log = log.filter(function (t) { return t > cutoff; });
      localStorage.setItem(SEARCH_LOG_KEY, JSON.stringify(log));
    } catch (e) {}
  }

  function checkSearchLimit() {
    if (planCfg.searchLimit >= 999999) return true;
    var count = getSearchCount();
    if (count >= planCfg.searchLimit) {
      show('rate-limit-notice');
      qs('rate-limit-msg').textContent = planCfg.label + ' 플랜은 1시간당 ' + planCfg.searchLimit + '회 조회 가능합니다. (현재 ' + count + '/' + planCfg.searchLimit + '회 사용)';
      return false;
    }
    return true;
  }

  function updateRateLimitNotice() {
    if (planCfg.searchLimit >= 999999) return;
    var cnt = getSearchCount();
    if (cnt > 0) {
      show('rate-limit-notice');
      qs('rate-limit-msg').textContent = planCfg.label + ' 플랜: 1시간당 ' + planCfg.searchLimit + '회 조회 가능 (' + cnt + '/' + planCfg.searchLimit + '회 사용)';
    }
  }

  function showError(msg, canRetry) {
    hide('search-loading');
    var msgEl = qs('search-error-msg');
    var retryBtn = qs('btn-retry-now');

    if (!msgEl || !retryBtn) return;

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    if (canRetry) {
      var countdown = 30;
      msgEl.innerHTML = esc(msg) + '<br><br><span id="retry-countdown">네이버 API 제한으로 잠시 대기 중... <strong>' + countdown + '초</strong> 후 자동 재시도</span>';
      retryBtn.style.display = 'inline-flex';
      retryTimer = setInterval(function () {
        countdown -= 1;
        var cdEl = qs('retry-countdown');
        if (cdEl) {
          cdEl.innerHTML = '네이버 API 제한으로 잠시 대기 중... <strong>' + countdown + '초</strong> 후 자동 재시도';
        }
        if (countdown <= 0) {
          clearInterval(retryTimer);
          retryTimer = null;
          hide('search-error');
          doSearch();
        }
      }, 1000);
    } else {
      msgEl.textContent = msg;
      retryBtn.style.display = 'none';
    }

    show('search-error');
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.page-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        var target = tab.dataset.tab;
        qs('tab-search').style.display = target === 'search' ? 'block' : 'none';
        qs('tab-tracking').style.display = target === 'tracking' ? 'block' : 'none';
        if (target === 'tracking') loadTracks();
      });
    });
  }

  function bindAdvancedToggle() {
    qs('btn-advanced').addEventListener('click', function () {
      var area = qs('advanced-area');
      var open = area.classList.toggle('is-open');
      this.textContent = open ? '상세 옵션 접기' : '상세 옵션 펼치기';
    });
  }

  function doGeocode() {
    var addr = qs('s-addr').value.trim();
    if (!addr) {
      alert('주소를 입력하세요.');
      return;
    }

    var btn = qs('btn-geocode');
    btn.disabled = true;
    btn.textContent = '검색 중...';

    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(addr) + '&limit=1', {
      headers: { 'Accept-Language': 'ko' }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.length) {
          alert('주소를 찾을 수 없습니다.');
          return;
        }
        qs('s-x').value = data[0].lon;
        qs('s-y').value = data[0].lat;
        alert('좌표 설정 완료: ' + data[0].display_name);
      })
      .catch(function () {
        alert('주소 검색 실패');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = '검색';
      });
  }

  function initDomRefs() {
    $keyword = qs('s-keyword');
    $placeId = qs('s-place-id');
    $store = qs('s-store');
    $kind = qs('s-kind');
    $x = qs('s-x');
    $y = qs('s-y');
    $device = qs('s-device');
  }

  function doSearch() {
    var keyword = $keyword.value.trim();
    var placeId = $placeId.value.trim();

    if (!keyword) {
      alert('검색 키워드를 입력하세요.');
      $keyword.focus();
      return;
    }

    if (!placeId) {
      alert('Place ID를 입력하세요.');
      $placeId.focus();
      return;
    }

    if (!window.SherpaAPI || !SherpaAPI.rank || !SherpaAPI.rank.place) {
      showError('SherpaAPI.rank.place 가 연결되지 않았습니다.', false);
      return;
    }

    if (!checkSearchLimit()) return;

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    allResults = [];
    searchTotal = 0;
    searchKeyword = keyword;
    searchPlaceId = placeId;

    show('search-loading');
    hide('search-empty');
    hide('search-result');
    hide('search-error');
    hide('r-loadmore-wrap');

    recordSearch();
    fetchPage(1, PAGE_SIZE, true);
  }

  function loadMore() {
    if (isLoadingMore) return;
    if (allResults.length >= MAX_RESULTS || allResults.length >= searchTotal) return;

    var nextStart = allResults.length + 1;
    var remaining = Math.min(PAGE_SIZE, MAX_RESULTS - allResults.length);
    isLoadingMore = true;

    var btn = qs('btn-loadmore');
    btn.disabled = true;
    btn.textContent = '로딩 중...';

    fetchPage(nextStart, remaining, false);
  }

  function fetchPage(start, display, isFirstPage) {
    SherpaAPI.rank.place({
      keyword: searchKeyword,
      kind: $kind.value,
      x: $x.value,
      y: $y.value,
      deviceType: $device.value,
      display: display,
      start: start
    }).then(function (data) {
      if (isFirstPage) {
        hide('search-loading');
        lastSearchData = data;
        lastSearchData._placeId = searchPlaceId;
        lastSearchData._storeName = $store.value.trim();
        searchTotal = data.total || 0;
        allResults = data.results || [];
      } else {
        var newResults = data.results || [];
        var existingIds = {};
        allResults.forEach(function (item) {
          existingIds[String(item.id)] = true;
        });
        newResults.forEach(function (item) {
          if (!existingIds[String(item.id)]) allResults.push(item);
        });
        lastSearchData.results = allResults;
      }

      renderSearchResult(isFirstPage);
      updateLoadMoreButton();

      if (!isFirstPage) {
        isLoadingMore = false;
        var btn = qs('btn-loadmore');
        btn.disabled = false;
        btn.textContent = '더보기 (' + allResults.length + ' / ' + Math.min(searchTotal, MAX_RESULTS) + ')';
      }

      updateRateLimitNotice();
    }).catch(function (err) {
      var errMsg = apiErrorMessage(err);
      var is502 = err && (err.status === 502 || errMsg.indexOf('외부 API') !== -1 || errMsg.indexOf('응답을 받지') !== -1);

      if (isFirstPage) {
        hide('search-loading');
        if (is502) {
          showError('네이버 플레이스 API가 일시적으로 응답하지 않습니다.', true);
        } else {
          showError(errMsg, false);
        }
      } else {
        isLoadingMore = false;
        var btn = qs('btn-loadmore');
        btn.disabled = false;
        btn.textContent = '더보기 (오류 — 클릭하여 재시도)';
      }
    });
  }

  function updateLoadMoreButton() {
    var canLoad = allResults.length < Math.min(searchTotal, MAX_RESULTS) && allResults.length > 0;
    qs('r-loadmore-wrap').style.display = canLoad ? '' : 'none';
    if (canLoad) {
      qs('btn-loadmore').textContent = '더보기 (' + allResults.length + ' / ' + Math.min(searchTotal, MAX_RESULTS) + ')';
    }
  }

  function createRankNum(rank) {
    return '<span class="rank-num ' + rankBadge(rank) + '">' + rank + '</span>';
  }

  function renderTargetInfo(targetItem, targetRank) {
    var html = '';
    html += '<div class="target-info">';
    html += '  <div class="target-thumb">';
    if (targetItem && targetItem.imageUrl) {
      html += '<img src="' + esc(targetItem.imageUrl) + '" alt="썸네일" />';
    } else {
      html += '<span>◎</span>';
    }
    html += '  </div>';
    html += '  <div class="target-detail">';
    html += '    <div class="target-name">' + esc(targetItem.name || '-') + ' <span class="rank-target-label">' + targetRank + '위</span></div>';
    html += '    <div class="target-cat">' + esc(targetItem.category || targetItem.businessCategory || '') + (targetItem.roadAddress ? ' | ' + esc(targetItem.roadAddress) : '') + '</div>';
    html += '    <div class="target-stats">';
    html += '      <div class="target-stat"><b>블로그</b> ' + comma(targetItem.blogCafeReviewCount) + '</div>';
    html += '      <div class="target-stat"><b>방문자</b> ' + comma(targetItem.visitorReviewCount) + '</div>';
    html += '      <div class="target-stat"><b>저장</b> ' + comma(targetItem.saveCount) + '</div>';
    html += '      <div class="target-stat"><b>평점</b> ' + esc(targetItem.visitorReviewScore || '-') + '</div>';
    html += '      <div class="target-stat"><b>사진</b> ' + comma(targetItem.imageCount) + '</div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderSearchResult(isFirstPage) {
    var results = allResults;
    var placeId = searchPlaceId;
    var storeName = $store.value.trim();

    if (isFirstPage) {
      var targetItem = null;
      var targetRank = null;

      for (var i = 0; i < results.length; i += 1) {
        if (String(results[i].id) === String(placeId)) {
          targetItem = results[i];
          targetRank = i + 1;
          break;
        }
      }

      if (targetRank) {
        qs('r-rank').textContent = targetRank + '위';
        qs('r-rank-sub').textContent = '전체 ' + (searchTotal || results.length) + '개 중';
        qs('r-rank-sub').style.color = 'var(--color-success)';
      } else {
        qs('r-rank').textContent = '미발견';
        qs('r-rank-sub').textContent = '상위 ' + results.length + '위 안에 없음';
        qs('r-rank-sub').style.color = 'var(--color-danger)';
      }

      qs('r-total').textContent = (searchTotal || results.length).toLocaleString('ko-KR');
      qs('r-kw').textContent = searchKeyword + ' (' + (KIND_LABELS[$kind.value] || $kind.value) + ')';
      qs('r-time').textContent = lastSearchData.checkedAt || '-';

      var targetBody = qs('r-target-body');
      if (targetItem) {
        qs('r-target-card').style.display = '';
        targetBody.innerHTML = renderTargetInfo(targetItem, targetRank) + '<div class="page-note">PID: <strong>' + esc(placeId) + '</strong></div>';
      } else {
        qs('r-target-card').style.display = '';
        targetBody.innerHTML = '<div class="page-note">Place ID <strong>' + esc(placeId) + '</strong> 에 해당하는 업체가 상위 ' + results.length + '위 안에 없습니다.</div>';
      }

      qs('r-result-body').innerHTML = '';
    }

    var tbody = qs('r-result-body');
    var startIdx = isFirstPage ? 0 : tbody.children.length;
    qs('r-count').textContent = results.length + '개' + (searchTotal > results.length ? ' / 전체 ' + searchTotal + '개' : '');

    for (var idx = startIdx; idx < results.length; idx += 1) {
      var item = results[idx];
      var isTarget = String(item.id) === String(placeId);
      var isStoreName = storeName && item.name && item.name.indexOf(storeName) !== -1;
      var tr = document.createElement('tr');
      if (isTarget) tr.className = 'rank-highlight';

      var nameLabel = '';
      if (isTarget) nameLabel = '<span class="rank-target-label">조회 대상</span>';
      else if (isStoreName) nameLabel = '<span class="rank-store-label">매장명 일치</span>';

      tr.innerHTML = '' +
        '<td>' + createRankNum(idx + 1) + '</td>' +
        '<td>' + esc(item.name || '-') + ' ' + nameLabel + '<div style="font-size:10px; color:var(--color-gray-400); margin-top:2px;">' + esc(item.id || '-') + '</div></td>' +
        '<td>' + esc(item.category || item.businessCategory || '-') + '</td>' +
        '<td>' + comma(item.blogCafeReviewCount) + '</td>' +
        '<td>' + comma(item.visitorReviewCount) + '</td>' +
        '<td>' + esc(item.visitorReviewScore || '-') + '</td>' +
        '<td>' + comma(item.saveCount) + '</td>' +
        '<td>' + comma(item.imageCount) + '</td>';
      tbody.appendChild(tr);
    }

    show('search-result');

    if (!isFirstPage) {
      var newTargetRank = null;
      for (var k = 0; k < results.length; k += 1) {
        if (String(results[k].id) === String(placeId)) {
          newTargetRank = k + 1;
          break;
        }
      }
      if (newTargetRank && qs('r-rank').textContent === '미발견') {
        qs('r-rank').textContent = newTargetRank + '위';
        qs('r-rank-sub').textContent = '전체 ' + searchTotal + '개 중';
        qs('r-rank-sub').style.color = 'var(--color-success)';
      }
    }
  }

  function registerTrack() {
    if (!lastSearchData) return;
    var placeId = lastSearchData._placeId;
    if (!placeId) {
      alert('Place ID가 없습니다.');
      return;
    }

    if (!window.SherpaAPI || !SherpaAPI.rank || !SherpaAPI.rank.trackCreate) {
      alert('추적 등록 API가 연결되지 않았습니다.');
      return;
    }

    var btn = qs('btn-track-register');
    btn.disabled = true;
    btn.textContent = '등록 + 수집 중...';

    var targetName = '';
    if (lastSearchData.results) {
      for (var i = 0; i < lastSearchData.results.length; i += 1) {
        if (String(lastSearchData.results[i].id) === String(placeId)) {
          targetName = lastSearchData.results[i].name;
          break;
        }
      }
    }
    if (!targetName) targetName = lastSearchData._storeName || '';

    SherpaAPI.rank.trackCreate({
      workspaceId: WORKSPACE,
      kind: $kind.value,
      keyword: lastSearchData.keyword || searchKeyword,
      targetPlaceId: placeId,
      targetName: targetName,
      x: $x.value,
      y: $y.value,
      deviceType: $device.value
    }).then(function (res) {
      if (!SherpaAPI.rank.collect) return { id: res.id, collected: null };
      return SherpaAPI.rank.collect(WORKSPACE, res.id).then(function (cr) {
        return { id: res.id, collected: cr.collected || cr };
      });
    }).then(function (result) {
      btn.disabled = false;
      btn.textContent = '추적 등록 + 즉시 수집';
      var c = result.collected;
      if (c) {
        alert('추적 등록 완료! 순위: ' + (c.targetRank ? c.targetRank + '위' : 'Top50 밖'));
      } else {
        alert('추적 등록 완료!');
      }

      document.querySelectorAll('.page-tab').forEach(function (t) { t.classList.remove('is-active'); });
      document.querySelector('[data-tab="tracking"]').classList.add('is-active');
      qs('tab-search').style.display = 'none';
      qs('tab-tracking').style.display = 'block';
      loadTracks();
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = '추적 등록 + 즉시 수집';
      alert('등록/수집 실패: ' + apiErrorMessage(err));
    });
  }

  function updateSlotInfo(trackCount) {
    var maxSlots = planCfg.trackSlots;
    qs('slot-used').textContent = trackCount;
    qs('slot-max').textContent = maxSlots;
    qs('slot-remain-text').textContent = '슬롯 ' + trackCount + '/' + maxSlots + ' 사용 중';

    if (planCfg.canBuySlot && trackCount >= maxSlots) {
      qs('btn-buy-slot').style.display = '';
    } else {
      qs('btn-buy-slot').style.display = 'none';
    }

    var regBtn = qs('btn-track-register');
    if (regBtn && trackCount >= maxSlots) {
      regBtn.disabled = true;
      regBtn.title = '추적 슬롯이 부족합니다. (' + planCfg.label + ': 최대 ' + maxSlots + '개)';
    } else if (regBtn) {
      regBtn.disabled = false;
      regBtn.title = '';
    }
  }

  function loadTracks() {
    var list = qs('track-list');
    list.innerHTML = '<div class="loading-spinner">불러오는 중...</div>';
    hide('track-empty');
    hide('snapshot-area');
    hide('rank-chart-area');

    if (!window.SherpaAPI || !SherpaAPI.rank || !SherpaAPI.rank.tracks) {
      list.innerHTML = '<div class="error-box">SherpaAPI.rank.tracks 가 연결되지 않았습니다.</div>';
      return;
    }

    SherpaAPI.rank.tracks(WORKSPACE).then(function (res) {
      var tracks = (res && res.tracks) || [];
      updateSlotInfo(tracks.length);
      if (tracks.length === 0) {
        list.innerHTML = '';
        show('track-empty');
        return;
      }

      list.innerHTML = '';
      var chain = Promise.resolve();
      tracks.forEach(function (tr) {
        chain = chain.then(function () {
          return renderTrackItem(tr, list);
        });
      });
    }).catch(function (err) {
      list.innerHTML = '<div class="error-box">' + esc(apiErrorMessage(err)) + '</div>';
    });
  }

  function renderTrackItem(track, container) {
    var kindLabel = KIND_LABELS[track.kind] || track.kind;
    var item = document.createElement('div');
    item.className = 'track-item';
    item.innerHTML = '' +
      '<div class="track-header">' +
      '  <div>' +
      '    <div class="track-keyword">[' + esc(kindLabel) + '] ' + esc(track.keyword) + '</div>' +
      '    <div class="track-meta">PID: ' + esc(track.target_place_id || track.targetPlaceId || '-') + (track.target_name ? ' | ' + esc(track.target_name) : '') + ' | 최근 30일</div>' +
      '  </div>' +
      '  <div class="track-actions">' +
      '    <button class="track-btn btn-collect" type="button">수집</button>' +
      '    <button class="track-btn track-btn-danger btn-delete" type="button">삭제</button>' +
      '  </div>' +
      '</div>' +
      '<div class="mini-mount"></div>';
    container.appendChild(item);

    var collectBtn = item.querySelector('.btn-collect');
    var deleteBtn = item.querySelector('.btn-delete');
    var mount = item.querySelector('.mini-mount');

    collectBtn.addEventListener('click', function () {
      if (!SherpaAPI.rank.collect) {
        alert('즉시 수집 기능이 연결되지 않았습니다.');
        return;
      }
      collectBtn.disabled = true;
      collectBtn.textContent = '수집 중...';
      SherpaAPI.rank.collect(WORKSPACE, track.id).then(function (res) {
        var c = res.collected || res;
        alert(c.skipped ? '오늘 이미 수집됨 (' + c.baseDate + ')' : '수집 완료! 순위: ' + (c.targetRank ? c.targetRank + '위' : '미발견'));
        loadTracks();
      }).catch(function (err) {
        alert('수집 실패: ' + apiErrorMessage(err));
        collectBtn.disabled = false;
        collectBtn.textContent = '수집';
      });
    });

    deleteBtn.addEventListener('click', function () {
      if (!SherpaAPI.rank.trackDelete) {
        alert('삭제 기능이 연결되지 않았습니다.');
        return;
      }
      if (!confirm('이 추적을 삭제하시겠습니까?')) return;
      SherpaAPI.rank.trackDelete(WORKSPACE, track.id).then(loadTracks).catch(function (err) {
        alert('삭제 실패: ' + apiErrorMessage(err));
      });
    });

    if (!SherpaAPI.rank.timeline) {
      mount.innerHTML = '<div class="empty-box">타임라인 기능이 연결되지 않았습니다.</div>';
      return Promise.resolve();
    }

    return SherpaAPI.rank.timeline(WORKSPACE, track.id, 30).then(function (res) {
      var tl = (res && res.timeline) || [];
      if (tl.length === 0) {
        mount.innerHTML = '<div class="empty-box">수집된 데이터가 없습니다.</div>';
        return;
      }
      renderMiniTimeline(track, tl, mount);
      renderRankChart(track, tl);
    }).catch(function () {
      mount.innerHTML = '<div class="empty-box">타임라인 로드 실패</div>';
    });
  }

  function renderMiniTimeline(track, timeline, container) {
    var wrap = document.createElement('div');
    wrap.className = 'mini-wrap';

    var grid = document.createElement('div');
    grid.className = 'mini-grid';

    timeline.forEach(function (row) {
      var cell = document.createElement('div');
      cell.className = 'mini-cell';
      cell.dataset.date = row.date;

      var rankText = row.targetRank == null ? 'OUT' : String(row.targetRank);
      var rankClass = row.targetRank == null ? 'mini-rank mini-out' : 'mini-rank';

      cell.innerHTML = '' +
        '<div class="mini-date">' + fmtDateLabel(row.date) + '</div>' +
        '<div class="' + rankClass + '">' + rankText + '</div>' +
        '<div>' + fmtRankDelta(row.rankDelta) + '</div>' +
        '<div class="mini-metric">블 ' + (row.blogCount == null ? '-' : comma(row.blogCount)) + '<br>방 ' + (row.visitorCount == null ? '-' : comma(row.visitorCount)) + '</div>';

      cell.addEventListener('click', function () {
        grid.querySelectorAll('.mini-cell').forEach(function (node) {
          node.classList.remove('active');
        });
        cell.classList.add('active');
        loadSnapshot(track.id, row.date, track.target_place_id || track.targetPlaceId, track.target_name || track.targetName);
      });

      grid.appendChild(cell);
    });

    wrap.appendChild(grid);
    container.appendChild(wrap);

    var first = grid.querySelector('.mini-cell');
    if (first) first.click();
  }

  function renderRankChart(track, timeline) {
    show('rank-chart-area');
    qs('rank-chart-title').textContent = track.keyword + (track.target_name ? ' - ' + track.target_name : '');

    var reversed = timeline.slice().reverse();
    var maxRank = 1;
    reversed.forEach(function (t) {
      if (t.targetRank != null && t.targetRank > maxRank) maxRank = t.targetRank;
    });
    var yMax = maxRank <= 10 ? 10 : maxRank <= 20 ? 20 : maxRank <= 30 ? 30 : 50;

    if (rankTrendChart) rankTrendChart.destroy();
    if (typeof Chart === 'undefined') return;

    rankTrendChart = new Chart(qs('chart-rank-trend'), {
      type: 'line',
      data: {
        labels: reversed.map(function (t) { return t.date.slice(5); }),
        datasets: [{
          label: '순위',
          data: reversed.map(function (t) { return t.targetRank; }),
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37,99,235,0.06)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#2563EB',
          borderWidth: 2,
          spanGaps: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            reverse: true,
            min: 1,
            max: yMax,
            ticks: {
              stepSize: yMax <= 10 ? 1 : yMax <= 20 ? 2 : 5,
              font: { size: 10 },
              callback: function (v) {
                return Number.isInteger(v) ? v + '위' : '';
              }
            },
            grid: { color: 'rgba(0,0,0,0.04)' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 } }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  function loadSnapshot(trackId, date, targetPlaceId, targetName) {
    show('snapshot-area');
    qs('snap-title').textContent = '스냅샷: ' + date;
    qs('snap-sub').textContent = '로딩중...';
    qs('snap-body').innerHTML = '';
    qs('snap-target-note').style.display = 'none';
    qs('snap-blur-notice').style.display = 'none';

    if (!SherpaAPI.rank.snapshot) {
      qs('snap-sub').textContent = '스냅샷 기능이 연결되지 않았습니다.';
      return;
    }

    SherpaAPI.rank.snapshot(WORKSPACE, trackId, date).then(function (data) {
      if (!data.snapshot) {
        qs('snap-sub').textContent = '해당 날짜 데이터가 없습니다.';
        return;
      }

      var snap = data.snapshot;
      var items = data.items || [];
      qs('snap-sub').textContent = '대상 순위: ' + (snap.target_rank == null ? 'Top50 밖' : snap.target_rank + '위') + ' | 전일: ' + (data.prevDate || '-') + ' | 업체 수: ' + items.length;

      var snapTable = qs('snap-table');
      if (planCfg.snapshotBlur) {
        qs('snap-blur-notice').style.display = '';
        snapTable.className = 'rank-table snapshot-blur';
      } else {
        snapTable.className = 'rank-table';
      }

      var targetFound = false;
      var body = qs('snap-body');
      body.innerHTML = '';

      items.forEach(function (it) {
        if (it.isTarget) targetFound = true;
        var tr = document.createElement('tr');
        if (it.isTarget) tr.className = 'rank-highlight';
        tr.innerHTML = '' +
          '<td>' + createRankNum(it.rank) + ' ' + fmtRankDelta(it.delta ? it.delta.rankDelta : null) + '</td>' +
          '<td>' + esc(it.name || '-') + (it.isTarget ? ' <span class="snap-pill">대상</span>' : '') + '</td>' +
          '<td>' + esc(it.category || it.businessCategory || '-') + '</td>' +
          '<td>' + comma(it.blog_count || 0) + ' ' + fmtMetricDelta(it.delta ? it.delta.blogDelta : null) + '</td>' +
          '<td>' + comma(it.visitor_count || 0) + ' ' + fmtMetricDelta(it.delta ? it.delta.visitorDelta : null) + '</td>' +
          '<td>' + esc(it.score || '-') + '</td>' +
          '<td>' + comma(it.save_count || 0) + ' ' + fmtMetricDelta(it.delta ? it.delta.saveDelta : null) + '</td>' +
          '<td>' + comma(it.image_count || 0) + ' ' + fmtMetricDelta(it.delta ? it.delta.imgDelta : null) + '</td>';
        body.appendChild(tr);
      });

      var note = qs('snap-target-note');
      if (!targetFound && targetPlaceId) {
        note.style.display = '';
        note.innerHTML = '대상 업체 (PID: ' + esc(targetPlaceId) + (targetName ? ' / ' + esc(targetName) : '') + ')가 이 날짜 Top50에 포함되지 않았습니다.';
      }
    }).catch(function (err) {
      qs('snap-sub').textContent = '로드 실패: ' + apiErrorMessage(err);
    });
  }

  function bindEvents() {
    bindTabs();
    bindAdvancedToggle();

    qs('btn-geocode').addEventListener('click', doGeocode);
    qs('s-addr').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doGeocode();
    });

    qs('btn-search').addEventListener('click', doSearch);
    qs('btn-loadmore').addEventListener('click', loadMore);
    qs('btn-track-register').addEventListener('click', registerTrack);
    qs('btn-refresh-tracks').addEventListener('click', loadTracks);
    qs('btn-retry-now').addEventListener('click', function () {
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
      hide('search-error');
      doSearch();
    });

    var buySlotBtn = qs('btn-buy-slot');
    if (buySlotBtn) {
      buySlotBtn.addEventListener('click', function () {
        if (!confirm('추적 슬롯 1개를 1,000 눈덩이로 구매하시겠습니까?')) return;
        alert('슬롯 구매 기능은 준비 중입니다.');
      });
    }

    $keyword.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });

    $placeId.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });

    var overlay = qs('sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', function () {
        if (window.SidebarModule) window.SidebarModule.closeSidebar();
      });
    }
  }

  function initHeaderDate() {
    var now = new Date();
    var dateEl = qs('header-date');
    if (!dateEl) return;
    dateEl.textContent = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' (' + dayNames[now.getDay()] + ')';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!qs('btn-search')) return;

    initHeaderDate();
    userPlan = getUserPlan();
    planCfg = PLAN_CONFIG[userPlan] || PLAN_CONFIG.a;
    initDomRefs();
    bindEvents();
    updateRateLimitNotice();
  });
})();
