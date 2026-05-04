/**
 * SHERPAIN21 - Worker API (v2.2)
 *
 * [v2.1] 에스크로 + 커뮤니티 + 출석체크 + 눈덩이 + 자유홍보 + 대시보드
 * [v2.2] CS + 프로그램 문의 + 자유홍보/파트너사 모듈 연결
 *        rank-api.js 분리 — 플레이스 순위조회/트래커/스냅샷 모듈화
 */
import { createCommunityImagesModule } from './community-images-api.js';
import { createCommunityModule }       from './community-api.js';
import { createCsModule }              from './cs-api.js';
import { createInquiryModule }         from './inquiry-api.js';
import { createPromoModule }           from './promo-api.js';
import { createRankModule }            from './rank-api.js';

var KEEP_DAYS = 90;

// ▶ IP 직접 접근 시 Cloudflare 1003 차단 → 도메인으로 우회
var ORACLE_PUPPETEER_URL = 'http://proxy.sherpa-in.com:3000';
var ORACLE_API_KEY = 'sherpa2026proxy';

var REVIEW_QUERY = 'query GetReviewDashboard($businessId:String!,$startDate:String!,$endDate:String!){reviewStatistics(businessId:$businessId,startDate:$startDate,endDate:$endDate){id startDate endDate characters{age gender ratio}charactersRatio{female male}reviewers{referrers{name value diff ratio}daily{reservationDaily{date value}receiptDaily{date value}}}reviews{referrers{name value diff ratio}daily{reservationDaily{date value}receiptDaily{date value}}}themes{name preference value}}}';

var THEME_KO = {
  'taste':'맛','service':'서비스','mood':'분위기','quantity':'양','price':'가격',
  'kindness':'친절','cleanliness':'청결','interior':'인테리어','parking':'주차',
  'waiting':'대기시간','variety':'다양성','freshness':'신선도','speed':'속도',
  'location':'위치','convenience':'편의성','quality':'품질','hygiene':'위생',
  'comfort':'편안함','view':'경치','facility':'시설','accessibility':'접근성',
  'ambiance':'분위기','portion':'양','value':'가성비','staff':'직원','menu':'메뉴',
  'total':'총합','costEfficiency':'가성비','amount':'양','diversity':'다양성',
  'rapidness':'신속함','sanitation':'위생','friendliness':'친절함',
  'spaciousness':'넓음','coziness':'아늑함'
};
function themeToKo(name) { return name ? THEME_KO[name] || name : ''; }

