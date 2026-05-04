/**
 * SHERPAIN21 - place-seo.js
 * 플레이스 SEO 분석 + 추적 관리 통합 페이지
 *
 * [탭 구조]
 *  - SEO 분석: 키워드 입력 → 상위 업체 SEO 점수 + 리뷰 분석
 *               Place ID 입력 시 → 내 매장 요약 카드 + 테이블 하이라이트 + 추적 등록 버튼
 *  - 추적 관리: SEO 전용 추적 목록 (rank.html과 workspaceId 분리)
 *
 * [추적 분리]
 *  - rank.html   workspaceId = 'default'   → 순위 추적
 *  - seo.html    workspaceId = 'seo'        → SEO 전용 추적 (이 파일)
 *
 * [플랜 제한] — rank.html과 동일
 *  - Basic(a)    : 1시간 5회 분석, 추적 슬롯 1개, 스냅샷 blur
 *  - Standard(b) : 무제한, 슬롯 3개, 스냅샷 오픈, 슬롯 추가 가능
 *  - Pro(c)      : 무제한, 슬롯 10개, 슬롯 추가 가능
 *
 * 의존: config.js, auth.js, api.js
 */
(function () {
  'use strict';

  /* ── 날짜 헤더 ─────────────────────────────────────────────── */
  var _dayNames = ['일','월','화','수','목','금','토'];
  (function () {
    var el = document.getElementById('seo-header-date');
    if (!el) return;
    var now = new Date();
    el.textContent = now.getFullYear() + '년 ' + (now.getMonth()+1) + '월 ' + now.getDate() + '일 (' + _dayNames[now.getDay()] + ')';
  })();

  /* ── 핵심 상수 ─────────────────────────────────────────────── */
  // ▶ rank.html은 'default', seo.html은 'seo' → 추적 목록 완전 분리
  var WORKSPACE  = 'seo';
  var SEARCH_X   = '126.9783882';
  var SEARCH_Y   = '37.5666103';
  var SEARCH_LOG_KEY = 'sherpa_seo_search_log';

  /* ── 플랜 설정 ─────────────────────────────────────────────── */
  var PLAN_CONFIG = {
    a:        { searchLimit: 5, searchWindow: 3600000, trackSlots: 1,  canBuySlot: false, snapshotBlur: true,  label: 'BASIC' },
    b:        { searchLimit: 999999, searchWindow: 0,  trackSlots: 3,  canBuySlot: true,  snapshotBlur: false, label: 'STANDARD' },
    c:        { searchLimit: 999999, searchWindow: 0,  trackSlots: 10, canBuySlot: true,  snapshotBlur: false, label: 'PRO' },
    basic:    { searchLimit: 5, searchWindow: 3600000, trackSlots: 1,  canBuySlot: false, snapshotBlur: true,  label: 'BASIC' },
    standard: { searchLimit: 999999, searchWindow: 0,  trackSlots: 3,  canBuySlot: true,  snapshotBlur: false, label: 'STANDARD' },
    pro:      { searchLimit: 999999, searchWindow: 0,  trackSlots: 10, canBuySlot: true,  snapshotBlur: false, label: 'PRO' }
  };
  var userPlan, planCfg;

  function getUserPlan() {
    try {
      if (window.SherpaAuth && typeof SherpaAuth.getPlan === 'function') return SherpaAuth.getPlan() || 'a';
      if (window.SherpaCore && typeof SherpaCore.getUser === 'function') return SherpaCore.getUser().plan || 'a';
      var raw = localStorage.getItem('sherpa_user');
      if (raw) return JSON.parse(raw).plan || 'a';
    } catch (e) {}
    return 'a';
  }

  function getSearchCount() {
    try {
      var log = JSON.parse(localStorage.getItem(SEARCH_LOG_KEY) || '[]');
      var cutoff = Date.now() - planCfg.searchWindow;
      log = log.filter(function (t) { return t > cutoff; });
      localStorage.setItem(SEARCH_LOG_KEY, JSON.stringify(log));
      return log.length;
    } catch (e) { return 0; }
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
    var cnt = getSearchCount();
    if (cnt >= planCfg.searchLimit) {
      var el  = document.getElementById('seo-rate-limit');
      var msg = document.getElementById('seo-rate-limit-msg');
      if (el && msg) {
        el.style.display = 'flex';
        msg.textContent  = planCfg.label + ' 플랜은 1시간당 ' + planCfg.searchLimit + '회 분석 가능합니다. (' + cnt + '/' + planCfg.searchLimit + '회 사용)';
      }
      return false;
    }
    return true;
  }

  /* ── 탭 전환 ───────────────────────────────────────────────── */
  document.querySelectorAll('[data-seotab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('[data-seotab]').forEach(function (t) { t.classList.remove('is-active'); });
      this.classList.add('is-active');
      var target = this.dataset.seotab;
      document.getElementById('seo-tab-analyze').style.display  = target === 'analyze'  ? '' : 'none';
      document.getElementById('seo-tab-tracking').style.display = target === 'tracking' ? '' : 'none';
      if (target === 'tracking') loadTracks();
    });
  });

  /* ── 유틸 ──────────────────────────────────────────────────── */
  function show(id) { var el = document.getElementById(id); if (el) el.style.display = ''; }
  function hide(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }
  function esc(s)   { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function comma(n) { if (n == null) return '-'; return String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
  function normText(s) { if (!s) return ''; return String(s).toLowerCase().replace(/[^0-9a-z가-힣\s]/g,' ').replace(/\s+/g,' ').trim(); }
  function tokenize(s) { var n=normText(s); return n ? n.split(' ').filter(Boolean) : []; }
  function unique(arr) { var seen={},out=[]; for(var i=0;i<arr.length;i++){var v=String(arr[i]||'').trim();if(v&&!seen[v]){seen[v]=true;out.push(v);}} return out; }
  function capLogNorm(v,cap) { v=Math.max(0,Number(v)||0); cap=Math.max(1,Number(cap)||1); return Math.min(1,Math.log1p(v)/Math.log1p(cap)); }
  function clamp01(v) { return Math.max(0,Math.min(1,Number(v)||0)); }
  function ymd(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function fmtRankDelta(n) { if(n==null)return''; if(n===0)return'<span style="color:#9ca3af;">-</span>'; if(n>0)return'<span style="color:#10b981;font-weight:700;">+'+n+'</span>'; return'<span style="color:#ef4444;font-weight:700;">'+n+'</span>'; }
  function fmtMetricDelta(n) { if(n==null||n===0)return''; if(n>0)return'<span style="color:#10b981;font-size:10px;"> +'+comma(n)+'</span>'; return'<span style="color:#ef4444;font-size:10px;"> '+comma(n)+'</span>'; }
  function apiMsg(err) { return window.SherpaAPI ? SherpaAPI.errorMessage(err) : (err && err.message || '오류가 발생했습니다.'); }

  function seoGrade(score) {
    var s = Number(score)||0;
    if (s >= 80) return { label:'매우강함', cls:'seo-excellent' };
    if (s >= 65) return { label:'강함',     cls:'seo-strong' };
    if (s >= 50) return { label:'보통이상',  cls:'seo-above' };
    if (s >= 35) return { label:'약한편',   cls:'seo-weak' };
    return { label:'개선필요', cls:'seo-poor' };
  }

  /* ── SEO 알고리즘 상수 ─────────────────────────────────────── */
  var INTENT_SYNONYMS = {
    '맛집':['맛집','맛있','맛있는','추천','강추','재방문','가성비','푸짐','친절','만족','분위기','신선','인생맛집'],
    '잘하는':['잘하는','잘하','인기','유명','핫플','소문난','줄서는','웨이팅','리뷰많'],
    '추천':['추천','강추','좋은','괜찮은','가볼만한','갈만한','모임','회식','데이트','혼밥'],
    '근처':['근처','주변','가까운','역근처','역앞','동네'],
    '시술':['시술','커트','펌','염색','클리닉','두피','젤네일','속눈썹','왁싱','피부관리'],
    '치료':['치료','진료','상담','검진','수술','교정','임플란트','스케일링','도수치료','물리치료'],
    '숙소':['숙소','숙박','호캉스','조식','뷰','오션뷰','풀빌라','스파','수영장','깨끗한']
  };
  var CATEGORY_HINTS = [
    '파인다이닝','브런치카페','브런치','이자카야','오마카세','고깃집','횟집','초밥','스시','샤브샤브','마라탕',
    '칼국수','국밥','해장국','감자탕','냉면','파스타','피자','스테이크','햄버거','버거','샌드위치',
    '한식','중식','일식','양식','분식','치킨','족발','보쌈','삼겹살','갈비','곱창',
    '카페','디저트','베이커리','술집','와인바','바','펍','식당',
    '미용실','헤어','네일','피부과','치과','정형외과','한의원','호텔','모텔','펜션','게스트하우스','리조트'
  ];
  var THEME_KO = {
    'taste':'맛','service':'서비스','mood':'분위기','quantity':'양','price':'가격',
    'kindness':'친절','cleanliness':'청결','interior':'인테리어','parking':'주차',
    'total':'총합','costEfficiency':'가성비','amount':'양','diversity':'다양성',
    'friendliness':'친절함','spaciousness':'넓음','coziness':'아늑함'
  };
  function themeKo(n) { return THEME_KO[n] || n; }

  function buildQueryContext(query) {
    var q=normText(query); var intentKeys=[];
    for(var k in INTENT_SYNONYMS){if(q.indexOf(k)!==-1){intentKeys.push(k);q=q.split(k).join(' ');}}
    var foundCats=[]; var cats=CATEGORY_HINTS.slice().sort(function(a,b){return b.length-a.length;});
    for(var i=0;i<cats.length;i++){var cn=normText(cats[i]);if(cn&&q.indexOf(cn)!==-1){foundCats.push(cats[i]);q=q.split(cn).join(' ');}}
    var leftover=tokenize(q); var rawTokens=tokenize(query);
    return { rawQuery:query, regionTerms:unique(leftover), categoryTerms:unique(foundCats), keywordTerms:unique(rawTokens.concat(intentKeys).concat(foundCats).concat(leftover)), intentKeys:intentKeys };
  }
  function hitRatio(text,terms) {
    var tn=normText(text); var ts=unique(terms.map(function(t){return normText(t);}).filter(Boolean));
    if(!ts.length)return 0; var hits=0;
    for(var i=0;i<ts.length;i++){if(tn.indexOf(ts[i])!==-1)hits++;} return Math.min(1,hits/ts.length);
  }
  function buildHaystack(item) {
    return normText([item.name,item.category,item.businessCategory,item.description,item.roadAddress,item.commonAddress,item.fullAddress,item.microReview,item.previewReviewText,item.popularMenuNames,item.options,item.promotionTitle,item.priceCategory,(item.keywords||[]).join(' ')].filter(Boolean).join(' '));
  }
  function computeQueryFit(ctx,name,haystack) {
    var nameN=normText(name); var intentTerms=[];
    for(var i=0;i<ctx.intentKeys.length;i++){var s=INTENT_SYNONYMS[ctx.intentKeys[i]];if(s)intentTerms=intentTerms.concat(s);}
    var intentHit=intentTerms.length?hitRatio(haystack,intentTerms):0;
    return 100*(0.18*hitRatio(nameN,ctx.regionTerms)+0.17*hitRatio(haystack,ctx.regionTerms)+0.18*hitRatio(nameN,ctx.categoryTerms)+0.17*hitRatio(haystack,ctx.categoryTerms)+0.10*hitRatio(nameN,ctx.keywordTerms)+0.10*hitRatio(haystack,ctx.keywordTerms)+0.10*intentHit);
  }
  function computeSeoScores(items,ctx) {
    for(var i=0;i<items.length;i++){
      var r=items[i]; var haystack=buildHaystack(r);
      var nameText=(r.name||'')+' '+(r.category||'')+' '+(r.businessCategory||'');
      var textRelevance=0.25*clamp01(hitRatio(haystack,ctx.regionTerms))+0.20*clamp01(hitRatio(haystack,ctx.categoryTerms))+0.20*clamp01(hitRatio(haystack,ctx.keywordTerms))+0.15*clamp01(Math.min(1,0.55*hitRatio(r.name||'',ctx.regionTerms.concat(ctx.keywordTerms))+0.45*hitRatio(nameText,ctx.categoryTerms.concat(ctx.keywordTerms))))+0.20*clamp01(computeQueryFit(ctx,r.name||'',haystack)/100);
      var naverRelevance=0; if(r.searchRank!=null)naverRelevance=Math.max(0.30,0.90-(r.searchRank-1)*0.012);
      var relevance=r.searchRank!=null?0.40*textRelevance+0.60*naverRelevance:textRelevance;
      var authority=0.30*capLogNorm(r.visitorReviewCount,4000)+0.25*capLogNorm(r.saveCount,7000)+0.20*capLogNorm(r.blogCafeReviewCount,1500)+0.15*capLogNorm(r.imageCount,500)+0.10*(r.visitorReviewScore?Math.min(1,r.visitorReviewScore/5.0):0.5);
      var servicePack=0.30*(r.hasBooking?1:0)+0.30*(r.hasNPay?1:0)+0.40*(r.microReview?1:0);
      var positiveRate=r._positiveRate!=null?r._positiveRate/100:0.5;
      var quality=0.25*clamp01(servicePack)+0.20*capLogNorm(r.imageCount,500)+0.20*(r.visitorReviewScore?Math.min(1,r.visitorReviewScore/5.0):0.5)+0.25*clamp01(positiveRate)+0.10*(r.newOpening?0.3:0);
      var seoScore=100*(0.50*relevance+0.30*authority+0.20*quality);
      r._seoRelevance=Math.round(relevance*1000)/10; r._seoAuthority=Math.round(authority*1000)/10;
      r._seoQuality=Math.round(quality*1000)/10; r._seoScore=Math.round(seoScore*10)/10; r._seoGrade=seoGrade(seoScore);
    }
    items.sort(function(a,b){return(b._seoScore||0)-(a._seoScore||0);});
    for(var j=0;j<items.length;j++)items[j]._seoRank=j+1;
    return items;
  }

  /* ── 리뷰 유틸 ─────────────────────────────────────────────── */
  function sumReferrers(arr){if(!arr)return 0;var s=0;for(var i=0;i<arr.length;i++)s+=(arr[i].value||0);return s;}
  function computeSentiment(themes){if(!themes)return null;var pos=0,neg=0;for(var i=0;i<themes.length;i++){if(themes[i].name==='total'&&themes[i].preference==='positive')pos+=(themes[i].value||0);if(themes[i].name==='total'&&themes[i].preference==='negative')neg+=(themes[i].value||0);}var den=pos+neg;if(!den)return null;return Math.round(pos/den*1000)/10;}
  function extractTopKw(themes){if(!themes)return{top3:'',posNames:[]};var pos=themes.filter(function(t){return t.preference==='positive'&&t.name!=='total'&&(t.value||0)>0;}).sort(function(a,b){return(b.value||0)-(a.value||0);});return{top3:pos.slice(0,3).map(function(t){return themeKo(t.name)+'('+t.value+')';}).join(', '),posNames:pos.slice(0,10).map(function(t){return t.name;})};}

  /* ── 동시 실행 큐 ──────────────────────────────────────────── */
  function runQueue(list,concurrency,workerFn,onProgress){var idx=0,active=0,done=0;return new Promise(function(resolve){function next(){while(active<concurrency&&idx<list.length){(function(item){active++;workerFn(item).catch(function(){}).then(function(){active--;done++;if(onProgress)onProgress(done,list.length);if(done>=list.length)resolve();else next();});})(list[idx++]);}}if(!list.length)resolve();else next();});}

  /* ── 분석 상태 ─────────────────────────────────────────────── */
  var currentRows          = [];
  var currentItems         = [];
  var currentCtx           = null;
  var currentKeyword       = '';
  var currentKind          = 'restaurant';
  var currentTargetPlaceId = null;
  var currentTargetName    = '';
  var currentReviewDays    = 30;
  var currentSortCol       = 'seoRank';
  var currentSortDir       = 'asc';
  var GRADE_ORDER = { '매우강함':5,'강함':4,'보통이상':3,'약한편':2,'개선필요':1 };
  var rvCharts = {};
  function destroyRvCharts(){for(var k in rvCharts){try{if(rvCharts[k])rvCharts[k].destroy();}catch(e){}rvCharts[k]=null;}}

  function updateProgress(text,pct,detail){
    document.getElementById('seo-loading-text').textContent  = text;
    document.getElementById('seo-loading-pct').textContent   = pct+'%';
    document.getElementById('seo-progress-fill').style.width = pct+'%';
    document.getElementById('seo-loading-detail').textContent = detail||'';
  }

  /* ── SEO 분석 실행 ─────────────────────────────────────────── */
  function doAnalysis() {
    var kw      = document.getElementById('seo-keyword').value.trim();
    var pid     = document.getElementById('seo-place-id').value.trim();
    var display = parseInt(document.getElementById('seo-display').value) || 30;
    currentKind = document.getElementById('seo-kind').value;

    if (!kw) { alert('키워드를 입력하세요.'); return; }
    if (pid) { var m = pid.match(/(\d{5,})/); if (m) pid = m[1]; }

    // 빠른 재계산 — 키워드만 바뀌고 PlaceID 동일
    if (currentItems.length > 0 && kw !== currentKeyword && (pid === currentTargetPlaceId || (!pid && !currentTargetPlaceId))) {
      doRecalcWith(kw); return;
    }

    if (!checkSearchLimit()) return;
    runAnalysis(kw, currentKind, pid || null, display);
  }

  function doRecalcWith(newKw) {
    currentKeyword = newKw;
    var ctx = buildQueryContext(newKw);
    currentCtx  = ctx;
    var scored  = computeSeoScores(currentItems.slice(), ctx);
    currentRows = scored;
    var okCnt   = currentItems.filter(function(r){return r._rvStatus==='ok';}).length;
    var failCnt = currentItems.filter(function(r){return r._rvStatus==='fail';}).length;
    renderResults(scored, newKw, currentTargetPlaceId, okCnt, failCnt);
  }

  function runAnalysis(keyword, kind, targetPlaceId, display) {
    show('seo-loading'); hide('seo-empty'); hide('seo-result'); hide('seo-error');
    destroyRvCharts();
    currentKeyword       = keyword;
    currentTargetPlaceId = targetPlaceId;
    currentTargetName    = '';
    currentReviewDays    = 30;
    updateProgress('1단계: 플레이스 검색 중...', 5, '');
    recordSearch();

    SherpaAPI.rank.place({ keyword: keyword, kind: kind, display: display, x: SEARCH_X, y: SEARCH_Y })
      .then(function (data) {
        var results = data.results || [];
        if (!results.length) throw new Error('검색 결과가 없습니다.');
        var ctx = buildQueryContext(keyword);
        currentCtx = ctx;

        var items = results.map(function (r, idx) {
          return {
            searchRank: idx+1, id: String(r.id), name: r.name||'', category: r.category||'',
            businessCategory: r.businessCategory||'', description: r.description||'',
            roadAddress: r.roadAddress||'', commonAddress: r.commonAddress||'', fullAddress: r.fullAddress||'',
            microReview: r.microReview||'', imageUrl: r.imageUrl||'',
            previewReviewText: r.previewReviewText||'', popularMenuNames: r.popularMenuNames||'',
            options: r.options||'', promotionTitle: r.promotionTitle||'', priceCategory: r.priceCategory||'',
            visitorReviewCount: Number(r.visitorReviewCount)||0, blogCafeReviewCount: Number(r.blogCafeReviewCount)||0,
            visitorReviewScore: r.visitorReviewScore ? Number(r.visitorReviewScore) : null,
            saveCount: Number(r.saveCount)||0, imageCount: Number(r.imageCount)||0,
            hasBooking: !!r.hasBooking, hasNPay: !!r.hasNPay, hasTalk: !!r.hasTalk, hasOrder: !!r.hasOrder,
            couponTotal: Number(r.couponTotal)||0, newOpening: !!r.newOpening, bookingBusinessId: r.bookingBusinessId||'',
            isTarget: false, keywords: [],
            _positiveRate: null, _totalReviews: null, _totalReviewers: null, _male: null, _female: null,
            _kwTop3: '', _kwPosNames: [], _rvStatus: 'pending'
          };
        });

        if (targetPlaceId) {
          for (var i=0; i<items.length; i++) {
            if (items[i].id === targetPlaceId) {
              items[i].isTarget = true;
              currentTargetName = items[i].name;
              break;
            }
          }
        }
        updateProgress('1단계 완료', 20, results.length+'개 업체 수집');

        var targetFound = targetPlaceId && items.some(function(it){return it.isTarget;});
        var addTargetPromise = Promise.resolve();
        if (targetPlaceId && !targetFound) {
          updateProgress('내 매장 정보 조회 중...', 25, '');
          addTargetPromise = SherpaAPI.place.detail(targetPlaceId, kind).then(function(detail) {
            currentTargetName = detail.name || '';
            items.push({
              searchRank: null, id: targetPlaceId, name: detail.name||'', category: detail.category||'',
              businessCategory: detail.businessCategory||'', description: detail.description||'',
              roadAddress: detail.roadAddress||'', commonAddress: '', fullAddress: '',
              microReview: detail.microReview||'', imageUrl: detail.imageUrl||'',
              previewReviewText: '', popularMenuNames: '', options: '', promotionTitle: '', priceCategory: '',
              visitorReviewCount: Number(detail.visitorReviewCount)||0, blogCafeReviewCount: Number(detail.blogCafeReviewCount)||0,
              visitorReviewScore: detail.visitorReviewScore ? Number(detail.visitorReviewScore) : null,
              saveCount: Number(detail.saveCount)||0, imageCount: Number(detail.imageCount)||0,
              hasBooking: !!detail.hasBooking, hasNPay: !!detail.hasNPay, hasTalk: false, hasOrder: false,
              couponTotal: 0, newOpening: !!detail.newOpening, bookingBusinessId: '',
              isTarget: true, keywords: detail.keywords||[],
              _positiveRate: null, _totalReviews: null, _totalReviewers: null, _male: null, _female: null,
              _kwTop3: '', _kwPosNames: [], _rvStatus: 'pending'
            });
          }).catch(function(){});
        }

        return addTargetPromise.then(function() {
          currentItems = items;
          return collectReviews(items, 30).then(function(counts) {
            updateProgress('3단계: SEO 점수 계산 중...', 90, '');
            var scored = computeSeoScores(items, ctx);
            currentRows = scored;
            updateProgress('완료', 100, '');
            hide('seo-loading');
            renderResults(scored, keyword, targetPlaceId, counts.ok, counts.fail);
          });
        });
      })
      .catch(function (err) {
        hide('seo-loading'); show('seo-empty');
        document.getElementById('seo-error-msg').textContent = apiMsg(err);
        show('seo-error');
      });
  }

  function collectReviews(items, days) {
    updateProgress('2단계: 리뷰 데이터 수집 중...', 30, '0 / '+items.length);
    var endDate=new Date(); var startDate=new Date(endDate.getTime()-days*86400000);
    var sd=ymd(startDate), ed=ymd(endDate); var okCnt=0, failCnt=0;
    return runQueue(items, 10, function(item){
      return SherpaAPI.review.stats(item.id, sd, ed, false).then(function(resp){
        var d=resp.data;
        item._totalReviews=sumReferrers(d.reviews&&d.reviews.referrers);
        item._totalReviewers=sumReferrers(d.reviewers&&d.reviewers.referrers);
        item._male=d.charactersRatio?(d.charactersRatio.male||null):null;
        item._female=d.charactersRatio?(d.charactersRatio.female||null):null;
        item._positiveRate=computeSentiment(d.themes);
        var kw=extractTopKw(d.themes); item._kwTop3=kw.top3; item._kwPosNames=kw.posNames;
        item._rvStatus='ok'; okCnt++;
      }).catch(function(){item._rvStatus='fail'; failCnt++;});
    }, function(done,total){
      var pct=30+Math.round(done/total*55);
      updateProgress('2단계: 리뷰 수집 중...', pct, done+' / '+total+' (성공 '+okCnt+', 실패 '+failCnt+')');
    }).then(function(){return{ok:okCnt,fail:failCnt};});
  }

  /* ── 기간 변경 ─────────────────────────────────────────────── */
  function changeReviewPeriod(days) {
    if (!currentItems.length) return;
    currentReviewDays = days;
    document.querySelectorAll('.seo-period-btn').forEach(function(b){b.classList.remove('is-active');});
    var btn = document.querySelector('.seo-period-btn[data-days="'+days+'"]');
    if (btn) btn.classList.add('is-active');
    show('seo-loading'); updateProgress('리뷰 재수집 중...', 10, '');
    currentItems.forEach(function(it){it._positiveRate=null;it._totalReviews=null;it._totalReviewers=null;it._male=null;it._female=null;it._kwTop3='';it._kwPosNames=[];it._rvStatus='pending';});
    collectReviews(currentItems, days).then(function(counts){
      var scored=computeSeoScores(currentItems, currentCtx);
      currentRows=scored; hide('seo-loading');
      renderResults(scored, currentKeyword, currentTargetPlaceId, counts.ok, counts.fail);
    });
  }

  /* ── 추적 등록 + 즉시 수집 ─────────────────────────────────── */
  function registerTrack() {
    // 사전 조건 검사
    if (!currentTargetPlaceId) {
      alert('Place ID가 없습니다.\nSEO 분석에서 Place ID를 입력하고 분석을 먼저 실행하세요.');
      return;
    }
    if (!currentKeyword) {
      alert('키워드 정보가 없습니다.\nSEO 분석을 먼저 실행하세요.');
      return;
    }
    if (!window.SherpaAPI || !SherpaAPI.rank || !SherpaAPI.rank.trackCreate) {
      alert('추적 API가 연결되지 않았습니다.');
      return;
    }

    var btn = document.getElementById('seo-btn-register-track');

    // ① 현재 SEO 추적 슬롯 수 확인 (workspaceId='seo')
    SherpaAPI.rank.tracks(WORKSPACE)
      .then(function(res) {
        var tracks    = (res && res.tracks) || [];
        var trackCount = tracks.length;

        // 슬롯 초과 체크
        if (trackCount >= planCfg.trackSlots) {
          if (!planCfg.canBuySlot) {
            alert(planCfg.label + ' 플랜의 SEO 추적 슬롯(' + planCfg.trackSlots + '개)이 모두 사용 중입니다.\nStandard 이상 플랜으로 업그레이드하세요.');
          } else {
            alert('SEO 추적 슬롯(' + planCfg.trackSlots + '개)이 모두 사용 중입니다.\n추적 관리 탭에서 기존 추적을 삭제하세요.');
          }
          return;
        }

        // 이미 같은 키워드+PlaceID로 등록된 추적이 있는지 확인
        var duplicate = tracks.some(function(t) {
          return String(t.target_place_id || t.targetPlaceId) === String(currentTargetPlaceId)
              && t.keyword === currentKeyword;
        });
        if (duplicate) {
          if (!confirm('이미 같은 키워드와 Place ID로 등록된 추적이 있습니다.\n중복으로 등록하시겠습니까?')) return;
        }

        // ② 추적 등록
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 등록 중...';

        return SherpaAPI.rank.trackCreate({
          workspaceId:   WORKSPACE,   // ← 'seo' — rank.html의 'default'와 분리
          kind:          currentKind,
          keyword:       currentKeyword,
          targetPlaceId: currentTargetPlaceId,
          targetName:    currentTargetName || '',
          x:             SEARCH_X,
          y:             SEARCH_Y,
          deviceType:    'pc'
        });
      })
      .then(function(res) {
        if (!res) return; // 슬롯 초과 or 취소로 early return된 경우

        var trackId = res.id;
        if (!trackId) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> 추적 등록 + 즉시 수집';
          alert('추적 등록은 완료됐으나 ID를 받지 못했습니다.');
          return;
        }

        // ③ 즉시 수집
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 수집 중...';

        return SherpaAPI.rank.collect(WORKSPACE, trackId)
          .then(function(cr) {
            var c = cr.collected || cr;
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> 추적 등록 + 즉시 수집';
            alert(
              '✅ SEO 추적 등록 완료!\n' +
              '키워드: ' + currentKeyword + '\n' +
              '매장: ' + (currentTargetName || currentTargetPlaceId) + '\n' +
              '현재 순위: ' + (c.targetRank ? c.targetRank + '위' : 'Top50 밖') + '\n\n' +
              '추적 관리 탭에서 확인할 수 있습니다.'
            );
            // 추적 관리 탭으로 이동
            var trackingTab = document.querySelector('[data-seotab="tracking"]');
            if (trackingTab) trackingTab.click();
          });
      })
      .catch(function(err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> 추적 등록 + 즉시 수집';
        }
        alert('추적 등록 실패: ' + apiMsg(err));
      });
  }

  /* ── 정렬 ──────────────────────────────────────────────────── */
  function getSortValue(r,col){
    switch(col){
      case 'searchRank':   return r.searchRank!=null?r.searchRank:9999;
      case 'seoRank':      return r._seoRank||9999;
      case 'seoScore':     return r._seoScore||0;
      case 'seoGrade':     return GRADE_ORDER[r._seoGrade?r._seoGrade.label:'']||0;
      case 'seoRelevance': return r._seoRelevance||0;
      case 'seoAuthority': return r._seoAuthority||0;
      case 'seoQuality':   return r._seoQuality||0;
      case 'positiveRate': return r._positiveRate!=null?r._positiveRate:0;
      case 'visitorReview':return r.visitorReviewCount||0;
      case 'saveCount':    return r.saveCount||0;
      case 'blogCount':    return r.blogCafeReviewCount||0;
      default:             return 0;
    }
  }
  function sortRows(rows,col,dir){
    return rows.slice().sort(function(a,b){var d=getSortValue(a,col)-getSortValue(b,col);return dir==='asc'?d:-d;});
  }
  function updateSortHeaders(){
    document.querySelectorAll('#seo-table .seo-sortable').forEach(function(th){
      th.classList.remove('seo-sort-asc','seo-sort-desc');
      if(th.dataset.col===currentSortCol) th.classList.add(currentSortDir==='asc'?'seo-sort-asc':'seo-sort-desc');
    });
  }

  /* ── 결과 렌더링 ───────────────────────────────────────────── */
  function renderTable(rows) {
    var tbody=document.getElementById('seo-tbody'); tbody.innerHTML='';
    for(var j=0;j<rows.length;j++){
      var r=rows[j]; var g=r._seoGrade; var tr=document.createElement('tr');
      if(r.isTarget) tr.className='seo-target-row';
      var targetLabel=r.isTarget?'<span style="color:var(--color-accent);font-weight:700;font-size:10px;margin-left:4px;">[내 매장]</span>':'';
      var srText=r.searchRank!=null?r.searchRank:'<span style="color:var(--color-gray-400);">-</span>';
      var prText=r._positiveRate!=null?r._positiveRate+'%':'<span style="color:var(--color-gray-400);">-</span>';
      tr.innerHTML=
        '<td>'+srText+'</td>'+
        '<td style="font-weight:700;color:var(--color-accent);">'+r._seoRank+'</td>'+
        '<td style="text-align:left;"><div style="font-weight:600;">'+esc(r.name)+targetLabel+'</div><div style="font-size:10px;color:var(--color-gray-400);">'+esc(r.id)+'</div></td>'+
        '<td style="font-weight:800;font-size:16px;">'+r._seoScore+'</td>'+
        '<td><span class="seo-badge '+g.cls+'">'+g.label+'</span></td>'+
        '<td>'+r._seoRelevance+'</td><td>'+r._seoAuthority+'</td><td>'+r._seoQuality+'</td>'+
        '<td>'+prText+'</td><td>'+comma(r.visitorReviewCount)+'</td><td>'+comma(r.saveCount)+'</td><td>'+comma(r.blogCafeReviewCount)+'</td>';
      tbody.appendChild(tr);
    }
  }

  function renderResults(rows, keyword, targetPlaceId, okCnt, failCnt) {
    currentSortCol='seoRank'; currentSortDir='asc';
    show('seo-result');
    document.getElementById('seo-r-keyword').textContent='"'+keyword+'" 기준 (리뷰 '+currentReviewDays+'일)';

    // 내 매장 카드 + 추적 버튼
    var mySummary = document.getElementById('seo-my-summary');
    var trackBtn  = document.getElementById('seo-btn-register-track');
    if (targetPlaceId) {
      var myRow=null; for(var i=0;i<rows.length;i++){if(rows[i].isTarget){myRow=rows[i];break;}}
      if (myRow) {
        mySummary.style.display = '';
        if (trackBtn) {
          trackBtn.style.display = '';
          trackBtn.disabled      = false;
          trackBtn.innerHTML     = '<i class="fa-solid fa-bookmark"></i> 추적 등록 + 즉시 수집';
        }
        document.getElementById('seo-my-name').textContent = myRow.name || 'Place ID: ' + myRow.id;
        if (!currentTargetName) currentTargetName = myRow.name || '';
        var g=myRow._seoGrade; var ge=document.getElementById('seo-my-grade');
        ge.textContent=g.label; ge.className='seo-badge '+g.cls;
        document.getElementById('seo-my-rank-text').textContent = 'SEO 순위: '+myRow._seoRank+'위 / '+rows.length+'개 중'+(myRow.searchRank?' (검색 '+myRow.searchRank+'위)':' (검색 범위 밖)');
        document.getElementById('seo-my-score-text').textContent = myRow._seoScore+' / 100';
        document.getElementById('seo-my-bar').style.width = myRow._seoScore+'%';
        document.getElementById('seo-my-rel').textContent  = myRow._seoRelevance;
        document.getElementById('seo-my-auth').textContent = myRow._seoAuthority;
        document.getElementById('seo-my-qual').textContent = myRow._seoQuality;
      } else {
        mySummary.style.display = 'none';
      }
    } else {
      mySummary.style.display = 'none';
      if (trackBtn) trackBtn.style.display = 'none';
    }

    updateSortHeaders();
    renderTable(sortRows(rows,currentSortCol,currentSortDir));

    var okRows=rows.filter(function(r){return r._rvStatus==='ok';});
    if(okRows.length>0){show('seo-review-section'); renderReviewCharts(rows,okRows,okCnt,failCnt); renderReviewTable(rows);}
    else{hide('seo-review-section');}
  }

  /* ── 리뷰 차트 ─────────────────────────────────────────────── */
  function renderReviewCharts(allRows,okRows,okCnt,failCnt){
    destroyRvCharts();
    var totalRev=0,sentArr=[],maleSum=0,femaleSum=0,genCnt=0,kwFreq={};
    okRows.forEach(function(r){totalRev+=(r._totalReviews||0);if(r._positiveRate!=null)sentArr.push(r._positiveRate);if(r._male!=null&&r._female!=null){maleSum+=r._male;femaleSum+=r._female;genCnt++;}(r._kwPosNames||[]).forEach(function(k){kwFreq[k]=(kwFreq[k]||0)+1;});});
    var avgRev=okRows.length?Math.round(totalRev/okRows.length*10)/10:0;
    var avgSent=sentArr.length?Math.round(sentArr.reduce(function(a,b){return a+b;},0)/sentArr.length*10)/10:null;
    var avgM=genCnt?Math.round(maleSum/genCnt*10)/10:null; var avgF=genCnt?Math.round(femaleSum/genCnt*10)/10:null;
    document.getElementById('rv-stat-count').textContent=allRows.length+' / '+okCnt+' / '+failCnt;
    document.getElementById('rv-stat-review').textContent=comma(totalRev)+' ('+avgRev+')';
    document.getElementById('rv-stat-sent').textContent=avgSent!=null?avgSent+'%':'-';
    document.getElementById('rv-stat-gender').textContent=avgM!=null?avgM+'% / '+avgF+'%':'-';
    var top10=okRows.slice().sort(function(a,b){return(b._totalReviews||0)-(a._totalReviews||0);}).slice(0,10);
    rvCharts.top=new Chart(document.getElementById('ch-rv-top'),{type:'bar',data:{labels:top10.map(function(x){return(x.searchRank||'?')+'위 '+(x.name.length>8?x.name.slice(0,8)+'..':x.name);}),datasets:[{data:top10.map(function(x){return x._totalReviews||0;}),backgroundColor:'var(--color-accent)',borderRadius:6}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
    var bins={'N/A':0,'<80%':0,'80-90%':0,'90-95%':0,'95-100%':0};
    okRows.forEach(function(r){var s=r._positiveRate;if(s==null)bins['N/A']++;else if(s<80)bins['<80%']++;else if(s<90)bins['80-90%']++;else if(s<95)bins['90-95%']++;else bins['95-100%']++;});
    rvCharts.sent=new Chart(document.getElementById('ch-rv-sent'),{type:'doughnut',data:{labels:Object.keys(bins),datasets:[{data:Object.values(bins),backgroundColor:['#9ca3af','#ef4444','#f59e0b','#fbbf24','#10b981']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
    rvCharts.gender=new Chart(document.getElementById('ch-rv-gender'),{type:'pie',data:{labels:['남','여'],datasets:[{data:[avgM||0,avgF||0],backgroundColor:['#3b82f6','#ec4899']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
    var kwTop=Object.keys(kwFreq).map(function(k){return{name:k,cnt:kwFreq[k]};}).sort(function(a,b){return b.cnt-a.cnt;}).slice(0,10);
    rvCharts.kw=new Chart(document.getElementById('ch-rv-kw'),{type:'bar',data:{labels:kwTop.map(function(x){return themeKo(x.name);}),datasets:[{data:kwTop.map(function(x){return x.cnt;}),backgroundColor:'#10b981',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});
  }

  /* ── 리뷰 상세 테이블 ──────────────────────────────────────── */
  var rvSortCol='rank', rvSortDir='asc';
  function getRvVal(r,col){switch(col){case'rank':return r.searchRank!=null?r.searchRank:9999;case'reviews':return r._totalReviews||0;case'positive':return r._positiveRate!=null?r._positiveRate:-1;default:return 0;}}
  function renderReviewTable(rows){
    var sorted=rows.slice().sort(function(a,b){var d=getRvVal(a,rvSortCol)-getRvVal(b,rvSortCol);return rvSortDir==='asc'?d:-d;});
    var tbody=document.getElementById('rv-detail-body'); tbody.innerHTML='';
    for(var i=0;i<sorted.length;i++){
      var r=sorted[i]; var tr=document.createElement('tr');
      if(r.isTarget) tr.style.background='rgba(37,99,235,0.04)';
      var targetLabel=r.isTarget?' <span style="color:var(--color-accent);font-weight:700;font-size:10px;">[내 매장]</span>':'';
      var genText=(r._male!=null&&r._female!=null)?r._male+' / '+r._female:'-';
      var sentText=r._positiveRate!=null?r._positiveRate+'%':'-';
      var stText=r._rvStatus==='ok'?'<span style="color:#10b981;font-weight:700;">완료</span>':r._rvStatus==='fail'?'<span style="color:#ef4444;">실패</span>':'<span style="color:#9ca3af;">대기</span>';
      tr.innerHTML='<td>'+(r.searchRank||'-')+'</td><td style="text-align:left;"><div style="font-weight:600;">'+esc(r.name)+targetLabel+'</div><div style="font-size:10px;color:#9ca3af;">'+esc(r.id)+'</div></td><td>'+comma(r._totalReviews)+'</td><td>'+comma(r._totalReviewers)+'</td><td>'+genText+'</td><td>'+sentText+'</td><td style="font-size:11px;">'+esc(r._kwTop3||'-')+'</td><td>'+stText+'</td>';
      tbody.appendChild(tr);
    }
    document.querySelectorAll('.rv-sortable').forEach(function(th){var col=th.dataset.rvcol;var base=col==='rank'?'순위':col==='reviews'?'리뷰수':'긍정률';th.innerHTML=col===rvSortCol?base+(rvSortDir==='asc'?' &#8593;':' &#8595;'):base+' &#8597;';});
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  추적 관리 탭 — workspaceId='seo' 전용                      */
  /* ══════════════════════════════════════════════════════════ */
  var rankTrendChart = null;

  function updateSlotInfo(trackCount){
    var maxSlots=planCfg.trackSlots;
    document.getElementById('seo-slot-used').textContent=trackCount;
    document.getElementById('seo-slot-max').textContent=maxSlots;
    document.getElementById('seo-slot-remain-text').textContent='슬롯 '+trackCount+'/'+maxSlots+' 사용 중';
    var buyBtn=document.getElementById('seo-btn-buy-slot');
    if(buyBtn) buyBtn.style.display=(planCfg.canBuySlot&&trackCount>=maxSlots)?'':'none';
  }

  function loadTracks(){
    var list=document.getElementById('seo-track-list');
    list.innerHTML='<div style="text-align:center;padding:var(--space-6);color:var(--color-gray-400);font-size:13px;">불러오는 중...</div>';
    hide('seo-track-empty'); hide('seo-snapshot-area'); hide('seo-rank-chart-area');
    if(!window.SherpaAPI||!SherpaAPI.rank||!SherpaAPI.rank.tracks){
      list.innerHTML='<div style="text-align:center;padding:var(--space-6);color:var(--color-danger);font-size:13px;">API가 연결되지 않았습니다.</div>';
      return;
    }
    // ▶ workspaceId='seo' — rank.html('default')과 완전 분리
    SherpaAPI.rank.tracks(WORKSPACE).then(function(res){
      var tracks=(res&&res.tracks)||[];
      updateSlotInfo(tracks.length);
      if(!tracks.length){list.innerHTML=''; show('seo-track-empty'); return;}
      list.innerHTML='';
      var chain=Promise.resolve();
      tracks.forEach(function(tr){chain=chain.then(function(){return renderTrackItem(tr,list);});});
    }).catch(function(err){
      list.innerHTML='<div style="text-align:center;padding:var(--space-6);color:var(--color-danger);font-size:13px;">'+esc(apiMsg(err))+'</div>';
    });
  }

  function renderTrackItem(track,container){
    var kindLabel={restaurant:'음식점',hairshop:'미용실',nailshop:'네일샵',hospital:'병원',accommodation:'숙박'}[track.kind||'restaurant']||track.kind||'음식점';
    var item=document.createElement('div'); item.className='seo-track-item';
    item.innerHTML=
      '<div class="seo-track-header">'+
        '<div>'+
          '<div class="seo-track-keyword">['+esc(kindLabel)+'] '+esc(track.keyword)+'</div>'+
          '<div class="seo-track-meta">PID: '+esc(track.target_place_id||track.targetPlaceId||'-')+(track.target_name?' | '+esc(track.target_name):'')+' | 최근 30일</div>'+
        '</div>'+
        '<div class="seo-track-actions">'+
          '<button class="seo-track-btn btn-collect">수집</button>'+
          '<button class="seo-track-btn danger btn-delete">삭제</button>'+
        '</div>'+
      '</div>'+
      '<div class="seo-mini-mount"></div>';
    container.appendChild(item);

    var collectBtn=item.querySelector('.btn-collect');
    var deleteBtn=item.querySelector('.btn-delete');
    var mount=item.querySelector('.seo-mini-mount');

    collectBtn.addEventListener('click',function(){
      collectBtn.disabled=true; collectBtn.textContent='수집 중...';
      SherpaAPI.rank.collect(WORKSPACE,track.id).then(function(res){
        var c=res.collected||res;
        alert(c.skipped?'오늘 이미 수집됨 ('+c.baseDate+')':'수집 완료! 순위: '+(c.targetRank?c.targetRank+'위':'미발견'));
        loadTracks();
      }).catch(function(err){alert('수집 실패: '+apiMsg(err));collectBtn.disabled=false;collectBtn.textContent='수집';});
    });
    deleteBtn.addEventListener('click',function(){
      if(!confirm('이 SEO 추적을 삭제하시겠습니까?'))return;
      SherpaAPI.rank.trackDelete(WORKSPACE,track.id).then(loadTracks).catch(function(err){alert('삭제 실패: '+apiMsg(err));});
    });

    if(!SherpaAPI.rank.timeline){mount.innerHTML='<div style="padding:var(--space-3);font-size:12px;color:var(--color-gray-400);">타임라인 기능이 연결되지 않았습니다.</div>';return Promise.resolve();}
    return SherpaAPI.rank.timeline(WORKSPACE,track.id,30).then(function(res){
      var tl=(res&&res.timeline)||[];
      if(!tl.length){mount.innerHTML='<div style="padding:var(--space-3);font-size:12px;color:var(--color-gray-400);">수집된 데이터가 없습니다.</div>';return;}
      renderMiniTimeline(track,tl,mount);
      renderRankChart(track,tl);
    }).catch(function(){mount.innerHTML='<div style="padding:var(--space-3);font-size:12px;color:var(--color-danger);">타임라인 로드 실패</div>';});
  }

  function renderMiniTimeline(track,timeline,container){
    var wrap=document.createElement('div'); wrap.className='seo-mini-mount';
    var grid=document.createElement('div'); grid.className='seo-mini-grid';
    timeline.forEach(function(row){
      var d=new Date(row.date+'T00:00:00+09:00');
      var dateLabel=String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0')+' '+_dayNames[d.getDay()];
      var rankText=row.targetRank==null?'OUT':String(row.targetRank);
      var cell=document.createElement('div'); cell.className='seo-mini-cell';
      cell.innerHTML=
        '<div class="seo-mini-date">'+dateLabel+'</div>'+
        '<div class="seo-mini-rank '+(row.targetRank==null?'seo-mini-out':'')+'">'+rankText+'</div>'+
        '<div class="seo-mini-delta">'+fmtRankDelta(row.rankDelta)+'</div>'+
        '<div class="seo-mini-metrics">블 '+(row.blogCount==null?'-':comma(row.blogCount))+' 방 '+(row.visitorCount==null?'-':comma(row.visitorCount))+'</div>';
      cell.addEventListener('click',function(){
        grid.querySelectorAll('.seo-mini-cell').forEach(function(n){n.classList.remove('active');});
        cell.classList.add('active');
        loadSnapshot(track.id,row.date,track.target_place_id||track.targetPlaceId,track.target_name||track.targetName);
      });
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    container.appendChild(wrap);
    var first=grid.querySelector('.seo-mini-cell'); if(first)first.click();
  }

  function renderRankChart(track,timeline){
    show('seo-rank-chart-area');
    document.getElementById('seo-rank-chart-title').textContent=track.keyword+(track.target_name?' - '+track.target_name:'');
    var reversed=timeline.slice().reverse();
    var maxRank=1; reversed.forEach(function(t){if(t.targetRank!=null&&t.targetRank>maxRank)maxRank=t.targetRank;});
    var yMax=maxRank<=10?10:maxRank<=20?20:maxRank<=30?30:50;
    if(rankTrendChart){rankTrendChart.destroy(); rankTrendChart=null;}
    if(typeof Chart==='undefined')return;
    rankTrendChart=new Chart(document.getElementById('seo-chart-rank-trend'),{
      type:'line',
      data:{labels:reversed.map(function(t){return t.date.slice(5);}),datasets:[{label:'순위',data:reversed.map(function(t){return t.targetRank;}),borderColor:'var(--color-accent)',backgroundColor:'rgba(37,99,235,0.06)',fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'var(--color-accent)',borderWidth:2,spanGaps:false}]},
      options:{responsive:true,maintainAspectRatio:false,scales:{y:{reverse:true,min:1,max:yMax,ticks:{stepSize:yMax<=10?1:yMax<=20?2:5,font:{size:10},callback:function(v){return Number.isInteger(v)?v+'위':'';}},grid:{color:'rgba(0,0,0,0.04)'}},x:{grid:{display:false},ticks:{font:{size:10}}}},plugins:{legend:{display:false}}}
    });
  }

  function loadSnapshot(trackId,date,targetPlaceId,targetName){
    show('seo-snapshot-area');
    document.getElementById('seo-snap-title').textContent='스냅샷: '+date;
    document.getElementById('seo-snap-sub').textContent='로딩중...';
    document.getElementById('seo-snap-body').innerHTML='';
    document.getElementById('seo-snap-target-note').style.display='none';
    document.getElementById('seo-snap-blur-notice').style.display='none';
    if(!SherpaAPI.rank.snapshot){document.getElementById('seo-snap-sub').textContent='스냅샷 기능이 연결되지 않았습니다.';return;}
    SherpaAPI.rank.snapshot(WORKSPACE,trackId,date).then(function(data){
      if(!data.snapshot){document.getElementById('seo-snap-sub').textContent='해당 날짜 데이터가 없습니다.';return;}
      var snap=data.snapshot; var items=data.items||[];
      document.getElementById('seo-snap-sub').textContent='대상 순위: '+(snap.target_rank==null?'Top50 밖':snap.target_rank+'위')+' | 전일: '+(data.prevDate||'-')+' | 업체 수: '+items.length;
      var snapTable=document.getElementById('seo-snap-table');
      if(planCfg.snapshotBlur){document.getElementById('seo-snap-blur-notice').style.display='';snapTable.style.filter='blur(4px)';snapTable.style.pointerEvents='none';}
      else{snapTable.style.filter='';snapTable.style.pointerEvents='';}
      var body=document.getElementById('seo-snap-body'); body.innerHTML=''; var targetFound=false;
      items.forEach(function(it){
        if(it.isTarget)targetFound=true;
        var tr=document.createElement('tr'); if(it.isTarget)tr.className='seo-target-row';
        var rankNum='<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-weight:800;font-size:13px;'+(it.rank===1?'background:#fbbf24;color:#fff;':it.rank<=3?'background:var(--color-accent);color:#fff;':it.rank<=5?'background:var(--color-gray-200);color:var(--color-gray-700);':'background:var(--color-gray-50);color:var(--color-gray-600);')+'"">'+it.rank+'</span>';
        var delta=it.delta;
        tr.innerHTML=
          '<td>'+rankNum+' '+fmtRankDelta(delta?delta.rankDelta:null)+'</td>'+
          '<td style="text-align:left;font-weight:600;">'+esc(it.name||'-')+(it.isTarget?' <span style="color:var(--color-accent);font-size:10px;font-weight:700;">[대상]</span>':'')+'</td>'+
          '<td>'+esc(it.category||it.businessCategory||'-')+'</td>'+
          '<td>'+comma(it.blog_count||0)+fmtMetricDelta(delta?delta.blogDelta:null)+'</td>'+
          '<td>'+comma(it.visitor_count||0)+fmtMetricDelta(delta?delta.visitorDelta:null)+'</td>'+
          '<td>'+esc(it.score||'-')+'</td>'+
          '<td>'+comma(it.save_count||0)+fmtMetricDelta(delta?delta.saveDelta:null)+'</td>'+
          '<td>'+comma(it.image_count||0)+fmtMetricDelta(delta?delta.imgDelta:null)+'</td>';
        body.appendChild(tr);
      });
      if(!targetFound&&targetPlaceId){
        var note=document.getElementById('seo-snap-target-note');
        note.style.display=''; note.textContent='대상 업체 (PID: '+targetPlaceId+(targetName?' / '+targetName:'')+')가 이 날짜 Top50에 포함되지 않았습니다.';
      }
    }).catch(function(err){document.getElementById('seo-snap-sub').textContent='로드 실패: '+apiMsg(err);});
  }

  /* ── 이벤트 바인딩 ─────────────────────────────────────────── */
  document.getElementById('seo-btn-analyze').addEventListener('click', doAnalysis);
  document.getElementById('seo-keyword').addEventListener('keydown',  function(e){if(e.key==='Enter')doAnalysis();});
  document.getElementById('seo-place-id').addEventListener('keydown', function(e){if(e.key==='Enter')doAnalysis();});

  var registerBtn = document.getElementById('seo-btn-register-track');
  if (registerBtn) registerBtn.addEventListener('click', registerTrack);

  document.addEventListener('click',function(e){
    var th=e.target.closest('#seo-table .seo-sortable'); if(!th)return;
    var col=th.dataset.col; if(!col)return;
    if(currentSortCol===col){currentSortDir=currentSortDir==='asc'?'desc':'asc';}
    else{currentSortCol=col;currentSortDir=(col==='searchRank'||col==='seoRank')?'asc':'desc';}
    if(currentRows.length){updateSortHeaders();renderTable(sortRows(currentRows,currentSortCol,currentSortDir));}
  });

  document.addEventListener('click',function(e){
    var th=e.target.closest('.rv-sortable'); if(!th)return;
    var col=th.dataset.rvcol; if(!col)return;
    if(rvSortCol===col){rvSortDir=rvSortDir==='asc'?'desc':'asc';}else{rvSortCol=col;rvSortDir=col==='rank'?'asc':'desc';}
    if(currentRows.length)renderReviewTable(currentRows);
  });

  document.addEventListener('click',function(e){
    var btn=e.target.closest('.seo-period-btn'); if(!btn)return;
    var days=parseInt(btn.dataset.days); if(days)changeReviewPeriod(days);
  });

  var refreshBtn=document.getElementById('seo-btn-refresh-tracks');
  if(refreshBtn) refreshBtn.addEventListener('click', loadTracks);

  var buySlotBtn=document.getElementById('seo-btn-buy-slot');
  if(buySlotBtn) buySlotBtn.addEventListener('click',function(){
    if(!confirm('추적 슬롯 1개를 1,000 눈덩이로 구매하시겠습니까?'))return;
    alert('슬롯 구매 기능은 준비 중입니다.');
  });

  var overlay=document.getElementById('sidebar-overlay');
  if(overlay) overlay.addEventListener('click',function(){if(window.SidebarModule)window.SidebarModule.closeSidebar();});

  /* ── 초기화 ─────────────────────────────────────────────────── */
  userPlan = getUserPlan();
  planCfg  = PLAN_CONFIG[userPlan] || PLAN_CONFIG.a;

})();