// ════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
function jsonResp(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function kstDateString() {
  var now = new Date(); var kst = new Date(now.getTime() + 9*60*60*1000);
  return kst.toISOString().slice(0, 10);
}
function kstNowString() {
  var now = new Date(); var kst = new Date(now.getTime() + 9*60*60*1000);
  return kst.toISOString().slice(0, 19).replace('T', ' ');
}
function parseCount(v) {
  if (v == null) return 0; if (typeof v === 'number') return v;
  var s = String(v).replace(/,/g, '').replace(/~/g, '').trim();
  var n = parseInt(s, 10); return isNaN(n) ? 0 : n;
}
function uuid() {
  return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// ════════════════════════════════════════
// JWT
// ════════════════════════════════════════
function base64UrlEncodeUtf8(str) {
  var bytes = new TextEncoder().encode(str);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function base64UrlDecodeUtf8(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  var binary = atob(str);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
  return new TextDecoder().decode(bytes);
}
async function signJWT(payload, secret) {
  var header = { alg: 'HS256', typ: 'JWT' };
  var enc = new TextEncoder();
  var segments = [base64UrlEncodeUtf8(JSON.stringify(header)), base64UrlEncodeUtf8(JSON.stringify(payload))];
  var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', key, enc.encode(segments.join('.')));
  var sigStr = btoa(String.fromCharCode.apply(null, new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return segments.join('.') + '.' + sigStr;
}
async function verifyJWT(token, secret) {
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    var sigBase64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    while (sigBase64.length % 4) sigBase64 += '=';
    var sigBuf = Uint8Array.from(atob(sigBase64), function(c) { return c.charCodeAt(0); });
    var valid = await crypto.subtle.verify('HMAC', key, sigBuf, enc.encode(parts[0] + '.' + parts[1]));
    if (!valid) return null;
    var payload = JSON.parse(base64UrlDecodeUtf8(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}
async function optionalAuth(request, env) {
  var auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || !env.JWT_SECRET) return null;
  return verifyJWT(auth.slice(7), env.JWT_SECRET);
}
async function requireAuth(request, env) {
  return optionalAuth(request, env);
}

// ════════════════════════════════════════
// SNOWBALL HELPERS
// ════════════════════════════════════════
async function getSnowballBalance(db, userId) {
  var user = await db.prepare('SELECT tokens FROM users WHERE id=?').bind(userId).first();
  return user ? (user.tokens || 0) : 0;
}
async function deductSnowball(db, userId, amount, description, refType, refId) {
  var balance = await getSnowballBalance(db, userId);
  if (balance < amount) return null;
  var newBalance = balance - amount;
  await db.batch([
    db.prepare('UPDATE users SET tokens=?, updated_at=? WHERE id=?').bind(newBalance, new Date().toISOString(), userId),
    db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type, ref_id) VALUES(?,?,?,?,?,?,?)').bind(userId, 'use', -amount, newBalance, description, refType || null, refId || null)
  ]);
  return newBalance;
}
async function addSnowball(db, userId, amount, type, description, refType, refId) {
  var balance = await getSnowballBalance(db, userId);
  var newBalance = balance + amount;
  await db.batch([
    db.prepare('UPDATE users SET tokens=?, updated_at=? WHERE id=?').bind(newBalance, new Date().toISOString(), userId),
    db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type, ref_id) VALUES(?,?,?,?,?,?,?)').bind(userId, type || 'earn', amount, newBalance, description, refType || null, refId || null)
  ]);
  return newBalance;
}

// ════════════════════════════════════════
// NAVER PLACE GRAPHQL
// ════════════════════════════════════════
function buildGraphQL(kind, keyword, start, display, x, y, deviceType) {
  var dt = deviceType || 'pc';
  if (kind === 'restaurant') {
    return {
      operationName: 'getRestaurantList',
      variables: {
        restaurantListInput: { query: keyword, x: String(x), y: String(y), start: start, display: display, deviceType: dt, isPcmap: true, takeout: null, orderBenefit: null, filterOpening: null, order: null, isNmap: false },
        isNmap: false
      },
      // ▶ markerId @include(if: $isNmap) 포함 — $isNmap 변수를 반드시 사용해야 GraphQL 검증 통과
      query: 'query getRestaurantList($restaurantListInput: RestaurantListInput, $isNmap: Boolean!) {\n  restaurants: restaurantList(input: $restaurantListInput) {\n    items {\n      id\n      name\n      businessCategory\n      category\n      description\n      hasBooking\n      hasNPay\n      x\n      y\n      distance\n      imageUrl\n      imageCount\n      phone\n      virtualPhone\n      routeUrl\n      roadAddress\n      address\n      commonAddress\n      blogCafeReviewCount\n      bookingReviewCount\n      totalReviewCount\n      bookingUrl\n      bookingBusinessId\n      talktalkUrl\n      options\n      promotionTitle\n      agencyId\n      businessHours\n      newOpening\n      markerId @include(if: $isNmap)\n      fullAddress\n      visitorReviewCount\n      visitorReviewScore\n      imageUrls\n      bookingHubUrl\n      bookingHubButtonName\n      visitorReviews { id review reviewId __typename }\n      microReview\n      priceCategory\n      saveCount\n      naverOrder { items { id type __typename } isDelivery isTableOrder isPreOrder isPickup __typename }\n      popularMenuImages { name price bookingCount menuUrl imageUrl isPopular __typename }\n      newBusinessHours { status description __typename }\n      broadcastInfo { program date menu __typename }\n      realTimeBookingInfo { description hasMultipleBookingItems bookingBusinessId bookingUrl itemId itemName __typename }\n      __typename\n    }\n    nlu { queryType queryResult { ptn0 ptn1 region spot tradeName service selectedRegion { name index x y __typename } property keyword queryType nluQuery businessType cid branch franchise titleKeyword location { x y default longitude latitude dong si __typename } noRegionQuery priority themeId filterBooking repRegion repSpot type category menu context themes __typename } __typename }\n    total\n    __typename\n  }\n}\n'
    };
  }
  if (kind === 'hairshop') { return { operationName: 'getBeautyList', variables: { useReverseGeocode: false, input: { query: keyword, display: display, start: start, filterBooking: false, filterCoupon: false, filterNpay: false, filterOpening: false, filterBookingPromotion: false, filterWheelchairEntrance: false, naverBenefit: false, sortingOrder: 'precision', x: String(x), y: String(y), deviceType: dt, bypassStyleClous: false }, businessType: 'hairshop', isNmap: false, isBounds: false }, query: 'query getBeautyList($input: BeautyListInput, $businessType: String, $isNmap: Boolean!, $isBounds: Boolean!, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {\n  businesses: hairshopList(input: $input) {\n    total\n    items { id apolloCacheId name hasBooking hasNPay blogCafeReviewCount bookingReviewCount bookingReviewScore roadAddress address imageUrl distance x y visitorReviewCount visitorReviewScore newOpening category businessCategory hasWheelchairEntrance markerId @include(if: $isNmap) __typename }\n    queryString __typename\n  }\n  brands: beautyBrands(input: $input, businessType: $businessType) { name cid __typename }\n}\n' }; }
  if (kind === 'nailshop') { return { operationName: 'getBeautyList', variables: { useReverseGeocode: false, input: { query: keyword, display: display, start: start, filterBooking: false, filterCoupon: false, filterNpay: false, filterOpening: false, filterBookingPromotion: false, filterWheelchairEntrance: false, naverBenefit: false, sortingOrder: 'precision', x: String(x), y: String(y), deviceType: dt, bypassStyleClous: false }, businessType: 'nailshop', isNmap: false, isBounds: false }, query: 'query getBeautyList($input: BeautyListInput, $businessType: String, $isNmap: Boolean!, $isBounds: Boolean!, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {\n  businesses: nailshopList(input: $input) {\n    total\n    items { id apolloCacheId name hasBooking hasNPay blogCafeReviewCount bookingReviewCount bookingReviewScore roadAddress address imageUrl distance x y visitorReviewCount visitorReviewScore newOpening category businessCategory hasWheelchairEntrance markerId @include(if: $isNmap) __typename }\n    queryString __typename\n  }\n  brands: beautyBrands(input: $input, businessType: $businessType) { name cid __typename }\n}\n' }; }
  if (kind === 'hospital') { return { operationName: 'getNxList', variables: { isNmap: false, isBounds: false, useReverseGeocode: false, input: { query: keyword, display: display, start: start, filterBooking: false, filterOpentime: false, filterSpecialist: false, filterWheelchairEntrance: false, sortingOrder: 'precision', x: String(x), y: String(y), day: null, deviceType: dt } }, query: 'query getNxList($input: HospitalListInput, $isNmap: Boolean!, $isBounds: Boolean!, $useReverseGeocode: Boolean!, $reverseGeocodingInput: ReverseGeocodingInput) {\n  businesses: hospitals(input: $input) {\n    total\n    items { id name hasBooking hasNPay blogCafeReviewCount bookingReviewCount visitorReviewCount visitorReviewScore imageCount distance category imageUrl x y businessCategory roadAddress address fullAddress commonAddress newOpening hasWheelchairEntrance apolloCacheId markerId @include(if: $isNmap) __typename }\n    queryString __typename\n  }\n}\n' }; }
  if (kind === 'accommodation') { return { operationName: 'searchAccommodation', variables: { input: { query: keyword, display: display, start: start, x: String(x), y: String(y), sortingOrder: 'precision', deviceType: dt, minPrice: null, maxPrice: null, pay: 'true', npay: 'true' }, isNmap: false, isBounds: false }, query: 'query searchAccommodation($input: AccommodationSearchInput, $isNmap: Boolean!, $isBounds: Boolean!) {\n  accommodationSearch(input: $input) {\n    business {\n      total\n      items { id dbType name businessCategory category hasBooking hasNPay x y distance imageUrl imageCount roadAddress address commonAddress blogCafeReviewCount bookingReviewCount totalReviewCount microReview placeReviewCount placeReviewScore bookingReviewScore newOpening markerId @include(if: $isNmap) __typename }\n      queryString __typename\n    } __typename\n  }\n}\n' }; }
  return buildGraphQL('restaurant', keyword, start, display, x, y, dt);
}

function extractFromResponse(kind, data) {
  try {
    var d = data[0].data;
    if (kind === 'restaurant') { var root = d.restaurants || {}; return { items: root.items || [], total: root.total || 0, nlu: root.nlu || null }; }
    if (kind === 'hairshop' || kind === 'nailshop' || kind === 'hospital') return { items: d.businesses.items || [], total: d.businesses.total || 0, nlu: null };
    if (kind === 'accommodation') { var biz = d.accommodationSearch && d.accommodationSearch.business; if (biz) return { items: biz.items || [], total: biz.total || 0, nlu: null }; }
  } catch (e) {}
  return { items: [], total: 0, nlu: null };
}

function normalizeItem(kind, item) {
  var visitorReviews = item.visitorReviews || [];
  var previewReviewText = '';
  for (var vi = 0; vi < visitorReviews.length; vi++) { if (visitorReviews[vi] && visitorReviews[vi].review) { previewReviewText += ' ' + String(visitorReviews[vi].review).replace(/<[^>]+>/g, ' '); } }
  var popularMenuImages = item.popularMenuImages || [];
  var popularMenuNames = '';
  for (var pi = 0; pi < popularMenuImages.length; pi++) { if (popularMenuImages[pi] && popularMenuImages[pi].name) { popularMenuNames += ' ' + popularMenuImages[pi].name; } }
  var naverOrderItems = item.naverOrder && item.naverOrder.items ? item.naverOrder.items : [];
  var couponTotal = item.coupon && item.coupon.total ? parseCount(item.coupon.total) : 0;
  var newBizHours = item.newBusinessHours || {};
  var broadcastInfo = item.broadcastInfo || {};
  return {
    id: item.id, name: item.name || '', category: item.category || '', businessCategory: item.businessCategory || '',
    description: item.description || '', blogCafeReviewCount: parseCount(item.blogCafeReviewCount),
    visitorReviewCount: parseCount(item.visitorReviewCount || item.placeReviewCount || item.totalReviewCount),
    visitorReviewScore: item.visitorReviewScore || item.placeReviewScore || item.bookingReviewScore || null,
    saveCount: parseCount(item.saveCount), imageCount: parseCount(item.imageCount),
    microReview: item.microReview || '', imageUrl: item.imageUrl || '',
    roadAddress: item.roadAddress || item.address || '', commonAddress: item.commonAddress || '',
    fullAddress: item.fullAddress || '', distance: item.distance || null, phone: item.phone || '',
    priceCategory: item.priceCategory || '', hasBooking: !!(item.hasBooking || item.bookingUrl || item.bookingHubUrl),
    hasNPay: !!item.hasNPay, hasTalk: !!item.talktalkUrl, hasOrder: naverOrderItems.length > 0,
    couponTotal: couponTotal, newOpening: !!item.newOpening, promotionTitle: item.promotionTitle || '',
    options: Array.isArray(item.options) ? item.options.join(' ') : String(item.options || ''),
    previewReviewText: previewReviewText.trim(), popularMenuNames: popularMenuNames.trim(),
    newBusinessHoursStatus: newBizHours.status || '', newBusinessHoursDesc: newBizHours.description || '',
    broadcastProgram: broadcastInfo.program || '', bookingBusinessId: item.bookingBusinessId || ''
  };
}

async function naverFetchResults(kind, keyword, start, display, x, y, deviceType) {
  var MAX_RETRIES = 2;
  var RETRY_DELAYS = [3000, 6000];
  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      var gql = buildGraphQL(kind || 'restaurant', keyword, start, display, x, y, deviceType || 'pc');
      var resp = await fetch(ORACLE_PUPPETEER_URL + '/naver/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ORACLE_API_KEY },
        body: JSON.stringify([gql])
      });
      var ct = resp.headers.get('content-type') || '';
      var text = await resp.text();
      if (resp.status === 429 || !ct.includes('application/json') || text.trim().startsWith('<')) {
        if (attempt < MAX_RETRIES) { await sleep(RETRY_DELAYS[attempt]); continue; }
        var err = new Error('BLOCKED_OR_RATE_LIMITED');
        err.upstreamStatus = resp.status;
        err.snippet = text.substring(0, 300);
        throw err;
      }
      var data = JSON.parse(text);
      if (data[0] && data[0].errors && data[0].errors.length > 0) {
        var gqlErr = new Error('GRAPHQL_ERROR: ' + data[0].errors[0].message);
        gqlErr.snippet = JSON.stringify(data[0].errors).substring(0, 500);
        throw gqlErr;
      }
      var extracted = extractFromResponse(kind || 'restaurant', data);
      return { items: extracted.items.map(function(it) { return normalizeItem(kind, it); }), total: extracted.total, nlu: extracted.nlu || null };
    } catch (e) {
      if (attempt < MAX_RETRIES && (e.message === 'BLOCKED_OR_RATE_LIMITED' || !e.upstreamStatus)) { await sleep(RETRY_DELAYS[attempt]); continue; }
      throw e;
    }
  }
}

// ════════════════════════════════════════
// 모듈 초기화
// ════════════════════════════════════════
const communityImagesModule = createCommunityImagesModule({ jsonResp, requireAuth });
const communityModule = createCommunityModule({ jsonResp, requireAuth, kstDateString, kstNowString, addSnowball });
const csModule      = createCsModule({ jsonResp, requireAuth });
const inquiryModule = createInquiryModule({ jsonResp, requireAuth });
const promoModule   = createPromoModule({ jsonResp, requireAuth, getSnowballBalance, deductSnowball });
const rankModule    = createRankModule({ jsonResp, kstDateString, kstNowString, sleep, naverFetchResults, buildGraphQL, corsHeaders, ORACLE_PUPPETEER_URL, ORACLE_API_KEY });

// ════════════════════════════════════════
// PASSWORD HASH
// ════════════════════════════════════════
async function sha256Hex(text) {
  var enc = new TextEncoder();
  var buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}
async function hashPassword(password) { return sha256Hex('sherpain::' + password); }
async function issueUserToken(user, env) {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  var nowSec = Math.floor(Date.now() / 1000);
  return signJWT({ sub: user.id, role: user.role || 'general', plan: user.plan || 'a', name: user.name || '', iat: nowSec, exp: nowSec + (60 * 60 * 24 * 14) }, env.JWT_SECRET);
}

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════
async function handleAuthSignup(request, env) {
  var db = env.DB;
  if (!db) return jsonResp({ ok: false, error: 'DB not configured' }, 500);
  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
  var signupMethod = String(body.signup_method || 'social').trim();
  var name = String(body.name || '').trim();
  var phone = String(body.phone || '').trim();
  var role = String(body.role || 'general').trim();
  var bizType = String(body.biz_type || '').trim();
  var storeName = String(body.store_name || '').trim();
  var agencyName = String(body.agency_name || '').trim();
  var referralCode = String(body.referral_code || '').trim();
  if (!name) return jsonResp({ ok: false, error: 'name required' }, 400);
  if (['general', 'marketer'].indexOf(role) === -1) return jsonResp({ ok: false, error: 'invalid role' }, 400);
  var initialTokens = 150;
  if (referralCode) { var referrer = await db.prepare('SELECT id FROM users WHERE referral_code=?').bind(referralCode).first(); if (referrer) initialTokens = 1000; }
  if (signupMethod === 'email') {
    var loginId = String(body.login_id || '').trim();
    var email = String(body.email || '').trim().toLowerCase();
    var password = String(body.password || '');
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(loginId)) return jsonResp({ ok: false, error: 'invalid login_id' }, 400);
    if (!email || email.indexOf('@') === -1) return jsonResp({ ok: false, error: 'invalid email' }, 400);
    if (!password || password.length < 8) return jsonResp({ ok: false, error: 'password must be at least 8 characters' }, 400);
    var existsLogin = await db.prepare('SELECT id FROM users WHERE login_id=?').bind(loginId).first();
    if (existsLogin) return jsonResp({ ok: false, error: '이미 사용 중인 아이디입니다.' }, 409);
    var existsEmail = await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
    if (existsEmail) return jsonResp({ ok: false, error: '이미 가입된 이메일입니다.' }, 409);
    var id = uuid(); var passwordHash = await hashPassword(password); var nowIso = new Date().toISOString(); var myReferralCode = 'S' + Date.now().toString(36).toUpperCase();
    await db.prepare('INSERT INTO users(id, email, name, phone, role, plan, provider, provider_id, biz_type, store_name, agency_name, tokens, referral_code, login_id, password_hash, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, email, name, phone, role, 'a', 'email', null, bizType, storeName, agencyName, initialTokens, myReferralCode, loginId, passwordHash, nowIso, nowIso).run();
    await db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)').bind(id, 'earn', initialTokens, initialTokens, referralCode ? '추천인 가입 보너스' : '가입 축하 보너스', 'signup').run();
    var user = { id: id, email: email, name: name, role: role, plan: 'a', provider: 'email', login_id: loginId, snowball: initialTokens };
    var token = await issueUserToken(user, env);
    return jsonResp({ ok: true, token: token, user: user });
  }
  var demoId = uuid(); var nowIso2 = new Date().toISOString(); var demoReferralCode = 'S' + Date.now().toString(36).toUpperCase();
  await db.prepare('INSERT INTO users(id, email, name, phone, role, plan, provider, provider_id, biz_type, store_name, agency_name, tokens, referral_code, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(demoId, '', name, phone, role, 'a', 'demo', null, bizType, storeName, agencyName, initialTokens, demoReferralCode, nowIso2, nowIso2).run();
  await db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)').bind(demoId, 'earn', initialTokens, initialTokens, '가입 축하 보너스', 'signup').run();
  var demoUser = { id: demoId, email: '', name: name, role: role, plan: 'a', provider: 'demo', snowball: initialTokens };
  var demoToken = await issueUserToken(demoUser, env);
  return jsonResp({ ok: true, token: demoToken, user: demoUser });
}

async function handleAuthLogin(request, env) {
  var db = env.DB;
  if (!db) return jsonResp({ ok: false, error: 'DB not configured' }, 500);
  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
  var loginId = String(body.loginId || '').trim();
  var password = String(body.password || '');
  if (!loginId) return jsonResp({ ok: false, error: 'loginId required' }, 400);
  if (!password) return jsonResp({ ok: false, error: 'password required' }, 400);
  var user = await db.prepare('SELECT id, email, name, phone, role, plan, provider, login_id, password_hash, tokens FROM users WHERE login_id=? OR email=? LIMIT 1').bind(loginId, loginId.toLowerCase()).first();
  if (!user || !user.password_hash) { return jsonResp({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401); }
  var pwHash = await hashPassword(password);
  if (pwHash !== user.password_hash) { return jsonResp({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401); }
  var token = await issueUserToken(user, env);
  return jsonResp({ ok: true, token: token, user: { id: user.id, email: user.email || '', name: user.name || '', phone: user.phone || '', role: user.role || 'general', plan: user.plan || 'a', provider: user.provider || 'email', login_id: user.login_id || '', snowball: user.tokens || 0 } });
}

async function handleAuthMe(request, env) {
  var payload = await optionalAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;
  if (!db) return jsonResp({ ok: false, error: 'DB not configured' }, 500);
  var user = await db.prepare('SELECT id, email, name, phone, role, plan, provider, login_id, biz_type, store_name, agency_name, tokens, referral_code FROM users WHERE id=? LIMIT 1').bind(payload.sub).first();
  if (!user) return jsonResp({ ok: false, error: 'User not found' }, 404);
  var result = Object.assign({}, user);
  result.snowball = user.tokens || 0;
  return jsonResp({ ok: true, user: result });
}

// ════════════════════════════════════════
// D1 AUTO MIGRATION
// ════════════════════════════════════════
async function autoMigrate(db) {
  try { var info = await db.prepare('PRAGMA table_info(tracks)').all(); var cols = info.results.map(function(r) { return r.name; }); if (cols.indexOf('kind') === -1) await db.exec("ALTER TABLE tracks ADD COLUMN kind TEXT DEFAULT 'restaurant'"); if (cols.indexOf('target_name') === -1) await db.exec('ALTER TABLE tracks ADD COLUMN target_name TEXT'); } catch (e) {}
  try { var uinfo = await db.prepare('PRAGMA table_info(users)').all(); var ucols = uinfo.results.map(function(r) { return r.name; }); if (ucols.indexOf('login_id') === -1) await db.exec('ALTER TABLE users ADD COLUMN login_id TEXT'); if (ucols.indexOf('password_hash') === -1) await db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT'); if (ucols.indexOf('referral_code') === -1) await db.exec('ALTER TABLE users ADD COLUMN referral_code TEXT'); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS snowball_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, description TEXT, ref_type TEXT, ref_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS escrow_missions (id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, mission_type TEXT DEFAULT 'review', category TEXT, location TEXT, place_id TEXT, place_name TEXT, reward_per_person INTEGER NOT NULL, max_applicants INTEGER DEFAULT 1, total_deposit INTEGER NOT NULL, platform_fee INTEGER NOT NULL, deadline DATETIME, requirements TEXT, status TEXT DEFAULT 'open', is_locked INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS escrow_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, mission_id INTEGER NOT NULL, applicant_id TEXT NOT NULL, status TEXT DEFAULT 'pending', submission_url TEXT, submission_note TEXT, submitted_at DATETIME, approved_at DATETIME, payout_amount INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, board TEXT NOT NULL DEFAULT 'community', category TEXT, title TEXT NOT NULL, content TEXT NOT NULL, view_count INTEGER DEFAULT 0, like_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_id TEXT NOT NULL, parent_id INTEGER, content TEXT NOT NULL, like_count INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, check_date TEXT NOT NULL, reward INTEGER DEFAULT 0, streak INTEGER DEFAULT 1, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS free_promotions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, link_url TEXT, image_url TEXT, category TEXT, view_count INTEGER DEFAULT 0, cost INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS post_images (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, image_url TEXT NOT NULL, width INTEGER, height INTEGER, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS faq_items (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, status TEXT DEFAULT 'waiting', admin_reply TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
  try { await db.exec("CREATE TABLE IF NOT EXISTS partner_companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, service_category TEXT, description TEXT, status TEXT DEFAULT 'official', inquiry_url TEXT, owner_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) {}
}

async function cleanupOld(db) {
  var cutoff = new Date(Date.now() - KEEP_DAYS * 86400000); var cutoffStr = cutoff.toISOString().slice(0, 10);
  var old = await db.prepare('SELECT id FROM snapshots WHERE base_date < ?').bind(cutoffStr).all();
  var ids = old.results.map(function(r) { return r.id; }); if (ids.length === 0) return;
  for (var i = 0; i < ids.length; i += 50) { var chunk = ids.slice(i, i + 50); var qs = chunk.map(function() { return '?'; }).join(','); await db.prepare('DELETE FROM snapshot_items WHERE snapshot_id IN (' + qs + ')').bind(...chunk).run(); await db.prepare('DELETE FROM snapshots WHERE id IN (' + qs + ')').bind(...chunk).run(); }
}

// ════════════════════════════════════════
// 에스크로 미션
// ════════════════════════════════════════
async function handleEscrowCreate(request, env) {
  var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB; var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
  var title = String(body.title || '').trim(); var description = String(body.description || '').trim(); var missionType = String(body.mission_type || 'review').trim(); var category = String(body.category || '').trim(); var location = String(body.location || '').trim(); var placeId = body.place_id ? String(body.place_id).trim() : null; var placeName = body.place_name ? String(body.place_name).trim() : null; var rewardPerPerson = parseInt(body.reward_per_person); var maxApplicants = parseInt(body.max_applicants) || 1; var deadline = body.deadline ? String(body.deadline).trim() : null; var requirements = body.requirements ? String(body.requirements).trim() : null;
  if (!title) return jsonResp({ ok: false, error: 'title required' }, 400);
  if (!rewardPerPerson || rewardPerPerson < 100) return jsonResp({ ok: false, error: 'reward_per_person must be >= 100' }, 400);
  if (maxApplicants < 1 || maxApplicants > 100) return jsonResp({ ok: false, error: 'max_applicants must be 1~100' }, 400);
  var subtotal = rewardPerPerson * maxApplicants; var platformFee = Math.ceil(subtotal * 0.1); var totalDeposit = subtotal + platformFee;
  var balance = await getSnowballBalance(db, payload.sub);
  if (balance < totalDeposit) { return jsonResp({ ok: false, error: '눈덩이가 부족합니다.', required: totalDeposit, balance: balance }, 400); }
  var nowIso = new Date().toISOString(); var newBalance = balance - totalDeposit;
  await db.batch([
    db.prepare('INSERT INTO escrow_missions(requester_id, title, description, mission_type, category, location, place_id, place_name, reward_per_person, max_applicants, total_deposit, platform_fee, deadline, requirements, status, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(payload.sub, title, description, missionType, category, location, placeId, placeName, rewardPerPerson, maxApplicants, totalDeposit, platformFee, deadline, requirements, 'open', nowIso, nowIso),
    db.prepare('UPDATE users SET tokens=?, updated_at=? WHERE id=?').bind(newBalance, nowIso, payload.sub),
    db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)').bind(payload.sub, 'escrow_deposit', -totalDeposit, newBalance, '에스크로 미션 예치 (수수료 포함)', 'escrow')
  ]);
  return jsonResp({ ok: true, totalDeposit: totalDeposit, platformFee: platformFee, newBalance: newBalance });
}
async function handleEscrowList(request, env) { var db = env.DB; var url = new URL(request.url); var status = url.searchParams.get('status') || 'open'; var page = parseInt(url.searchParams.get('page')) || 1; var limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50); var offset = (page - 1) * limit; var missions = await db.prepare('SELECT m.*, u.name AS requester_name FROM escrow_missions m LEFT JOIN users u ON u.id = m.requester_id WHERE m.status=? ORDER BY m.created_at DESC LIMIT ? OFFSET ?').bind(status, limit, offset).all(); var countResult = await db.prepare('SELECT COUNT(*) as cnt FROM escrow_missions WHERE status=?').bind(status).first(); return jsonResp({ ok: true, missions: missions.results, total: countResult.cnt, page: page, limit: limit }); }
async function handleEscrowDetail(request, env) { var db = env.DB; var url = new URL(request.url); var id = url.searchParams.get('id'); if (!id) return jsonResp({ ok: false, error: 'id required' }, 400); var mission = await db.prepare('SELECT m.*, u.name AS requester_name FROM escrow_missions m LEFT JOIN users u ON u.id = m.requester_id WHERE m.id=?').bind(id).first(); if (!mission) return jsonResp({ ok: false, error: 'Mission not found' }, 404); var apps = await db.prepare('SELECT a.*, u.name AS applicant_name FROM escrow_applications a LEFT JOIN users u ON u.id = a.applicant_id WHERE a.mission_id=? ORDER BY a.created_at ASC').bind(id).all(); return jsonResp({ ok: true, mission: mission, applications: apps.results }); }
async function handleEscrowApply(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var missionId = parseInt(body.mission_id); if (!missionId) return jsonResp({ ok: false, error: 'mission_id required' }, 400); var mission = await db.prepare('SELECT * FROM escrow_missions WHERE id=?').bind(missionId).first(); if (!mission) return jsonResp({ ok: false, error: 'Mission not found' }, 404); if (mission.status !== 'open') return jsonResp({ ok: false, error: '미션이 마감되었습니다.' }, 400); if (mission.is_locked) return jsonResp({ ok: false, error: '미션이 잠금 상태입니다.' }, 400); if (mission.requester_id === payload.sub) return jsonResp({ ok: false, error: '본인의 미션에는 신청할 수 없습니다.' }, 400); var existing = await db.prepare('SELECT id FROM escrow_applications WHERE mission_id=? AND applicant_id=?').bind(missionId, payload.sub).first(); if (existing) return jsonResp({ ok: false, error: '이미 신청한 미션입니다.' }, 409); var nowIso = new Date().toISOString(); await db.prepare('INSERT INTO escrow_applications(mission_id, applicant_id, status, created_at, updated_at) VALUES(?,?,?,?,?)').bind(missionId, payload.sub, 'pending', nowIso, nowIso).run(); var appCount = await db.prepare('SELECT COUNT(*) as cnt FROM escrow_applications WHERE mission_id=? AND status IN (?,?,?)').bind(missionId, 'pending', 'accepted', 'submitted').first(); if (appCount.cnt >= mission.max_applicants) { await db.prepare('UPDATE escrow_missions SET is_locked=1, status=?, updated_at=? WHERE id=?').bind('in_progress', nowIso, missionId).run(); } return jsonResp({ ok: true }); }
async function handleEscrowApprove(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var applicationId = parseInt(body.application_id); if (!applicationId) return jsonResp({ ok: false, error: 'application_id required' }, 400); var app = await db.prepare('SELECT a.*, m.requester_id, m.reward_per_person, m.platform_fee, m.max_applicants, m.id AS mid FROM escrow_applications a JOIN escrow_missions m ON m.id = a.mission_id WHERE a.id=?').bind(applicationId).first(); if (!app) return jsonResp({ ok: false, error: 'Application not found' }, 404); if (app.requester_id !== payload.sub) return jsonResp({ ok: false, error: '본인의 미션만 승인할 수 있습니다.' }, 403); if (app.status !== 'submitted') return jsonResp({ ok: false, error: '제출된 미션만 승인할 수 있습니다.' }, 400); var payoutAmount = app.reward_per_person; var nowIso = new Date().toISOString(); var newBalance = await addSnowball(db, app.applicant_id, payoutAmount, 'escrow_payout', '에스크로 미션 #' + app.mid + ' 정산', 'escrow', String(app.mid)); await db.prepare('UPDATE escrow_applications SET status=?, approved_at=?, payout_amount=?, updated_at=? WHERE id=?').bind('approved', nowIso, payoutAmount, nowIso, applicationId).run(); var pendingCount = await db.prepare("SELECT COUNT(*) as cnt FROM escrow_applications WHERE mission_id=? AND status NOT IN ('approved','rejected','cancelled')").bind(app.mid).first(); if (pendingCount.cnt === 0) { await db.prepare("UPDATE escrow_missions SET status='completed', updated_at=? WHERE id=?").bind(nowIso, app.mid).run(); } return jsonResp({ ok: true, payoutAmount: payoutAmount }); }

// ════════════════════════════════════════
// 레거시 커뮤니티/출석체크 핸들러
// ════════════════════════════════════════
async function handlePostList(request, env) { var db = env.DB; var url = new URL(request.url); var board = url.searchParams.get('board') || 'community'; var page = parseInt(url.searchParams.get('page')) || 1; var limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50); var offset = (page - 1) * limit; var posts = await db.prepare('SELECT p.id, p.board, p.category, p.title, p.view_count, p.like_count, p.comment_count, p.is_pinned, p.created_at, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.board=? AND p.is_deleted=0 ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?').bind(board, limit, offset).all(); var countResult = await db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE board=? AND is_deleted=0').bind(board).first(); return jsonResp({ ok: true, posts: posts.results, total: countResult.cnt, page: page, limit: limit }); }
async function handlePostDetail(request, env) { var db = env.DB; var url = new URL(request.url); var id = url.searchParams.get('id'); if (!id) return jsonResp({ ok: false, error: 'id required' }, 400); var post = await db.prepare('SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id=? AND p.is_deleted=0').bind(id).first(); if (!post) return jsonResp({ ok: false, error: 'Post not found' }, 404); await db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id=?').bind(id).run(); var comments = await db.prepare('SELECT c.*, u.name AS author_name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.post_id=? AND c.is_deleted=0 ORDER BY c.created_at ASC').bind(id).all(); return jsonResp({ ok: true, post: post, comments: comments.results }); }
async function handlePostCreate(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var board = String(body.board || 'community').trim(); var category = body.category ? String(body.category).trim() : null; var title = String(body.title || '').trim(); var content = String(body.content || '').trim(); if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400); var nowIso = new Date().toISOString(); var result = await db.prepare('INSERT INTO posts(user_id, board, category, title, content, created_at, updated_at) VALUES(?,?,?,?,?,?,?)').bind(payload.sub, board, category, title, content, nowIso, nowIso).run(); return jsonResp({ ok: true, id: result.meta.last_row_id }); }
async function handleCommentCreate(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var postId = parseInt(body.post_id); var content = String(body.content || '').trim(); var parentId = body.parent_id ? parseInt(body.parent_id) : null; if (!postId || !content) return jsonResp({ ok: false, error: 'post_id and content required' }, 400); var nowIso = new Date().toISOString(); await db.batch([db.prepare('INSERT INTO comments(post_id, user_id, parent_id, content, created_at) VALUES(?,?,?,?,?)').bind(postId, payload.sub, parentId, content, nowIso), db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id=?').bind(postId)]); return jsonResp({ ok: true }); }
async function handleAttendanceCheck(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var today = kstDateString(); var existing = await db.prepare('SELECT id FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, today).first(); if (existing) return jsonResp({ ok: false, error: '오늘은 이미 출석했습니다.' }, 409); var yesterday = new Date(Date.now() + 9*60*60*1000 - 86400000).toISOString().slice(0, 10); var yesterdayRecord = await db.prepare('SELECT streak FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, yesterday).first(); var streak = yesterdayRecord ? (yesterdayRecord.streak + 1) : 1; var reward = 10; if (streak >= 30) reward = 50; else if (streak >= 14) reward = 30; else if (streak >= 7) reward = 20; var newBalance = await addSnowball(db, payload.sub, reward, 'earn', '출석체크 보상 (연속 ' + streak + '일)', 'attendance', today); await db.prepare('INSERT INTO attendance(user_id, check_date, reward, streak) VALUES(?,?,?,?)').bind(payload.sub, today, reward, streak).run(); return jsonResp({ ok: true, streak: streak, reward: reward, newBalance: newBalance }); }
async function handleAttendanceStatus(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var today = kstDateString(); var todayRecord = await db.prepare('SELECT * FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, today).first(); var monthStart = today.substring(0, 7) + '-01'; var monthRecords = await db.prepare('SELECT check_date, reward, streak FROM attendance WHERE user_id=? AND check_date>=? ORDER BY check_date ASC').bind(payload.sub, monthStart).all(); return jsonResp({ ok: true, checkedToday: !!todayRecord, currentStreak: todayRecord ? todayRecord.streak : 0, monthRecords: monthRecords.results }); }
async function handleSnowballHistory(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var url = new URL(request.url); var page = parseInt(url.searchParams.get('page')) || 1; var limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50); var offset = (page - 1) * limit; var type = url.searchParams.get('type'); var query = 'SELECT * FROM snowball_transactions WHERE user_id=?'; var countQuery = 'SELECT COUNT(*) as cnt FROM snowball_transactions WHERE user_id=?'; var binds = [payload.sub]; if (type) { query += ' AND type=?'; countQuery += ' AND type=?'; binds.push(type); } query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'; var transactions = await db.prepare(query).bind(...binds, limit, offset).all(); var countResult = await db.prepare(countQuery).bind(...binds).first(); var balance = await getSnowballBalance(db, payload.sub); return jsonResp({ ok: true, transactions: transactions.results, total: countResult.cnt, balance: balance, page: page, limit: limit }); }
async function handleDashboardStats(request, env) { var payload = await requireAuth(request, env); if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401); var db = env.DB; var user = await db.prepare('SELECT plan, tokens FROM users WHERE id=?').bind(payload.sub).first(); if (!user) return jsonResp({ ok: false, error: 'User not found' }, 404); var missionCount = await db.prepare("SELECT COUNT(*) as cnt FROM escrow_missions WHERE requester_id=? AND status IN ('open','in_progress')").bind(payload.sub).first(); var appCount = await db.prepare("SELECT COUNT(*) as cnt FROM escrow_applications WHERE applicant_id=? AND status IN ('pending','accepted','submitted')").bind(payload.sub).first(); var monthStart = kstDateString().substring(0, 7) + '-01'; var attendCount = await db.prepare('SELECT COUNT(*) as cnt FROM attendance WHERE user_id=? AND check_date>=?').bind(payload.sub, monthStart).first(); return jsonResp({ ok: true, plan: user.plan, snowball: user.tokens || 0, activeMissions: (missionCount.cnt || 0) + (appCount.cnt || 0), monthAttendance: attendCount.cnt || 0 }); }

// ════════════════════════════════════════
// 기타 기능 핸들러 (stub — 추후 분리 예정)
// ════════════════════════════════════════
function naverAdParseVol(val) { if (val === '< 10' || val === '<10') return 0; if (val == null || val === '') return 0; var n = Number(val); return isNaN(n) ? 0 : n; }
async function naverAdHeaders(method, uri, env) { if (!env.NAVER_AD_API_KEY || !env.NAVER_AD_SECRET_KEY || !env.NAVER_AD_CUSTOMER_ID) return null; var ts = String(Date.now()); var msg = ts + '.' + method + '.' + uri; var enc = new TextEncoder(); var key = await crypto.subtle.importKey('raw', enc.encode(env.NAVER_AD_SECRET_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); var sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg)); var sigB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(sig))); return { 'Content-Type': 'application/json; charset=UTF-8', 'X-Timestamp': ts, 'X-API-KEY': env.NAVER_AD_API_KEY, 'X-Customer': String(env.NAVER_AD_CUSTOMER_ID), 'X-Signature': sigB64 }; }
async function naverAdKeywordData(keyword, env) { var uri = '/keywordstool'; var sk = keyword.replace(/\s/g, ''); try { var h = await naverAdHeaders('GET', uri, env); if (!h) return { ok: false, error: 'NAVER_AD API keys not configured' }; var r = await fetch('https://api.searchad.naver.com' + uri + '?hintKeywords=' + encodeURIComponent(sk) + '&showDetail=1', { method: 'GET', headers: h }); if (!r.ok) return { ok: false, error: 'API error ' + r.status }; var d = await r.json(); return { ok: true, keywordList: d.keywordList || [] }; } catch (e) { return { ok: false, error: e.message }; } }
async function naverAdPerformance(keyword, bids, device, env) { var uri = '/estimate/performance/keyword'; var sk = keyword.replace(/\s/g, ''); try { var h = await naverAdHeaders('POST', uri, env); if (!h) return { ok: false, error: 'API keys not configured' }; var r = await fetch('https://api.searchad.naver.com' + uri, { method: 'POST', headers: h, body: JSON.stringify({ device: device, keywordplus: false, key: sk, bids: Array.isArray(bids) ? bids : [bids] }) }); if (!r.ok) return { ok: false, error: 'API error ' + r.status }; return { ok: true, data: await r.json() }; } catch (e) { return { ok: false, error: e.message }; } }
async function naverAdRankBids(keyword, env) { var uri = '/estimate/average-position-bid/keyword'; var sk = keyword.replace(/\s/g, ''); var results = {}; var devices = ['MOBILE', 'PC']; for (var d = 0; d < devices.length; d++) { var dev = devices[d]; var items = []; for (var p = 1; p <= 5; p++) items.push({ key: sk, position: p }); try { var h = await naverAdHeaders('POST', uri, env); if (!h) return { ok: false, error: 'API keys not configured' }; var r = await fetch('https://api.searchad.naver.com' + uri, { method: 'POST', headers: h, body: JSON.stringify({ device: dev, items: items }) }); if (!r.ok) return { ok: false, error: dev + ' API error ' + r.status }; var data = await r.json(); results[dev] = data.estimate || []; } catch (e) { return { ok: false, error: e.message }; } } var landscape = []; var me = results.MOBILE || [], pe = results.PC || []; for (var i = 0; i < Math.max(me.length, pe.length); i++) { var mb = me[i] ? me[i].bid || 0 : 0; var pb = pe[i] ? pe[i].bid || 0 : 0; if (mb > 0 || pb > 0) landscape.push({ rank: i + 1, mobileBid: mb, pcBid: pb }); } return { ok: true, bidLandscape: landscape }; }
async function handleKeywordVolumePost(request, env) { var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var keywords = body.keywords; var includeRelated = !!body.includeRelated; if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return jsonResp({ ok: false, error: 'keywords array required' }, 400); if (keywords.length > 100) keywords = keywords.slice(0, 100); var mainResults = [], relatedResults = [], seen = {}; for (var i = 0; i < keywords.length; i++) { var kw = keywords[i]; var sk = kw.replace(/\s/g, '').toLowerCase(); seen[sk] = true; var res = await naverAdKeywordData(kw, env); if (!res.ok || res.keywordList.length === 0) { mainResults.push({ keyword: kw, monthlyPcQcCnt: 0, monthlyMobileQcCnt: 0, compIdx: '-' }); } else { var exact = null; for (var j = 0; j < res.keywordList.length; j++) { if (res.keywordList[j].relKeyword.replace(/\s/g, '').toLowerCase() === sk) { exact = res.keywordList[j]; break; } } var target = exact || res.keywordList[0]; mainResults.push({ keyword: kw, monthlyPcQcCnt: target.monthlyPcQcCnt, monthlyMobileQcCnt: target.monthlyMobileQcCnt, compIdx: target.compIdx || '-' }); if (includeRelated) { for (var k = 0; k < res.keywordList.length; k++) { var rk = res.keywordList[k].relKeyword.replace(/\s/g, '').toLowerCase(); if (!seen[rk]) { seen[rk] = true; relatedResults.push({ keyword: res.keywordList[k].relKeyword, monthlyPcQcCnt: res.keywordList[k].monthlyPcQcCnt, monthlyMobileQcCnt: res.keywordList[k].monthlyMobileQcCnt, compIdx: res.keywordList[k].compIdx || '-', sourceKeyword: kw }); } } } } if (i < keywords.length - 1) await sleep(200); } relatedResults.sort(function(a, b) { return (naverAdParseVol(b.monthlyPcQcCnt) + naverAdParseVol(b.monthlyMobileQcCnt)) - (naverAdParseVol(a.monthlyPcQcCnt) + naverAdParseVol(a.monthlyMobileQcCnt)); }); if (relatedResults.length > 200) relatedResults = relatedResults.slice(0, 200); return jsonResp({ ok: true, data: mainResults, related: includeRelated ? relatedResults : [], total: mainResults.length, relatedTotal: relatedResults.length }); }
async function handleAdAnalyze(request, env) { var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var mode = body.mode; if (!mode) return jsonResp({ ok: false, error: 'mode required (custom|full|rank|bulk)' }, 400); if (mode === 'rank') { var keyword = body.keyword; if (!keyword) return jsonResp({ ok: false, error: 'keyword required' }, 400); var kwRes = await naverAdKeywordData(keyword, env); var bidRes = await naverAdRankBids(keyword, env); if (!bidRes.ok) return jsonResp({ ok: false, error: bidRes.error }, 502); var kwInfo = null; if (kwRes.ok && kwRes.keywordList.length > 0) { var kd = kwRes.keywordList[0]; kwInfo = { keyword: keyword, monthlyPcQcCnt: kd.monthlyPcQcCnt, monthlyMobileQcCnt: kd.monthlyMobileQcCnt, compIdx: kd.compIdx }; } return jsonResp({ ok: true, keywordInfo: kwInfo, bidLandscape: bidRes.bidLandscape }); } if (mode === 'custom') { var keyword = body.keyword; var bid = parseInt(body.bid); if (!keyword || !bid) return jsonResp({ ok: false, error: 'keyword and bid required' }, 400); if (bid < 70 || bid > 100000) return jsonResp({ ok: false, error: 'bid must be 70~100000' }, 400); var results = await Promise.all([naverAdKeywordData(keyword, env), naverAdPerformance(keyword, [bid], 'MOBILE', env), naverAdRankBids(keyword, env)]); var kwRes = results[0], perfRes = results[1], bidRes = results[2]; if (!kwRes.ok) return jsonResp({ ok: false, error: kwRes.error }, 502); var kd = kwRes.keywordList[0] || {}; var kwInfo = { keyword: keyword, monthlyPcQcCnt: kd.monthlyPcQcCnt, monthlyMobileQcCnt: kd.monthlyMobileQcCnt, compIdx: kd.compIdx }; var perf = null; if (perfRes.ok && perfRes.data.estimate && perfRes.data.estimate.length > 0) { var est = perfRes.data.estimate[0]; perf = { bid: bid, clicks: est.clicks || 0, cost: est.cost || 0 }; } var rankInfo = { rank: 99, rankText: '미확인', share: 10 }; if (bidRes.ok) { var bl = bidRes.bidLandscape; for (var i = 0; i < bl.length; i++) { if (bid >= bl[i].mobileBid) { var sm = { 1: 85, 2: 70, 3: 55, 4: 40, 5: 30 }; rankInfo = { rank: bl[i].rank, rankText: bl[i].rank + '위', share: sm[bl[i].rank] || 20 }; break; } } } return jsonResp({ ok: true, keywordInfo: kwInfo, performance: perf, rankInfo: rankInfo, bidLandscape: bidRes.ok ? bidRes.bidLandscape : [] }); } if (mode === 'full') { var keyword = body.keyword; if (!keyword) return jsonResp({ ok: false, error: 'keyword required' }, 400); var testBids = [100, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000]; var results = await Promise.all([naverAdKeywordData(keyword, env), naverAdPerformance(keyword, testBids, 'MOBILE', env), naverAdPerformance(keyword, testBids, 'PC', env), naverAdRankBids(keyword, env)]); var kwRes = results[0], mobRes = results[1], pcRes = results[2], bidRes = results[3]; if (!kwRes.ok) return jsonResp({ ok: false, error: kwRes.error }, 502); var kd = kwRes.keywordList[0] || {}; var kwInfo = { keyword: keyword, monthlyPcQcCnt: kd.monthlyPcQcCnt, monthlyMobileQcCnt: kd.monthlyMobileQcCnt, compIdx: kd.compIdx }; var mobilePerf = [], recommendedBid = null; if (mobRes.ok && mobRes.data.estimate) { var valid = mobRes.data.estimate.filter(function(e) { return e.clicks > 0; }); mobilePerf = valid.map(function(e) { return { bid: e.bid, clicks: e.clicks, cost: e.cost || Math.round(e.clicks * e.bid * 0.8) }; }); if (valid.length > 0) { var maxC = 0; for (var i = 0; i < valid.length; i++) if (valid[i].clicks > maxC) maxC = valid[i].clicks; for (var i = 0; i < valid.length; i++) { if (valid[i].clicks >= maxC * 0.8) { recommendedBid = { bid: valid[i].bid, clicks: valid[i].clicks, cost: valid[i].cost || Math.round(valid[i].clicks * valid[i].bid * 0.8) }; break; } } } } var pcPerf = []; if (pcRes.ok && pcRes.data.estimate) { pcPerf = pcRes.data.estimate.filter(function(e) { return e.clicks > 0; }).map(function(e) { return { bid: e.bid, clicks: e.clicks, cost: e.cost || Math.round(e.clicks * e.bid * 0.8) }; }); } return jsonResp({ ok: true, keywordInfo: kwInfo, mobilePerformance: mobilePerf, pcPerformance: pcPerf, recommendedBid: recommendedBid, bidLandscape: bidRes.ok ? bidRes.bidLandscape : [] }); } if (mode === 'bulk') { var keywords = body.keywords; if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return jsonResp({ ok: false, error: 'keywords array required' }, 400); if (keywords.length > 50) keywords = keywords.slice(0, 50); var data = []; for (var i = 0; i < keywords.length; i++) { var kw = keywords[i]; var results = await Promise.all([naverAdKeywordData(kw, env), naverAdRankBids(kw, env)]); var kwRes = results[0], bidRes = results[1]; var item = { keyword: kw, totalQcCnt: 0, monthlyPcQcCnt: 0, monthlyMobileQcCnt: 0, compIdx: '-', rank1Bid: 0, rank2Bid: 0, rank3Bid: 0, rank4Bid: 0, rank5Bid: 0, recommendedBid: 0, expectedClicks: 0, expectedCost: 0, cpc: 0 }; if (kwRes.ok && kwRes.keywordList.length > 0) { var kd = kwRes.keywordList[0]; item.monthlyPcQcCnt = naverAdParseVol(kd.monthlyPcQcCnt); item.monthlyMobileQcCnt = naverAdParseVol(kd.monthlyMobileQcCnt); item.totalQcCnt = item.monthlyPcQcCnt + item.monthlyMobileQcCnt; item.compIdx = kd.compIdx || '-'; } if (bidRes.ok) { var bl = bidRes.bidLandscape; for (var j = 0; j < bl.length; j++) { if (bl[j].rank === 1) item.rank1Bid = bl[j].mobileBid; if (bl[j].rank === 2) item.rank2Bid = bl[j].mobileBid; if (bl[j].rank === 3) item.rank3Bid = bl[j].mobileBid; if (bl[j].rank === 4) item.rank4Bid = bl[j].mobileBid; if (bl[j].rank === 5) item.rank5Bid = bl[j].mobileBid; } } if (item.rank3Bid > 0) { item.recommendedBid = item.rank3Bid; item.expectedClicks = Math.round(item.totalQcCnt * 0.04); item.cpc = Math.round(item.rank3Bid * 0.8); item.expectedCost = item.expectedClicks * item.cpc; } data.push(item); if (i < keywords.length - 1) await sleep(500); } return jsonResp({ ok: true, data: data, total: data.length }); } return jsonResp({ ok: false, error: 'invalid mode' }, 400); }
async function handleHealth() { return jsonResp({ ok: true, time: kstNowString(), version: '2.2.0' }); }
async function handleKeywordVolume(request) { var url = new URL(request.url); var keyword = url.searchParams.get('keyword'); if (!keyword) return jsonResp({ ok: false, error: 'keyword required' }, 400); return jsonResp({ keyword: keyword, monthly: { pc: 12400, mobile: 45600, total: 58000 }, competition: 'high', source: 'mock' }); }
async function handlePlaceKeywords(request) { var url = new URL(request.url); var placeId = url.searchParams.get('placeId'); if (!placeId) return jsonResp({ error: 'placeId required' }, 400); return jsonResp({ placeId: placeId, name: '', keywords: [] }); }
async function handlePlaceDetail(request) { var url = new URL(request.url); var placeId = url.searchParams.get('placeId'); if (!placeId) return jsonResp({ error: 'placeId required' }, 400); return jsonResp({ placeId: placeId, kind: 'restaurant', name: '', raw: null }); }
async function handlePlaceDetailGql(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handlePlaceThemes(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handlePlaceReviews(request) { var url = new URL(request.url); var placeId = url.searchParams.get('placeId'); if (!placeId) return jsonResp({ error: 'placeId required' }, 400); return jsonResp({ ok: true, placeId: placeId, reviews: [] }); }
async function handleReviewStats(request) { var url = new URL(request.url); var businessId = url.searchParams.get('businessId'); var startDate = url.searchParams.get('startDate'); var endDate = url.searchParams.get('endDate'); if (!businessId || !startDate || !endDate) return jsonResp({ error: 'businessId, startDate, endDate required' }, 400); try { var resp = await fetch('https://api.place.naver.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Referer': 'https://new.smartplace.naver.com/' }, body: JSON.stringify({ query: REVIEW_QUERY, variables: { businessId: businessId, startDate: startDate, endDate: endDate } }) }); var data = await resp.json(); var stats = data && data.data && data.data.reviewStatistics; if (!stats) return jsonResp({ error: 'no data' }, 404); if (stats.themes) stats.themes = stats.themes.map(function(t) { return Object.assign({}, t, { nameKo: themeToKo(t.name) }); }); return jsonResp({ ok: true, stats: stats }); } catch (e) { return jsonResp({ error: e.message }, 502); } }
async function handleYoutubeSearch(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleYoutubeVideos(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleYoutubeChannels(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleYoutubeTrending(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleAiYoutubeAnalyze(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleLandProxy(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleLandProxyPost(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleDatalabTrend(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleGoogleTrendsDaily(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleGoogleTrendsRealtime(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleBlogGenerate(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleParkingScan(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handleBizCollect(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handlePuppeteerProxy(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }
async function handlePuppeteerHealth(request) { return jsonResp({ ok: true, status: 'proxy not configured' }); }
async function handleSmartplaceKeywords(request) { return jsonResp({ ok: false, error: 'not implemented' }, 501); }

// ════════════════════════════════════════
// ROUTE TABLE
// ════════════════════════════════════════
var routes = [
  { method: 'GET',    path: '/health',                 handler: handleHealth },
  { method: 'POST',   path: '/auth/signup',            handler: handleAuthSignup },
  { method: 'POST',   path: '/auth/login',             handler: handleAuthLogin },
  { method: 'GET',    path: '/auth/me',                handler: handleAuthMe },
  // ── rank-api.js 모듈 (proxy.sherpa-in.com:3000 경유) ──────────
  { method: 'GET',    path: '/rank/place',             handler: (r, e) => rankModule.handleRankPlace(r, e) },
  { method: 'POST',   path: '/rank/proxy',             handler: (r, e) => rankModule.handleRankProxy(r, e) },
  { method: 'POST',   path: '/rank/track',             handler: (r, e) => rankModule.handleTrackCreate(r, e) },
  { method: 'GET',    path: '/rank/tracks',            handler: (r, e) => rankModule.handleTrackList(r, e) },
  { method: 'DELETE', path: '/rank/track',             handler: (r, e) => rankModule.handleTrackDelete(r, e) },
  { method: 'POST',   path: '/rank/collect',           handler: (r, e) => rankModule.handleCollect(r, e) },
  { method: 'GET',    path: '/rank/timeline',          handler: (r, e) => rankModule.handleTimeline(r, e) },
  { method: 'GET',    path: '/rank/snapshot',          handler: (r, e) => rankModule.handleSnapshot(r, e) },
  // ─────────────────────────────────────────────────────────────
  { method: 'GET',    path: '/keyword/volume',         handler: handleKeywordVolume },
  { method: 'POST',   path: '/keyword/volume',         handler: handleKeywordVolumePost },
  { method: 'POST',   path: '/ad/analyze',             handler: handleAdAnalyze },
  { method: 'GET',    path: '/place/keywords',         handler: handlePlaceKeywords },
  { method: 'GET',    path: '/place/detail',           handler: handlePlaceDetail },
  { method: 'GET',    path: '/place/detail-gql',       handler: handlePlaceDetailGql },
  { method: 'GET',    path: '/place/themes',           handler: handlePlaceThemes },
  { method: 'GET',    path: '/place/reviews',          handler: handlePlaceReviews },
  { method: 'GET',    path: '/review/stats',           handler: handleReviewStats },
  { method: 'GET',    path: '/youtube/search',         handler: handleYoutubeSearch },
  { method: 'GET',    path: '/youtube/videos',         handler: handleYoutubeVideos },
  { method: 'GET',    path: '/youtube/channels',       handler: handleYoutubeChannels },
  { method: 'GET',    path: '/youtube/trending',       handler: handleYoutubeTrending },
  { method: 'POST',   path: '/ai/youtube-analyze',     handler: handleAiYoutubeAnalyze },
  { method: 'GET',    path: '/land/proxy',             handler: handleLandProxy },
  { method: 'POST',   path: '/land/proxy',             handler: handleLandProxyPost },
  { method: 'POST',   path: '/datalab/trend',          handler: handleDatalabTrend },
  { method: 'GET',    path: '/google/trends/daily',    handler: handleGoogleTrendsDaily },
  { method: 'GET',    path: '/google/trends/realtime', handler: handleGoogleTrendsRealtime },
  { method: 'POST',   path: '/ai/blog-generate',       handler: handleBlogGenerate },
  { method: 'POST',   path: '/ai/parking-scan',        handler: handleParkingScan },
  { method: 'POST',   path: '/biz/collect',            handler: handleBizCollect },
  { method: 'POST',   path: '/puppeteer/proxy',        handler: handlePuppeteerProxy },
  { method: 'GET',    path: '/puppeteer/health',       handler: handlePuppeteerHealth },
  { method: 'POST',   path: '/smartplace/keywords',    handler: handleSmartplaceKeywords },
  { method: 'POST',   path: '/escrow/create',          handler: handleEscrowCreate },
  { method: 'GET',    path: '/escrow/list',            handler: handleEscrowList },
  { method: 'GET',    path: '/escrow/detail',          handler: handleEscrowDetail },
  { method: 'POST',   path: '/escrow/apply',           handler: handleEscrowApply },
  { method: 'POST',   path: '/escrow/approve',         handler: handleEscrowApprove },
  { method: 'GET',    path: '/post/list',              handler: handlePostList },
  { method: 'GET',    path: '/post/detail',            handler: handlePostDetail },
  { method: 'POST',   path: '/post/create',            handler: handlePostCreate },
  { method: 'POST',   path: '/comment/create',         handler: handleCommentCreate },
  { method: 'POST',   path: '/attendance/check',       handler: handleAttendanceCheck },
  { method: 'GET',    path: '/attendance/status',      handler: handleAttendanceStatus },
  { method: 'GET',    path: '/snowball/history',       handler: handleSnowballHistory },
  { method: 'GET',    path: '/dashboard/stats',        handler: handleDashboardStats },
];

// ════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

    var db = env.DB;
    if (db && !globalThis.__SHERPA_AUTO_MIGRATED__) {
      try { await autoMigrate(db); globalThis.__SHERPA_AUTO_MIGRATED__ = true; } catch (e) {}
    }

    var url = new URL(request.url);
    var pathname = url.pathname.replace(/\/+$/, '') || '/';

    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (r.method === request.method && r.path === pathname) {
        try { return await r.handler(request, env); }
        catch (e) { console.error('Handler error:', e); return jsonResp({ error: 'Internal server error' }, 500); }
      }
    }

    if (pathname === '/api/community/posts' && request.method === 'GET') { try { return await communityModule.handlePostList(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/community/posts' && request.method === 'POST') { try { return await communityModule.handlePostCreate(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/community\/posts\/\d+$/.test(pathname) && request.method === 'GET') { try { return await communityModule.handlePostDetail(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/community\/posts\/\d+\/comments$/.test(pathname) && request.method === 'GET') { try { return await communityModule.handleCommentList(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/community\/posts\/\d+\/comments$/.test(pathname) && request.method === 'POST') { try { return await communityModule.handleCommentCreate(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/community/images' && request.method === 'POST') { try { return await communityImagesModule.handleUpload(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'upload failed' }, 500); } }
    if (pathname === '/api/community/attendance/status' && request.method === 'GET') { try { return await communityModule.handleAttendanceStatus(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/community/attendance/feed' && request.method === 'GET') { try { return await communityModule.handleAttendanceFeed(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/community/attendance/checkin' && request.method === 'POST') { try { return await communityModule.handleAttendanceCheckin(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/cs/faqs' && request.method === 'GET') { try { return await csModule.handleFaqList(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/cs\/faqs\/\d+$/.test(pathname) && request.method === 'GET') { try { return await csModule.handleFaqDetail(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/cs/qna' && request.method === 'GET') { try { return await csModule.handleQnaList(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/cs/qna' && request.method === 'POST') { try { return await csModule.handleQnaCreate(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/cs\/qna\/\d+$/.test(pathname) && request.method === 'GET') { try { return await csModule.handleQnaDetail(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/cs/tickets' && request.method === 'GET') { try { return await csModule.handleTicketList(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/cs/tickets' && request.method === 'POST') { try { return await csModule.handleTicketCreate(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/cs\/tickets\/\d+$/.test(pathname) && request.method === 'GET') { try { return await csModule.handleTicketDetail(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/inquiry/posts' && request.method === 'GET') { try { return await inquiryModule.handleList(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/inquiry/posts' && request.method === 'POST') { try { return await inquiryModule.handleCreate(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/inquiry\/posts\/\d+$/.test(pathname) && request.method === 'GET') { try { return await inquiryModule.handleDetail(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/promo/partners' && request.method === 'GET') { try { return await promoModule.handlePartnerList(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/promo/posts' && request.method === 'GET') { try { return await promoModule.handlePromoList(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/promo/posts' && request.method === 'POST') { try { return await promoModule.handlePromoCreate(request, env); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (/^\/api\/promo\/posts\/\d+$/.test(pathname) && request.method === 'GET') { try { return await promoModule.handlePromoDetail(request, env, pathname); } catch (e) { return jsonResp({ ok: false, error: e.message || 'failed' }, 500); } }
    if (pathname === '/api/dev/session' && request.method === 'POST') {
      try { return await DEV_SESSION_handle(request, env); }
      catch (e) { return jsonResp({ ok: false, error: e.message || 'DEV_SESSION failed' }, 500); }
    }

    return jsonResp({ error: 'not found', path: pathname, method: request.method }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async function() {
      var db = env.DB;
      if (!db) return;
      await autoMigrate(db);
      var tracks = await db.prepare('SELECT * FROM tracks WHERE active=1 ORDER BY id ASC').all();
      for (var i = 0; i < tracks.results.length; i++) {
        var tr = tracks.results[i];
        try { await rankModule.collectTrack(db, tr); await sleep(1200); }
        catch (e) { if (e.message === 'BLOCKED_OR_RATE_LIMITED') break; }
      }
      try { await cleanupOld(db); } catch (e) {}
    })());
  },
};

// ════════════════════════════════════════
// DEV SESSION (임시 개발용)
// ════════════════════════════════════════
async function DEV_SESSION_handle(request, env) {
  try {
    var db = env.DB;
    if (!db) return jsonResp({ ok: false, error: 'DB not configured' }, 500);
    var body = {};
    try { body = await request.json(); } catch (e) {}
    var key = String(body.key || '').trim();
    if (key !== 'sherpain-dev-2026') { return jsonResp({ ok: false, error: 'invalid dev key' }, 403); }
    var loginId = 'dev_owner'; var email = 'owner@sherpain21.com'; var nowIso = new Date().toISOString();
    var user = await db.prepare('SELECT id, email, name, phone, role, plan, provider, login_id, tokens FROM users WHERE login_id=? OR email=? LIMIT 1').bind(loginId, email).first();
    if (!user) {
      var id = uuid(); var referralCode = 'DEV' + Date.now().toString(36).toUpperCase();
      await db.batch([
        db.prepare('INSERT INTO users(id, email, name, phone, role, plan, provider, provider_id, biz_type, store_name, agency_name, tokens, referral_code, login_id, password_hash, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, email, '대표님', '', 'admin', 'c', 'dev', null, '', '', '', 125000, referralCode, loginId, null, nowIso, nowIso),
        db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)').bind(id, 'earn', 125000, 125000, '개발용 테스트 세션 지급', 'dev')
      ]);
      user = { id: id, email: email, name: '대표님', phone: '', role: 'admin', plan: 'c', provider: 'dev', login_id: loginId, tokens: 125000 };
    } else {
      await db.prepare('UPDATE users SET role=?, plan=?, provider=?, tokens=?, updated_at=? WHERE id=?').bind('admin', 'c', 'dev', 125000, nowIso, user.id).run();
      user.role = 'admin'; user.plan = 'c'; user.provider = 'dev'; user.tokens = 125000;
    }
    var token = await issueUserToken(user, env);
    return jsonResp({ ok: true, token: token, user: { id: user.id, email: user.email || '', name: user.name || '대표님', phone: user.phone || '', role: user.role || 'admin', plan: user.plan || 'c', provider: user.provider || 'dev', login_id: user.login_id || loginId, snowball: user.tokens || 125000 } });
  } catch (e) {
    console.error('DEV_SESSION_handle failed:', e);
    return jsonResp({ ok: false, error: e.message || 'DEV_SESSION failed' }, 500);
  }
}
