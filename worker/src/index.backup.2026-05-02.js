/**
 * SHERPAIN21 - Worker API (v2.1 통합)
 *
 * [기존 유지] 순위 조회 + 트래커 + 키워드 + 상세 + 리뷰 대시보드 + 이메일 인증
 *             + 유튜브 + 부동산 + 트렌드 + AI + 소상공인 + 퍼페티어 + 스마트플레이스
 *
 * [v2.1 신규] 에스크로 미션 + 커뮤니티 게시판 + 출석체크 + 눈덩이 거래내역
 *             + 자유홍보 + 대시보드 통계
 *
 * [v2.1 변경] DB tokens 컬럼 유지, 코드에서 snowball로 매핑
 */
var KEEP_DAYS = 90;

// 오라클 프록시 설정 (2026-05-01 변경)
var ORACLE_PUPPETEER_URL = 'http://152.69.239.221:3000';
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
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecodeUtf8(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  var binary = atob(str);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function signJWT(payload, secret) {
  var header = { alg: 'HS256', typ: 'JWT' };
  var enc = new TextEncoder();

  var segments = [
    base64UrlEncodeUtf8(JSON.stringify(header)),
    base64UrlEncodeUtf8(JSON.stringify(payload))
  ];

  var key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  var sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(segments.join('.'))
  );

  var sigStr = btoa(String.fromCharCode.apply(null, new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return segments.join('.') + '.' + sigStr;
}
async function verifyJWT(token, secret) {
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;

    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    var sigBase64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    while (sigBase64.length % 4) sigBase64 += '=';
    var sigBuf = Uint8Array.from(atob(sigBase64), function (c) {
      return c.charCodeAt(0);
    });

    var valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuf,
      enc.encode(parts[0] + '.' + parts[1])
    );

    if (!valid) return null;

    var payload = JSON.parse(base64UrlDecodeUtf8(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch (e) {
    return null;
  }
}
async function optionalAuth(request, env) {
  var auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || !env.JWT_SECRET) return null;
  return verifyJWT(auth.slice(7), env.JWT_SECRET);
}
async function requireAuth(request, env) {
  var payload = await optionalAuth(request, env);
  return payload;
}

// ════════════════════════════════════════
// PASSWORD HASH
// ════════════════════════════════════════
async function sha256Hex(text) {
  var enc = new TextEncoder();
  var buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  var arr = Array.from(new Uint8Array(buf));
  return arr.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}
async function hashPassword(password) {
  return sha256Hex('sherpain::' + password);
}
async function issueUserToken(user, env) {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  var nowSec = Math.floor(Date.now() / 1000);
  return signJWT({
    sub: user.id,
    role: user.role || 'general',
    plan: user.plan || 'a',
    name: user.name || '',
    iat: nowSec,
    exp: nowSec + (60 * 60 * 24 * 14)
  }, env.JWT_SECRET);
}

// ════════════════════════════════════════
// SNOWBALL HELPERS (v2.1)
// DB 컬럼은 tokens, 코드에서 snowball로 매핑
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
    db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type, ref_id) VALUES(?,?,?,?,?,?,?)')
      .bind(userId, 'use', -amount, newBalance, description, refType || null, refId || null)
  ]);
  return newBalance;
}

async function addSnowball(db, userId, amount, type, description, refType, refId) {
  var balance = await getSnowballBalance(db, userId);
  var newBalance = balance + amount;
  await db.batch([
    db.prepare('UPDATE users SET tokens=?, updated_at=? WHERE id=?').bind(newBalance, new Date().toISOString(), userId),
    db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type, ref_id) VALUES(?,?,?,?,?,?,?)')
      .bind(userId, type || 'earn', amount, newBalance, description, refType || null, refId || null)
  ]);
  return newBalance;
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
  if (referralCode) {
    var referrer = await db.prepare('SELECT id FROM users WHERE referral_code=?').bind(referralCode).first();
    if (referrer) initialTokens = 1000;
  }

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

    var id = uuid();
    var passwordHash = await hashPassword(password);
    var nowIso = new Date().toISOString();
    var myReferralCode = 'S' + Date.now().toString(36).toUpperCase();

    await db.prepare(
      'INSERT INTO users(id, email, name, phone, role, plan, provider, provider_id, biz_type, store_name, agency_name, tokens, referral_code, login_id, password_hash, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(id, email, name, phone, role, 'a', 'email', null, bizType, storeName, agencyName, initialTokens, myReferralCode, loginId, passwordHash, nowIso, nowIso).run();

    await db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)')
      .bind(id, 'earn', initialTokens, initialTokens, referralCode ? '추천인 가입 보너스' : '가입 축하 보너스', 'signup').run();

    var user = { id: id, email: email, name: name, role: role, plan: 'a', provider: 'email', login_id: loginId, snowball: initialTokens };
    var token = await issueUserToken(user, env);
    return jsonResp({ ok: true, token: token, user: user });
  }

  var demoId = uuid();
  var nowIso2 = new Date().toISOString();
  var demoReferralCode = 'S' + Date.now().toString(36).toUpperCase();
  await db.prepare(
    'INSERT INTO users(id, email, name, phone, role, plan, provider, provider_id, biz_type, store_name, agency_name, tokens, referral_code, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(demoId, '', name, phone, role, 'a', 'demo', null, bizType, storeName, agencyName, initialTokens, demoReferralCode, nowIso2, nowIso2).run();

  await db.prepare('INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)')
    .bind(demoId, 'earn', initialTokens, initialTokens, '가입 축하 보너스', 'signup').run();

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

  var user = await db.prepare(
    'SELECT id, email, name, phone, role, plan, provider, login_id, password_hash, tokens FROM users WHERE login_id=? OR email=? LIMIT 1'
  ).bind(loginId, loginId.toLowerCase()).first();

  if (!user || !user.password_hash) {
    return jsonResp({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  var pwHash = await hashPassword(password);
  if (pwHash !== user.password_hash) {
    return jsonResp({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  var token = await issueUserToken(user, env);
  return jsonResp({
    ok: true,
    token: token,
    user: {
      id: user.id, email: user.email || '', name: user.name || '',
      phone: user.phone || '', role: user.role || 'general',
      plan: user.plan || 'a', provider: user.provider || 'email',
      login_id: user.login_id || '', snowball: user.tokens || 0
    }
  });
}

async function handleAuthMe(request, env) {
  var payload = await optionalAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);

  var db = env.DB;
  if (!db) return jsonResp({ ok: false, error: 'DB not configured' }, 500);

  var user = await db.prepare(
    'SELECT id, email, name, phone, role, plan, provider, login_id, biz_type, store_name, agency_name, tokens, referral_code FROM users WHERE id=? LIMIT 1'
  ).bind(payload.sub).first();

  if (!user) return jsonResp({ ok: false, error: 'User not found' }, 404);

  var result = Object.assign({}, user);
  result.snowball = user.tokens || 0;

  return jsonResp({ ok: true, user: result });
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
        restaurantListInput: {
          query: keyword, x: String(x), y: String(y), start: start, display: display,
          deviceType: dt, isPcmap: true, takeout: null, orderBenefit: null,
          filterOpening: null, order: null, isNmap: false
        },
        isNmap: false
      },
      query: 'query getRestaurantList($restaurantListInput: RestaurantListInput, $isNmap: Boolean!) {\n  restaurants: restaurantList(input: $restaurantListInput) {\n    items {\n      apolloCacheId\n      coupon {\n        total\n        promotions {\n          promotionSeq\n          couponSeq\n          conditionType\n          title\n          description\n          type\n          couponUseType\n          __typename\n        }\n        __typename\n      }\n      id\n      dbType\n      name\n      businessCategory\n      category\n      description\n      hasBooking\n      hasNPay\n      x\n      y\n      distance\n      imageUrl\n      imageCount\n      phone\n      virtualPhone\n      routeUrl\n      roadAddress\n      address\n      commonAddress\n      blogCafeReviewCount\n      bookingReviewCount\n      totalReviewCount\n      bookingUrl\n      bookingBusinessId\n      talktalkUrl\n      options\n      promotionTitle\n      agencyId\n      businessHours\n      newOpening\n      markerId @include(if: $isNmap)\n      fullAddress\n      visitorReviewCount\n      visitorReviewScore\n      imageUrls\n      bookingHubUrl\n      bookingHubButtonName\n      visitorReviews {\n        id\n        review\n        reviewId\n        __typename\n      }\n      microReview\n      priceCategory\n      saveCount\n      naverOrder {\n        items {\n          id\n          type\n          __typename\n        }\n        isDelivery\n        isTableOrder\n        isPreOrder\n        isPickup\n        __typename\n      }\n      popularMenuImages {\n        name\n        price\n        bookingCount\n        menuUrl\n        imageUrl\n        isPopular\n        __typename\n      }\n      newBusinessHours {\n        status\n        description\n        __typename\n      }\n      broadcastInfo {\n        program\n        date\n        menu\n        __typename\n      }\n      realTimeBookingInfo {\n        description\n        hasMultipleBookingItems\n        bookingBusinessId\n        bookingUrl\n        itemId\n        itemName\n        __typename\n      }\n      __typename\n    }\n    nlu {\n      queryType\n      queryResult {\n        ptn0\n        ptn1\n        region\n        spot\n        tradeName\n        service\n        selectedRegion {\n          name\n          index\n          x\n          y\n          __typename\n        }\n        property\n        keyword\n        queryType\n        nluQuery\n        businessType\n        cid\n        branch\n        franchise\n        titleKeyword\n        location {\n          x\n          y\n          default\n          longitude\n          latitude\n          dong\n          si\n          __typename\n        }\n        noRegionQuery\n        priority\n        themeId\n        filterBooking\n        repRegion\n        repSpot\n        type\n        category\n        menu\n        context\n        themes\n        __typename\n      }\n      __typename\n    }\n    total\n    __typename\n  }\n}'
    };
  }
  if (kind === 'hairshop') {
    return { operationName: 'getBeautyList', variables: { useReverseGeocode: false, input: { query: keyword, display: display, start: start, filterBooking: false, filterCoupon: false, filterNpay: false, filterOpening: false, filterBookingPromotion: false, filterWheelchairEntrance: false, naverBenefit: false, sortingOrder: 'precision', x: String(x), y: String(y), deviceType: dt, bypassStyleClous: false }, businessType: 'hairshop', isNmap: false, isBounds: false }, query: 'query getBeautyList($input: BeautyListInput, $businessType: String, $isNmap: Boolean!, $isBounds: Boolean!, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {\n  businesses: hairshopList(input: $input) {\n    total\n    items {\n      id\n      apolloCacheId\n      name\n      hasBooking\n      hasNPay\n      blogCafeReviewCount\n      bookingReviewCount\n      bookingReviewScore\n      roadAddress\n      address\n      imageUrl\n      distance\n      x\n      y\n      visitorReviewCount\n      visitorReviewScore\n      newOpening\n      category\n      businessCategory\n      hasWheelchairEntrance\n      markerId @include(if: $isNmap)\n      __typename\n    }\n    optionsForMap @include(if: $isBounds) {\n      maxZoom\n      minZoom\n      __typename\n    }\n    queryString\n    __typename\n  }\n  brands: beautyBrands(input: $input, businessType: $businessType) {\n    name\n    cid\n    __typename\n  }\n  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {\n    rcode\n    region\n    __typename\n  }\n}' };
  }
  if (kind === 'nailshop') {
    return { operationName: 'getBeautyList', variables: { useReverseGeocode: false, input: { query: keyword, display: display, start: start, filterBooking: false, filterCoupon: false, filterNpay: false, filterOpening: false, filterBookingPromotion: false, filterWheelchairEntrance: false, naverBenefit: false, sortingOrder: 'precision', x: String(x), y: String(y), deviceType: dt, bypassStyleClous: false }, businessType: 'nailshop', isNmap: false, isBounds: false }, query: 'query getBeautyList($input: BeautyListInput, $businessType: String, $isNmap: Boolean!, $isBounds: Boolean!, $reverseGeocodingInput: ReverseGeocodingInput, $useReverseGeocode: Boolean = false) {\n  businesses: nailshopList(input: $input) {\n    total\n    items {\n      id\n      apolloCacheId\n      name\n      hasBooking\n      hasNPay\n      blogCafeReviewCount\n      bookingReviewCount\n      bookingReviewScore\n      roadAddress\n      address\n      imageUrl\n      distance\n      x\n      y\n      visitorReviewCount\n      visitorReviewScore\n      newOpening\n      category\n      businessCategory\n      hasWheelchairEntrance\n      markerId @include(if: $isNmap)\n      __typename\n    }\n    optionsForMap @include(if: $isBounds) {\n      maxZoom\n      minZoom\n      __typename\n    }\n    queryString\n    __typename\n  }\n  brands: beautyBrands(input: $input, businessType: $businessType) {\n    name\n    cid\n    __typename\n  }\n  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {\n    rcode\n    region\n    __typename\n  }\n}' };
  }
  if (kind === 'hospital') {
    return { operationName: 'getNxList', variables: { isNmap: false, isBounds: false, useReverseGeocode: false, input: { query: keyword, display: display, start: start, filterBooking: false, filterOpentime: false, filterSpecialist: false, filterWheelchairEntrance: false, sortingOrder: 'precision', x: String(x), y: String(y), day: null, deviceType: dt } }, query: 'query getNxList($input: HospitalListInput, $isNmap: Boolean!, $isBounds: Boolean!, $useReverseGeocode: Boolean!, $reverseGeocodingInput: ReverseGeocodingInput) {\n  businesses: hospitals(input: $input) {\n    total\n    items {\n      id\n      name\n      hasBooking\n      hasNPay\n      blogCafeReviewCount\n      bookingReviewCount\n      visitorReviewCount\n      visitorReviewScore\n      imageCount\n      distance\n      category\n      imageUrl\n      x\n      y\n      businessCategory\n      roadAddress\n      address\n      fullAddress\n      commonAddress\n      newOpening\n      hasWheelchairEntrance\n      apolloCacheId\n      markerId @include(if: $isNmap)\n      __typename\n    }\n    optionsForMap @include(if: $isBounds) {\n      maxZoom\n      minZoom\n      __typename\n    }\n    queryString\n    __typename\n  }\n  reverseGeocodingAddr(input: $reverseGeocodingInput) @include(if: $useReverseGeocode) {\n    rcode\n    region\n    __typename\n  }\n}' };
  }
  if (kind === 'accommodation') {
    return { operationName: 'searchAccommodation', variables: { input: { query: keyword, display: display, start: start, x: String(x), y: String(y), sortingOrder: 'precision', deviceType: dt, minPrice: null, maxPrice: null, pay: 'true', npay: 'true' }, isNmap: false, isBounds: false }, query: 'query searchAccommodation($input: AccommodationSearchInput, $isNmap: Boolean!, $isBounds: Boolean!) {\n  accommodationSearch(input: $input) {\n    business {\n      total\n      items {\n        id\n        dbType\n        name\n        businessCategory\n        category\n        hasBooking\n        hasNPay\n        x\n        y\n        distance\n        imageUrl\n        imageCount\n        roadAddress\n        address\n        commonAddress\n        blogCafeReviewCount\n        bookingReviewCount\n        totalReviewCount\n        microReview\n        placeReviewCount\n        placeReviewScore\n        bookingReviewScore\n        newOpening\n        markerId @include(if: $isNmap)\n        __typename\n      }\n      optionsForMap @include(if: $isBounds) {\n        maxZoom\n        minZoom\n        __typename\n      }\n      queryString\n      __typename\n    }\n    __typename\n  }\n}' };
  }
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
  return { id: item.id, name: item.name || '', category: item.category || '', businessCategory: item.businessCategory || '', description: item.description || '', blogCafeReviewCount: parseCount(item.blogCafeReviewCount), visitorReviewCount: parseCount(item.visitorReviewCount || item.placeReviewCount || item.totalReviewCount), visitorReviewScore: item.visitorReviewScore || item.placeReviewScore || item.bookingReviewScore || null, saveCount: parseCount(item.saveCount), imageCount: parseCount(item.imageCount), microReview: item.microReview || '', imageUrl: item.imageUrl || '', roadAddress: item.roadAddress || item.address || '', commonAddress: item.commonAddress || '', fullAddress: item.fullAddress || '', distance: item.distance || null, phone: item.phone || '', priceCategory: item.priceCategory || '', hasBooking: !!(item.hasBooking || item.bookingUrl || item.bookingHubUrl), hasNPay: !!item.hasNPay, hasTalk: !!item.talktalkUrl, hasOrder: naverOrderItems.length > 0, couponTotal: couponTotal, newOpening: !!item.newOpening, promotionTitle: item.promotionTitle || '', options: Array.isArray(item.options) ? item.options.join(' ') : String(item.options || ''), previewReviewText: previewReviewText.trim(), popularMenuNames: popularMenuNames.trim(), newBusinessHoursStatus: newBizHours.status || '', newBusinessHoursDesc: newBizHours.description || '', broadcastProgram: broadcastInfo.program || '', bookingBusinessId: item.bookingBusinessId || '' };
}

async function naverFetchResults(kind, keyword, start, display, x, y, deviceType) {
  var MAX_RETRIES = 2;
  var RETRY_DELAYS = [3000, 6000];

  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      var gql = buildGraphQL(kind || 'restaurant', keyword, start, display, x, y, deviceType || 'pc');

      // 오라클 프록시 경유 (IP 차단 우회)
      var resp = await fetch(ORACLE_PUPPETEER_URL + '/naver/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ORACLE_API_KEY
        },
        body: JSON.stringify([gql])
      });

      var ct = resp.headers.get('content-type') || '';
      var text = await resp.text();

      if (resp.status === 429 || !ct.includes('application/json') || text.trim().startsWith('<!')) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
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
      return {
        items: extracted.items.map(function(it) { return normalizeItem(kind, it); }),
        total: extracted.total,
        nlu: extracted.nlu || null
      };

    } catch (e) {
      if (attempt < MAX_RETRIES && (e.message === 'BLOCKED_OR_RATE_LIMITED' || !e.upstreamStatus)) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw e;
    }
  }
}

// ════════════════════════════════════════
// D1 AUTO MIGRATION (v2.1 확장)
// ════════════════════════════════════════
async function autoMigrate(db) {
  try {
    var info = await db.prepare('PRAGMA table_info(tracks)').all();
    var cols = info.results.map(function(r) { return r.name; });
    if (cols.indexOf('kind') === -1) await db.exec("ALTER TABLE tracks ADD COLUMN kind TEXT DEFAULT 'restaurant'");
    if (cols.indexOf('target_name') === -1) await db.exec('ALTER TABLE tracks ADD COLUMN target_name TEXT');
  } catch (e) {}

  try {
    var uinfo = await db.prepare('PRAGMA table_info(users)').all();
    var ucols = uinfo.results.map(function(r) { return r.name; });
    if (ucols.indexOf('login_id') === -1) await db.exec('ALTER TABLE users ADD COLUMN login_id TEXT');
    if (ucols.indexOf('password_hash') === -1) await db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
    if (ucols.indexOf('referral_code') === -1) await db.exec('ALTER TABLE users ADD COLUMN referral_code TEXT');
  } catch (e) {}

  try {
    await db.exec("CREATE TABLE IF NOT EXISTS snowball_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, description TEXT, ref_type TEXT, ref_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  } catch (e) {}
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS escrow_missions (id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, mission_type TEXT DEFAULT 'review', category TEXT, location TEXT, place_id TEXT, place_name TEXT, reward_per_person INTEGER NOT NULL, max_applicants INTEGER DEFAULT 1, total_deposit INTEGER NOT NULL, platform_fee INTEGER NOT NULL, deadline DATETIME, requirements TEXT, status TEXT DEFAULT 'open', is_locked INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  } catch (e) {}
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS escrow_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, mission_id INTEGER NOT NULL, applicant_id TEXT NOT NULL, status TEXT DEFAULT 'pending', submission_url TEXT, submission_note TEXT, submitted_at DATETIME, approved_at DATETIME, payout_amount INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  } catch (e) {}
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, board TEXT NOT NULL DEFAULT 'community', category TEXT, title TEXT NOT NULL, content TEXT NOT NULL, view_count INTEGER DEFAULT 0, like_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  } catch (e) {}
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_id TEXT NOT NULL, parent_id INTEGER, content TEXT NOT NULL, like_count INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  } catch (e) {}
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, check_date TEXT NOT NULL, reward INTEGER DEFAULT 0, streak INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  } catch (e) {}
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS free_promotions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, link_url TEXT, image_url TEXT, category TEXT, view_count INTEGER DEFAULT 0, cost INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  } catch (e) {}
}

// ════════════════════════════════════════
// TRACKER CORE
// ════════════════════════════════════════
async function collectTrack(db, tr) {
  var baseDate = kstDateString(); var collectedAt = kstNowString();
  var exists = await db.prepare('SELECT id FROM snapshots WHERE track_id=? AND base_date=?').bind(tr.id, baseDate).first();
  if (exists) return { skipped: true, baseDate: baseDate };
  var kind = tr.kind || 'restaurant';
  var result = await naverFetchResults(kind, tr.keyword, 1, 50, tr.x, tr.y, tr.device_type || 'pc');
  var items = result.items; var total = result.total;
  var targetRank = null;
  for (var i = 0; i < items.length; i++) { if (String(items[i].id) === String(tr.target_place_id)) { targetRank = i + 1; break; } }
  var ins = await db.prepare('INSERT INTO snapshots(track_id, base_date, collected_at, total, target_rank) VALUES(?,?,?,?,?)').bind(tr.id, baseDate, collectedAt, total, targetRank).run();
  var snapshotId = ins.meta.last_row_id;
  var stmts = [];
  for (var j = 0; j < items.length; j++) { var it = items[j]; stmts.push(db.prepare('INSERT INTO snapshot_items(snapshot_id, rank, place_id, name, category, businessCategory, blog_count, visitor_count, save_count, score, image_count, microReview) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(snapshotId, j+1, String(it.id), it.name, it.category, it.businessCategory, it.blogCafeReviewCount||0, it.visitorReviewCount||0, it.saveCount||0, it.visitorReviewScore!=null?String(it.visitorReviewScore):null, it.imageCount||0, it.microReview||null)); }
  if (stmts.length > 0) await db.batch(stmts);
  return { ok: true, baseDate: baseDate, total: total, count: items.length, targetRank: targetRank };
}

async function cleanupOld(db) {
  var cutoff = new Date(Date.now() - KEEP_DAYS * 86400000); var cutoffStr = cutoff.toISOString().slice(0, 10);
  var old = await db.prepare('SELECT id FROM snapshots WHERE base_date < ?').bind(cutoffStr).all();
  var ids = old.results.map(function(r) { return r.id; }); if (ids.length === 0) return;
  for (var i = 0; i < ids.length; i += 50) { var chunk = ids.slice(i, i + 50); var qs = chunk.map(function() { return '?'; }).join(','); await db.prepare('DELETE FROM snapshot_items WHERE snapshot_id IN (' + qs + ')').bind(...chunk).run(); await db.prepare('DELETE FROM snapshots WHERE id IN (' + qs + ')').bind(...chunk).run(); }
}

// ════════════════════════════════════════
// v2.1 신규: 에스크로 미션
// ════════════════════════════════════════

async function handleEscrowCreate(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }

  var title = String(body.title || '').trim();
  var description = String(body.description || '').trim();
  var missionType = String(body.mission_type || 'review').trim();
  var category = String(body.category || '').trim();
  var location = String(body.location || '').trim();
  var placeId = body.place_id ? String(body.place_id).trim() : null;
  var placeName = body.place_name ? String(body.place_name).trim() : null;
  var rewardPerPerson = parseInt(body.reward_per_person);
  var maxApplicants = parseInt(body.max_applicants) || 1;
  var deadline = body.deadline ? String(body.deadline).trim() : null;
  var requirements = body.requirements ? String(body.requirements).trim() : null;

  if (!title) return jsonResp({ ok: false, error: 'title required' }, 400);
  if (!rewardPerPerson || rewardPerPerson < 100) return jsonResp({ ok: false, error: 'reward_per_person must be >= 100' }, 400);
  if (maxApplicants < 1 || maxApplicants > 100) return jsonResp({ ok: false, error: 'max_applicants must be 1~100' }, 400);

  var subtotal = rewardPerPerson * maxApplicants;
  var platformFee = Math.ceil(subtotal * 0.1);
  var totalDeposit = subtotal + platformFee;

  var balance = await getSnowballBalance(db, payload.sub);
  if (balance < totalDeposit) {
    return jsonResp({ ok: false, error: '눈덩이가 부족합니다.', required: totalDeposit, balance: balance }, 400);
  }

  var nowIso = new Date().toISOString();
  var newBalance = balance - totalDeposit;

  var insertMission = db.prepare(
    'INSERT INTO escrow_missions(requester_id, title, description, mission_type, category, location, place_id, place_name, reward_per_person, max_applicants, total_deposit, platform_fee, deadline, requirements, status, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(payload.sub, title, description, missionType, category, location, placeId, placeName, rewardPerPerson, maxApplicants, totalDeposit, platformFee, deadline, requirements, 'open', nowIso, nowIso);

  var updateBalance = db.prepare('UPDATE users SET tokens=?, updated_at=? WHERE id=?').bind(newBalance, nowIso, payload.sub);

  var logDeposit = db.prepare(
    'INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)'
  ).bind(payload.sub, 'escrow_deposit', -totalDeposit, newBalance, '에스크로 미션 예치 (수수료 포함)', 'escrow');

  await db.batch([insertMission, updateBalance, logDeposit]);

  return jsonResp({ ok: true, totalDeposit: totalDeposit, platformFee: platformFee, newBalance: newBalance });
}

async function handleEscrowList(request, env) {
  var db = env.DB;
  var url = new URL(request.url);
  var status = url.searchParams.get('status') || 'open';
  var page = parseInt(url.searchParams.get('page')) || 1;
  var limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50);
  var offset = (page - 1) * limit;

  var missions = await db.prepare(
    'SELECT m.*, u.name AS requester_name FROM escrow_missions m LEFT JOIN users u ON u.id = m.requester_id WHERE m.status=? ORDER BY m.created_at DESC LIMIT ? OFFSET ?'
  ).bind(status, limit, offset).all();

  var countResult = await db.prepare('SELECT COUNT(*) as cnt FROM escrow_missions WHERE status=?').bind(status).first();

  return jsonResp({ ok: true, missions: missions.results, total: countResult.cnt, page: page, limit: limit });
}

async function handleEscrowDetail(request, env) {
  var db = env.DB;
  var url = new URL(request.url);
  var id = url.searchParams.get('id');
  if (!id) return jsonResp({ ok: false, error: 'id required' }, 400);

  var mission = await db.prepare(
    'SELECT m.*, u.name AS requester_name FROM escrow_missions m LEFT JOIN users u ON u.id = m.requester_id WHERE m.id=?'
  ).bind(id).first();
  if (!mission) return jsonResp({ ok: false, error: 'Mission not found' }, 404);

  var apps = await db.prepare(
    'SELECT a.*, u.name AS applicant_name FROM escrow_applications a LEFT JOIN users u ON u.id = a.applicant_id WHERE a.mission_id=? ORDER BY a.created_at ASC'
  ).bind(id).all();

  return jsonResp({ ok: true, mission: mission, applications: apps.results });
}

async function handleEscrowApply(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }

  var missionId = parseInt(body.mission_id);
  if (!missionId) return jsonResp({ ok: false, error: 'mission_id required' }, 400);

  var mission = await db.prepare('SELECT * FROM escrow_missions WHERE id=?').bind(missionId).first();
  if (!mission) return jsonResp({ ok: false, error: 'Mission not found' }, 404);
  if (mission.status !== 'open') return jsonResp({ ok: false, error: '미션이 마감되었습니다.' }, 400);
  if (mission.is_locked) return jsonResp({ ok: false, error: '미션이 잠금 상태입니다.' }, 400);
  if (mission.requester_id === payload.sub) return jsonResp({ ok: false, error: '본인의 미션에는 신청할 수 없습니다.' }, 400);

  var existing = await db.prepare('SELECT id FROM escrow_applications WHERE mission_id=? AND applicant_id=?').bind(missionId, payload.sub).first();
  if (existing) return jsonResp({ ok: false, error: '이미 신청한 미션입니다.' }, 409);

  var nowIso = new Date().toISOString();
  await db.prepare('INSERT INTO escrow_applications(mission_id, applicant_id, status, created_at, updated_at) VALUES(?,?,?,?,?)').bind(missionId, payload.sub, 'pending', nowIso, nowIso).run();

  var appCount = await db.prepare('SELECT COUNT(*) as cnt FROM escrow_applications WHERE mission_id=? AND status IN (?,?,?)').bind(missionId, 'pending', 'accepted', 'submitted').first();
  if (appCount.cnt >= mission.max_applicants) {
    await db.prepare('UPDATE escrow_missions SET is_locked=1, status=?, updated_at=? WHERE id=?').bind('in_progress', nowIso, missionId).run();
  }

  return jsonResp({ ok: true });
}

async function handleEscrowApprove(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }

  var applicationId = parseInt(body.application_id);
  if (!applicationId) return jsonResp({ ok: false, error: 'application_id required' }, 400);

  var app = await db.prepare('SELECT a.*, m.requester_id, m.reward_per_person, m.platform_fee, m.max_applicants, m.id AS mid FROM escrow_applications a JOIN escrow_missions m ON m.id = a.mission_id WHERE a.id=?').bind(applicationId).first();
  if (!app) return jsonResp({ ok: false, error: 'Application not found' }, 404);
  if (app.requester_id !== payload.sub) return jsonResp({ ok: false, error: '본인의 미션만 승인할 수 있습니다.' }, 403);
  if (app.status !== 'submitted') return jsonResp({ ok: false, error: '제출된 미션만 승인할 수 있습니다.' }, 400);

  var payoutAmount = app.reward_per_person;
  var nowIso = new Date().toISOString();

  var newBalance = await addSnowball(db, app.applicant_id, payoutAmount, 'escrow_payout', '에스크로 미션 #' + app.mid + ' 정산', 'escrow', String(app.mid));

  await db.prepare('UPDATE escrow_applications SET status=?, approved_at=?, payout_amount=?, updated_at=? WHERE id=?').bind('approved', nowIso, payoutAmount, nowIso, applicationId).run();

  var pendingCount = await db.prepare("SELECT COUNT(*) as cnt FROM escrow_applications WHERE mission_id=? AND status NOT IN ('approved','rejected','cancelled')").bind(app.mid).first();
  if (pendingCount.cnt === 0) {
    await db.prepare("UPDATE escrow_missions SET status='completed', updated_at=? WHERE id=?").bind(nowIso, app.mid).run();
  }

  return jsonResp({ ok: true, payoutAmount: payoutAmount });
}

// ════════════════════════════════════════
// v2.1 신규: 커뮤니티 게시판
// ════════════════════════════════════════

async function handlePostList(request, env) {
  var db = env.DB;
  var url = new URL(request.url);
  var board = url.searchParams.get('board') || 'community';
  var page = parseInt(url.searchParams.get('page')) || 1;
  var limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50);
  var offset = (page - 1) * limit;

  var posts = await db.prepare(
    'SELECT p.id, p.board, p.category, p.title, p.view_count, p.like_count, p.comment_count, p.is_pinned, p.created_at, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.board=? AND p.is_deleted=0 ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?'
  ).bind(board, limit, offset).all();

  var countResult = await db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE board=? AND is_deleted=0').bind(board).first();

  return jsonResp({ ok: true, posts: posts.results, total: countResult.cnt, page: page, limit: limit });
}

async function handlePostDetail(request, env) {
  var db = env.DB;
  var url = new URL(request.url);
  var id = url.searchParams.get('id');
  if (!id) return jsonResp({ ok: false, error: 'id required' }, 400);

  var post = await db.prepare('SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id=? AND p.is_deleted=0').bind(id).first();
  if (!post) return jsonResp({ ok: false, error: 'Post not found' }, 404);

  await db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id=?').bind(id).run();

  var comments = await db.prepare('SELECT c.*, u.name AS author_name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.post_id=? AND c.is_deleted=0 ORDER BY c.created_at ASC').bind(id).all();

  return jsonResp({ ok: true, post: post, comments: comments.results });
}

async function handlePostCreate(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }

  var board = String(body.board || 'community').trim();
  var category = body.category ? String(body.category).trim() : null;
  var title = String(body.title || '').trim();
  var content = String(body.content || '').trim();

  if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400);

  var nowIso = new Date().toISOString();
  var result = await db.prepare(
    'INSERT INTO posts(user_id, board, category, title, content, created_at, updated_at) VALUES(?,?,?,?,?,?,?)'
  ).bind(payload.sub, board, category, title, content, nowIso, nowIso).run();

  return jsonResp({ ok: true, id: result.meta.last_row_id });
}

async function handleCommentCreate(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }

  var postId = parseInt(body.post_id);
  var content = String(body.content || '').trim();
  var parentId = body.parent_id ? parseInt(body.parent_id) : null;

  if (!postId || !content) return jsonResp({ ok: false, error: 'post_id and content required' }, 400);

  var nowIso = new Date().toISOString();
  await db.batch([
    db.prepare('INSERT INTO comments(post_id, user_id, parent_id, content, created_at) VALUES(?,?,?,?,?)').bind(postId, payload.sub, parentId, content, nowIso),
    db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id=?').bind(postId)
  ]);

  return jsonResp({ ok: true });
}

// ════════════════════════════════════════
// v2.1 신규: 출석체크
// ════════════════════════════════════════

async function handleAttendanceCheck(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var today = kstDateString();

  var existing = await db.prepare('SELECT id FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, today).first();
  if (existing) return jsonResp({ ok: false, error: '오늘은 이미 출석했습니다.' }, 409);

  var yesterday = new Date(Date.now() + 9*60*60*1000 - 86400000).toISOString().slice(0, 10);
  var yesterdayRecord = await db.prepare('SELECT streak FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, yesterday).first();
  var streak = yesterdayRecord ? (yesterdayRecord.streak + 1) : 1;

  var reward = 10;
  if (streak >= 30) reward = 50;
  else if (streak >= 14) reward = 30;
  else if (streak >= 7) reward = 20;

  var newBalance = await addSnowball(db, payload.sub, reward, 'earn', '출석체크 보상 (연속 ' + streak + '일)', 'attendance', today);

  await db.prepare('INSERT INTO attendance(user_id, check_date, reward, streak) VALUES(?,?,?,?)').bind(payload.sub, today, reward, streak).run();

  return jsonResp({ ok: true, streak: streak, reward: reward, newBalance: newBalance });
}

async function handleAttendanceStatus(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var today = kstDateString();
  var todayRecord = await db.prepare('SELECT * FROM attendance WHERE user_id=? AND check_date=?').bind(payload.sub, today).first();

  var monthStart = today.substring(0, 7) + '-01';
  var monthRecords = await db.prepare('SELECT check_date, reward, streak FROM attendance WHERE user_id=? AND check_date>=? ORDER BY check_date ASC').bind(payload.sub, monthStart).all();

  return jsonResp({
    ok: true,
    checkedToday: !!todayRecord,
    currentStreak: todayRecord ? todayRecord.streak : 0,
    monthRecords: monthRecords.results
  });
}

// ════════════════════════════════════════
// v2.1 신규: 눈덩이 거래내역
// ════════════════════════════════════════

async function handleSnowballHistory(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var url = new URL(request.url);
  var page = parseInt(url.searchParams.get('page')) || 1;
  var limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 50);
  var offset = (page - 1) * limit;
  var type = url.searchParams.get('type');

  var query = 'SELECT * FROM snowball_transactions WHERE user_id=?';
  var countQuery = 'SELECT COUNT(*) as cnt FROM snowball_transactions WHERE user_id=?';
  var binds = [payload.sub];

  if (type) {
    query += ' AND type=?';
    countQuery += ' AND type=?';
    binds.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  var transactions = await db.prepare(query).bind(...binds, limit, offset).all();
  var countResult = await db.prepare(countQuery).bind(...binds).first();

  var balance = await getSnowballBalance(db, payload.sub);

  return jsonResp({ ok: true, transactions: transactions.results, total: countResult.cnt, balance: balance, page: page, limit: limit });
}

// ════════════════════════════════════════
// v2.1 신규: 대시보드 통계
// ════════════════════════════════════════

async function handleDashboardStats(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  var db = env.DB;

  var user = await db.prepare('SELECT plan, tokens FROM users WHERE id=?').bind(payload.sub).first();
  if (!user) return jsonResp({ ok: false, error: 'User not found' }, 404);

  var missionCount = await db.prepare(
    "SELECT COUNT(*) as cnt FROM escrow_missions WHERE requester_id=? AND status IN ('open','in_progress')"
  ).bind(payload.sub).first();

  var appCount = await db.prepare(
    "SELECT COUNT(*) as cnt FROM escrow_applications WHERE applicant_id=? AND status IN ('pending','accepted','submitted')"
  ).bind(payload.sub).first();

  var monthStart = kstDateString().substring(0, 7) + '-01';
  var attendCount = await db.prepare('SELECT COUNT(*) as cnt FROM attendance WHERE user_id=? AND check_date>=?').bind(payload.sub, monthStart).first();

  return jsonResp({
    ok: true,
    plan: user.plan,
    snowball: user.tokens || 0,
    activeMissions: (missionCount.cnt || 0) + (appCount.cnt || 0),
    monthAttendance: attendCount.cnt || 0
  });
}

// ════════════════════════════════════════
// NAVER SEARCH AD API
// ════════════════════════════════════════
function naverAdParseVol(val) { if (val === '< 10' || val === '<10') return 0; if (val == null || val === '') return 0; var n = Number(val); return isNaN(n) ? 0 : n; }

async function naverAdHeaders(method, uri, env) {
  if (!env.NAVER_AD_API_KEY || !env.NAVER_AD_SECRET_KEY || !env.NAVER_AD_CUSTOMER_ID) return null;
  var ts = String(Date.now()); var msg = ts + '.' + method + '.' + uri;
  var enc = new TextEncoder();
  var key = await crypto.subtle.importKey('raw', enc.encode(env.NAVER_AD_SECRET_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  var sigB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(sig)));
  return { 'Content-Type': 'application/json; charset=UTF-8', 'X-Timestamp': ts, 'X-API-KEY': env.NAVER_AD_API_KEY, 'X-Customer': String(env.NAVER_AD_CUSTOMER_ID), 'X-Signature': sigB64 };
}

async function naverAdKeywordData(keyword, env) {
  var uri = '/keywordstool'; var sk = keyword.replace(/\s/g, '');
  try { var h = await naverAdHeaders('GET', uri, env); if (!h) return { ok: false, error: 'NAVER_AD API keys not configured' }; var r = await fetch('https://api.searchad.naver.com' + uri + '?hintKeywords=' + encodeURIComponent(sk) + '&showDetail=1', { method: 'GET', headers: h }); if (!r.ok) return { ok: false, error: 'API error ' + r.status }; var d = await r.json(); return { ok: true, keywordList: d.keywordList || [] }; } catch (e) { return { ok: false, error: e.message }; }
}

async function naverAdPerformance(keyword, bids, device, env) {
  var uri = '/estimate/performance/keyword'; var sk = keyword.replace(/\s/g, '');
  try { var h = await naverAdHeaders('POST', uri, env); if (!h) return { ok: false, error: 'API keys not configured' }; var r = await fetch('https://api.searchad.naver.com' + uri, { method: 'POST', headers: h, body: JSON.stringify({ device: device, keywordplus: false, key: sk, bids: Array.isArray(bids) ? bids : [bids] }) }); if (!r.ok) return { ok: false, error: 'API error ' + r.status }; return { ok: true, data: await r.json() }; } catch (e) { return { ok: false, error: e.message }; }
}

async function naverAdRankBids(keyword, env) {
  var uri = '/estimate/average-position-bid/keyword'; var sk = keyword.replace(/\s/g, ''); var results = {}; var devices = ['MOBILE', 'PC'];
  for (var d = 0; d < devices.length; d++) { var dev = devices[d]; var items = []; for (var p = 1; p <= 5; p++) items.push({ key: sk, position: p });
    try { var h = await naverAdHeaders('POST', uri, env); if (!h) return { ok: false, error: 'API keys not configured' }; var r = await fetch('https://api.searchad.naver.com' + uri, { method: 'POST', headers: h, body: JSON.stringify({ device: dev, items: items }) }); if (!r.ok) return { ok: false, error: dev + ' API error ' + r.status }; var data = await r.json(); results[dev] = data.estimate || []; } catch (e) { return { ok: false, error: e.message }; } }
  var landscape = []; var me = results.MOBILE || [], pe = results.PC || [];
  for (var i = 0; i < Math.max(me.length, pe.length); i++) { var mb = me[i] ? me[i].bid || 0 : 0; var pb = pe[i] ? pe[i].bid || 0 : 0; if (mb > 0 || pb > 0) landscape.push({ rank: i + 1, mobileBid: mb, pcBid: pb }); }
  return { ok: true, bidLandscape: landscape };
}

async function handleKeywordVolumePost(request, env) {
  var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
  var keywords = body.keywords; var includeRelated = !!body.includeRelated;
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return jsonResp({ ok: false, error: 'keywords array required' }, 400);
  if (keywords.length > 100) keywords = keywords.slice(0, 100);
  var mainResults = [], relatedResults = [], seen = {};
  for (var i = 0; i < keywords.length; i++) { var kw = keywords[i]; var sk = kw.replace(/\s/g, '').toLowerCase(); seen[sk] = true; var res = await naverAdKeywordData(kw, env);
    if (!res.ok || res.keywordList.length === 0) { mainResults.push({ keyword: kw, monthlyPcQcCnt: 0, monthlyMobileQcCnt: 0, compIdx: '-' }); }
    else { var exact = null; for (var j = 0; j < res.keywordList.length; j++) { if (res.keywordList[j].relKeyword.replace(/\s/g, '').toLowerCase() === sk) { exact = res.keywordList[j]; break; } } var target = exact || res.keywordList[0]; mainResults.push({ keyword: kw, monthlyPcQcCnt: target.monthlyPcQcCnt, monthlyMobileQcCnt: target.monthlyMobileQcCnt, compIdx: target.compIdx || '-' });
      if (includeRelated) { for (var k = 0; k < res.keywordList.length; k++) { var rk = res.keywordList[k].relKeyword.replace(/\s/g, '').toLowerCase(); if (!seen[rk]) { seen[rk] = true; relatedResults.push({ keyword: res.keywordList[k].relKeyword, monthlyPcQcCnt: res.keywordList[k].monthlyPcQcCnt, monthlyMobileQcCnt: res.keywordList[k].monthlyMobileQcCnt, compIdx: res.keywordList[k].compIdx || '-', sourceKeyword: kw }); } } } } if (i < keywords.length - 1) await sleep(200); }
  relatedResults.sort(function(a, b) { return (naverAdParseVol(b.monthlyPcQcCnt) + naverAdParseVol(b.monthlyMobileQcCnt)) - (naverAdParseVol(a.monthlyPcQcCnt) + naverAdParseVol(a.monthlyMobileQcCnt)); });
  if (relatedResults.length > 200) relatedResults = relatedResults.slice(0, 200);
  return jsonResp({ ok: true, data: mainResults, related: includeRelated ? relatedResults : [], total: mainResults.length, relatedTotal: relatedResults.length });
}

async function handleAdAnalyze(request, env) {
  var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }
  var mode = body.mode; if (!mode) return jsonResp({ ok: false, error: 'mode required (custom|full|rank|bulk)' }, 400);

  if (mode === 'rank') { var keyword = body.keyword; if (!keyword) return jsonResp({ ok: false, error: 'keyword required' }, 400); var kwRes = await naverAdKeywordData(keyword, env); var bidRes = await naverAdRankBids(keyword, env); if (!bidRes.ok) return jsonResp({ ok: false, error: bidRes.error }, 502); var kwInfo = null; if (kwRes.ok && kwRes.keywordList.length > 0) { var kd = kwRes.keywordList[0]; kwInfo = { keyword: keyword, monthlyPcQcCnt: kd.monthlyPcQcCnt, monthlyMobileQcCnt: kd.monthlyMobileQcCnt, compIdx: kd.compIdx }; } return jsonResp({ ok: true, keywordInfo: kwInfo, bidLandscape: bidRes.bidLandscape }); }

  if (mode === 'custom') { var keyword = body.keyword; var bid = parseInt(body.bid); if (!keyword || !bid) return jsonResp({ ok: false, error: 'keyword and bid required' }, 400); if (bid < 70 || bid > 100000) return jsonResp({ ok: false, error: 'bid must be 70~100000' }, 400); var results = await Promise.all([naverAdKeywordData(keyword, env), naverAdPerformance(keyword, [bid], 'MOBILE', env), naverAdRankBids(keyword, env)]); var kwRes = results[0], perfRes = results[1], bidRes = results[2]; if (!kwRes.ok) return jsonResp({ ok: false, error: kwRes.error }, 502); var kd = kwRes.keywordList[0] || {}; var kwInfo = { keyword: keyword, monthlyPcQcCnt: kd.monthlyPcQcCnt, monthlyMobileQcCnt: kd.monthlyMobileQcCnt, compIdx: kd.compIdx }; var perf = null; if (perfRes.ok && perfRes.data.estimate && perfRes.data.estimate.length > 0) { var est = perfRes.data.estimate[0]; perf = { bid: bid, clicks: est.clicks || 0, cost: est.cost || 0 }; } var rankInfo = { rank: 99, rankText: '미확인', share: 10 }; if (bidRes.ok) { var bl = bidRes.bidLandscape; for (var i = 0; i < bl.length; i++) { if (bid >= bl[i].mobileBid) { var sm = { 1: 85, 2: 70, 3: 55, 4: 40, 5: 30 }; rankInfo = { rank: bl[i].rank, rankText: bl[i].rank + '위', share: sm[bl[i].rank] || 20 }; break; } } } return jsonResp({ ok: true, keywordInfo: kwInfo, performance: perf, rankInfo: rankInfo, bidLandscape: bidRes.ok ? bidRes.bidLandscape : [] }); }

  if (mode === 'full') { var keyword = body.keyword; if (!keyword) return jsonResp({ ok: false, error: 'keyword required' }, 400); var testBids = [100, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000]; var results = await Promise.all([naverAdKeywordData(keyword, env), naverAdPerformance(keyword, testBids, 'MOBILE', env), naverAdPerformance(keyword, testBids, 'PC', env), naverAdRankBids(keyword, env)]); var kwRes = results[0], mobRes = results[1], pcRes = results[2], bidRes = results[3]; if (!kwRes.ok) return jsonResp({ ok: false, error: kwRes.error }, 502); var kd = kwRes.keywordList[0] || {}; var kwInfo = { keyword: keyword, monthlyPcQcCnt: kd.monthlyPcQcCnt, monthlyMobileQcCnt: kd.monthlyMobileQcCnt, compIdx: kd.compIdx }; var mobilePerf = [], recommendedBid = null; if (mobRes.ok && mobRes.data.estimate) { var valid = mobRes.data.estimate.filter(function(e) { return e.clicks > 0; }); mobilePerf = valid.map(function(e) { return { bid: e.bid, clicks: e.clicks, cost: e.cost || Math.round(e.clicks * e.bid * 0.8) }; }); if (valid.length > 0) { var maxC = 0; for (var i = 0; i < valid.length; i++) if (valid[i].clicks > maxC) maxC = valid[i].clicks; for (var i = 0; i < valid.length; i++) { if (valid[i].clicks >= maxC * 0.8) { recommendedBid = { bid: valid[i].bid, clicks: valid[i].clicks, cost: valid[i].cost || Math.round(valid[i].clicks * valid[i].bid * 0.8) }; break; } } } } var pcPerf = []; if (pcRes.ok && pcRes.data.estimate) { pcPerf = pcRes.data.estimate.filter(function(e) { return e.clicks > 0; }).map(function(e) { return { bid: e.bid, clicks: e.clicks, cost: e.cost || Math.round(e.clicks * e.bid * 0.8) }; }); } return jsonResp({ ok: true, keywordInfo: kwInfo, mobilePerformance: mobilePerf, pcPerformance: pcPerf, recommendedBid: recommendedBid, bidLandscape: bidRes.ok ? bidRes.bidLandscape : [] }); }

  if (mode === 'bulk') { var keywords = body.keywords; if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return jsonResp({ ok: false, error: 'keywords array required' }, 400); if (keywords.length > 50) keywords = keywords.slice(0, 50); var data = []; for (var i = 0; i < keywords.length; i++) { var kw = keywords[i]; var results = await Promise.all([naverAdKeywordData(kw, env), naverAdRankBids(kw, env)]); var kwRes = results[0], bidRes = results[1]; var item = { keyword: kw, totalQcCnt: 0, monthlyPcQcCnt: 0, monthlyMobileQcCnt: 0, compIdx: '-', rank1Bid: 0, rank2Bid: 0, rank3Bid: 0, rank4Bid: 0, rank5Bid: 0, recommendedBid: 0, expectedClicks: 0, expectedCost: 0, cpc: 0 }; if (kwRes.ok && kwRes.keywordList.length > 0) { var kd = kwRes.keywordList[0]; item.monthlyPcQcCnt = naverAdParseVol(kd.monthlyPcQcCnt); item.monthlyMobileQcCnt = naverAdParseVol(kd.monthlyMobileQcCnt); item.totalQcCnt = item.monthlyPcQcCnt + item.monthlyMobileQcCnt; item.compIdx = kd.compIdx || '-'; } if (bidRes.ok) { var bl = bidRes.bidLandscape; for (var j = 0; j < bl.length; j++) { if (bl[j].rank === 1) item.rank1Bid = bl[j].mobileBid; if (bl[j].rank === 2) item.rank2Bid = bl[j].mobileBid; if (bl[j].rank === 3) item.rank3Bid = bl[j].mobileBid; if (bl[j].rank === 4) item.rank4Bid = bl[j].mobileBid; if (bl[j].rank === 5) item.rank5Bid = bl[j].mobileBid; } } if (item.rank3Bid > 0) { item.recommendedBid = item.rank3Bid; item.expectedClicks = Math.round(item.totalQcCnt * 0.04); item.cpc = Math.round(item.rank3Bid * 0.8); item.expectedCost = item.expectedClicks * item.cpc; } data.push(item); if (i < keywords.length - 1) await sleep(500); } return jsonResp({ ok: true, data: data, total: data.length }); }

  return jsonResp({ ok: false, error: 'invalid mode' }, 400);
}

async function handleHealth() { return jsonResp({ ok: true, time: kstNowString(), version: '2.1.0' }); }

async function handleRankPlace(request) { var url = new URL(request.url); var keyword = url.searchParams.get('keyword') || ''; var store = url.searchParams.get('store') || ''; var kind = url.searchParams.get('kind') || 'restaurant'; var start = parseInt(url.searchParams.get('start')) || 1; var display = parseInt(url.searchParams.get('display')) || 50; var x = url.searchParams.get('x') || '126.9783882'; var y = url.searchParams.get('y') || '37.5666103'; var deviceType = url.searchParams.get('deviceType') || 'pc'; if (!keyword) return jsonResp({ error: 'keyword required' }, 400); try { var result = await naverFetchResults(kind, keyword, start, display, x, y, deviceType); var myRank = null; if (store) { for (var i = 0; i < result.items.length; i++) { if (result.items[i].name.indexOf(store) !== -1) { myRank = i + 1; break; } } } return jsonResp({ keyword: keyword, store: store, kind: kind, myRank: myRank, total: result.total, results: result.items, nlu: result.nlu || null, checkedAt: kstNowString() }); } catch (e) { return jsonResp({ error: e.message, snippet: e.snippet || null }, 502); } }

async function handleRankProxy(request) {
  var url = new URL(request.url);
  var kind = url.searchParams.get('kind') || 'restaurant';
  var keyword = url.searchParams.get('keyword') || '';
  var start = parseInt(url.searchParams.get('start')) || 1;
  var display = parseInt(url.searchParams.get('display')) || 100;
  var x = url.searchParams.get('x') || '126.9783882';
  var y = url.searchParams.get('y') || '37.5666103';
  var deviceType = url.searchParams.get('deviceType') || 'pc';

  if (!keyword) return jsonResp({ error: 'keyword required' }, 400);

  var gql = buildGraphQL(kind, keyword, start, display, x, y, deviceType);

  try {
    // 오라클 프록시 경유
    var resp = await fetch(ORACLE_PUPPETEER_URL + '/naver/place', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ORACLE_API_KEY
      },
      body: JSON.stringify([gql])
    });

    var data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: { 'Content-Type': resp.headers.get('content-type') || 'application/json', ...corsHeaders() }
    });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

async function handleTrackCreate(request, env) { var db = env.DB; try { var body = await request.json(); var workspaceId = String(body.workspaceId || 'default').trim(); var kind = String(body.kind || 'restaurant').trim(); var keyword = String(body.keyword || '').trim(); var targetPlaceId = String(body.targetPlaceId || '').trim(); var targetName = body.targetName ? String(body.targetName).trim() : null; var regionCity = String(body.regionCity || '').trim(); var regionDistrict = body.regionDistrict ? String(body.regionDistrict).trim() : null; var bx = String(body.x || '').trim(); var by = String(body.y || '').trim(); var deviceType = String(body.deviceType || 'pc').trim(); if (!keyword || !targetPlaceId || !bx || !by) return jsonResp({ ok: false, error: 'keyword, targetPlaceId, x, y required' }, 400); var r = await db.prepare('INSERT INTO tracks(workspace_id, kind, keyword, target_place_id, target_name, region_city, region_district, x, y, device_type, created_at, active) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)').bind(workspaceId, kind, keyword, targetPlaceId, targetName, regionCity, regionDistrict, bx, by, deviceType, new Date().toISOString()).run(); return jsonResp({ ok: true, id: r.meta.last_row_id }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 500); } }

async function handleTrackList(request, env) { var db = env.DB; var url = new URL(request.url); var wid = url.searchParams.get('workspaceId') || 'default'; var rows = await db.prepare('SELECT id, kind, keyword, target_place_id, target_name, region_city, region_district, x, y, device_type, created_at FROM tracks WHERE workspace_id=? AND active=1 ORDER BY id DESC').bind(wid).all(); return jsonResp({ ok: true, tracks: rows.results }); }

async function handleTrackDelete(request, env) { var db = env.DB; var url = new URL(request.url); var wid = url.searchParams.get('workspaceId') || 'default'; var id = url.searchParams.get('id'); if (!id) return jsonResp({ ok: false, error: 'id required' }, 400); await db.prepare('UPDATE tracks SET active=0 WHERE id=? AND workspace_id=?').bind(id, wid).run(); return jsonResp({ ok: true }); }

async function handleCollect(request, env) { var db = env.DB; var url = new URL(request.url); var wid = url.searchParams.get('workspaceId') || 'default'; var tid = url.searchParams.get('trackId'); if (!tid) return jsonResp({ ok: false, error: 'trackId required' }, 400); var tr = await db.prepare('SELECT * FROM tracks WHERE id=? AND workspace_id=? AND active=1').bind(tid, wid).first(); if (!tr) return jsonResp({ ok: false, error: 'track not found' }, 404); try { var collected = await collectTrack(db, tr); return jsonResp({ ok: true, collected: collected }); } catch (e) { return jsonResp({ ok: false, error: e.message, snippet: e.snippet || null }, 502); } }

async function handleTimeline(request, env) { var db = env.DB; var url = new URL(request.url); var wid = url.searchParams.get('workspaceId') || 'default'; var tid = url.searchParams.get('trackId'); var limit = parseInt(url.searchParams.get('limit') || '30'); if (!tid) return jsonResp({ ok: false, error: 'trackId required' }, 400); var tr = await db.prepare('SELECT * FROM tracks WHERE id=? AND workspace_id=?').bind(tid, wid).first(); if (!tr) return jsonResp({ ok: false, error: 'track not found' }, 404); var snaps = await db.prepare('SELECT s.base_date AS date, s.total, s.target_rank AS targetRank, i.blog_count AS blogCount, i.visitor_count AS visitorCount, i.save_count AS saveCount, i.image_count AS imageCount FROM snapshots s LEFT JOIN snapshot_items i ON i.snapshot_id = s.id AND i.place_id = ? WHERE s.track_id = ? ORDER BY s.base_date DESC LIMIT ?').bind(String(tr.target_place_id), tid, limit).all(); var arr = snaps.results || []; var timeline = []; for (var i = 0; i < arr.length; i++) { var cur = arr[i]; var prev = arr[i + 1] || null; var rankDelta = null; if (cur.targetRank != null && prev && prev.targetRank != null) rankDelta = prev.targetRank - cur.targetRank; timeline.push({ date: cur.date, total: cur.total, targetRank: cur.targetRank, rankDelta: rankDelta, blogCount: cur.blogCount, visitorCount: cur.visitorCount, saveCount: cur.saveCount, imageCount: cur.imageCount }); } return jsonResp({ ok: true, track: { id: tr.id, keyword: tr.keyword, targetPlaceId: tr.target_place_id, targetName: tr.target_name }, timeline: timeline }); }

async function handleSnapshot(request, env) { var db = env.DB; var url = new URL(request.url); var wid = url.searchParams.get('workspaceId') || 'default'; var tid = url.searchParams.get('trackId'); var date = url.searchParams.get('date'); if (!tid || !date) return jsonResp({ ok: false, error: 'trackId, date required' }, 400); var tr = await db.prepare('SELECT * FROM tracks WHERE id=? AND workspace_id=?').bind(tid, wid).first(); if (!tr) return jsonResp({ ok: false, error: 'track not found' }, 404); var snap = await db.prepare('SELECT id, base_date, collected_at, total, target_rank FROM snapshots WHERE track_id=? AND base_date=?').bind(tid, date).first(); if (!snap) return jsonResp({ ok: true, snapshot: null, items: [] }); var prevSnap = await db.prepare('SELECT id, base_date FROM snapshots WHERE track_id=? AND base_date<? ORDER BY base_date DESC LIMIT 1').bind(tid, date).first(); var curItems = await db.prepare('SELECT rank, place_id, name, category, businessCategory, blog_count, visitor_count, save_count, score, image_count, microReview FROM snapshot_items WHERE snapshot_id=? ORDER BY rank ASC').bind(snap.id).all(); var prevMap = {}; if (prevSnap) { var prevItems = await db.prepare('SELECT rank, place_id, blog_count, visitor_count, save_count, score, image_count FROM snapshot_items WHERE snapshot_id=?').bind(prevSnap.id).all(); prevItems.results.forEach(function(p) { prevMap[String(p.place_id)] = p; }); } var items = curItems.results.map(function(it) { var p = prevMap[String(it.place_id)] || null; return { rank: it.rank, place_id: it.place_id, name: it.name, category: it.category, businessCategory: it.businessCategory, blog_count: it.blog_count, visitor_count: it.visitor_count, save_count: it.save_count, score: it.score, image_count: it.image_count, microReview: it.microReview, isTarget: String(it.place_id) === String(tr.target_place_id), delta: p ? { rankDelta: p.rank - it.rank, blogDelta: (it.blog_count||0) - (p.blog_count||0), visitorDelta: (it.visitor_count||0) - (p.visitor_count||0), saveDelta: (it.save_count||0) - (p.save_count||0), imgDelta: (it.image_count||0) - (p.image_count||0) } : null }; }); return jsonResp({ ok: true, snapshot: snap, prevDate: prevSnap ? prevSnap.base_date : null, items: items }); }

async function handleKeywordVolume(request) { var url = new URL(request.url); var keyword = url.searchParams.get('keyword'); if (!keyword) return jsonResp({ error: 'keyword required' }, 400); return jsonResp({ keyword: keyword, monthly: { pc: 12400, mobile: 45600, total: 58000 }, competition: 'high', source: 'mock' }); }

async function handlePlaceKeywords(request) { var url = new URL(request.url); var placeId = url.searchParams.get('placeId'); var kind = url.searchParams.get('kind') || 'restaurant'; if (!placeId) return jsonResp({ error: 'placeId required' }, 400); var pageUrl = 'https://m.place.naver.com/' + kind + '/' + placeId + '/home'; try { var resp = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': 'https://m.search.naver.com/' } }); if (resp.status === 429) return jsonResp({ error: 'RATE_LIMITED', placeId: placeId }, 429); var html = await resp.text(); var nameMatch = html.match(/"name"\s*:\s*"([^"]+)"/); var placeName = nameMatch ? nameMatch[1] : ''; var keywords = extractKeywordList(html); return jsonResp({ placeId: placeId, name: placeName, keywords: keywords, source: pageUrl }); } catch (e) { return jsonResp({ error: e.message, placeId: placeId }, 502); } }

function extractKeywordList(html) { var nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (nextMatch) { try { var nextData = JSON.parse(nextMatch[1]); var found = findDeepKey(nextData, 'keywordList'); if (found && Array.isArray(found) && found.length > 0) return normalizeKeywords(found); } catch (e) {} } var scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || []; for (var i = 0; i < scriptBlocks.length; i++) { var content = scriptBlocks[i].replace(/<\/?script[^>]*>/g, ''); if (content.indexOf('keywordList') === -1) continue; var kw = findKeywordListInText(content); if (kw && kw.length > 0) return normalizeKeywords(kw); } var kw2 = findKeywordListInText(html); if (kw2 && kw2.length > 0) return normalizeKeywords(kw2); return []; }
function findDeepKey(obj, key) { if (!obj || typeof obj !== 'object') return null; if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) { var r = findDeepKey(obj[i], key); if (r) return r; } return null; } if (obj[key] !== undefined) return obj[key]; var keys = Object.keys(obj); for (var j = 0; j < keys.length; j++) { var r = findDeepKey(obj[keys[j]], key); if (r) return r; } return null; }
function findKeywordListInText(text) { var idx = text.indexOf('"keywordList"'); if (idx === -1) return null; var start = text.indexOf('[', idx); if (start === -1 || start - idx > 30) return null; var depth = 0; for (var i = start; i < text.length && i < start + 50000; i++) { if (text[i] === '[') depth++; else if (text[i] === ']') { depth--; if (depth === 0) { try { return JSON.parse(text.substring(start, i + 1)); } catch (e) { return null; } } } } return null; }
function normalizeKeywords(arr) { var result = []; for (var i = 0; i < arr.length; i++) { var item = arr[i]; if (typeof item === 'string' && item.trim()) { result.push(item.trim()); } else if (item && typeof item === 'object') { var kw = item.keyword || item.name || item.text || item.value || ''; if (typeof kw === 'string' && kw.trim()) result.push(kw.trim()); } } return result; }

async function handlePlaceDetail(request) { var url = new URL(request.url); var placeId = url.searchParams.get('placeId'); var kind = url.searchParams.get('kind') || 'restaurant'; if (!placeId) return jsonResp({ error: 'placeId required' }, 400); var pageUrl = 'https://m.place.naver.com/' + kind + '/' + placeId + '/home'; try { var resp = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': 'https://m.search.naver.com/' } }); if (resp.status === 429) return jsonResp({ error: 'RATE_LIMITED' }, 429); if (resp.status === 404) return jsonResp({ error: 'Place not found', placeId: placeId }, 404); var html = await resp.text(); var detail = extractPlaceDetail(html, placeId, kind); return jsonResp(detail); } catch (e) { return jsonResp({ error: e.message, placeId: placeId }, 502); } }

function extractPlaceDetail(html, placeId, kind) { var result = { placeId: placeId, kind: kind, name: '', category: '', businessCategory: '', roadAddress: '', address: '', phone: '', x: null, y: null, imageUrl: '', imageCount: 0, description: '', homepage: '', blogUrl: '', bookingUrl: '', businessHours: [], menuItems: [], keywords: [], conveniences: [], visitorReviewCount: 0, visitorReviewScore: null, blogCafeReviewCount: 0, bookingReviewCount: 0, bookingReviewScore: null, saveCount: 0, microReview: '', newOpening: false, hasBooking: false, hasNPay: false, options: {}, raw: null }; var nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (nextMatch) { try { var nextData = JSON.parse(nextMatch[1]); var store = findPlaceData(nextData); if (store) { result.name = store.name || ''; result.category = store.category || ''; result.businessCategory = store.businessCategory || ''; result.roadAddress = store.roadAddress || store.address || ''; result.address = store.address || ''; result.phone = store.phone || store.virtualPhone || ''; result.x = store.x || null; result.y = store.y || null; result.imageUrl = store.imageUrl || store.thumbUrl || ''; result.imageCount = parseInt(store.imageCount) || 0; result.description = store.description || store.microReview || ''; result.homepage = store.homepageUrl || store.homepage || ''; result.blogUrl = store.blogUrl || ''; result.bookingUrl = store.bookingUrl || ''; result.visitorReviewCount = parseInt(store.visitorReviewCount) || 0; result.visitorReviewScore = store.visitorReviewScore || null; result.blogCafeReviewCount = parseInt(store.blogCafeReviewCount) || 0; result.bookingReviewCount = parseInt(store.bookingReviewCount) || 0; result.bookingReviewScore = store.bookingReviewScore || null; result.saveCount = parseInt(store.saveCount) || 0; result.microReview = store.microReview || ''; result.newOpening = !!store.newOpening; result.hasBooking = !!store.hasBooking; result.hasNPay = !!store.hasNPay; var bh = store.businessHours || store.businessStatus || findDeepKey(nextData, 'businessHours'); if (bh) result.businessHours = Array.isArray(bh) ? bh : [bh]; var menus = store.menus || store.menuItems || findDeepKey(nextData, 'menuList') || findDeepKey(nextData, 'menus'); if (menus && Array.isArray(menus)) { result.menuItems = menus.slice(0, 30).map(function(m) { return { name: m.name || m.menuName || '', price: m.price || m.menuPrice || '', description: m.description || '', imageUrl: m.imageUrl || m.images && m.images[0] || '', isPopular: !!m.isPopular || !!m.isRepresentative }; }); } var kws = findDeepKey(nextData, 'keywordList'); if (kws && Array.isArray(kws)) result.keywords = normalizeKeywords(kws); var opts = store.options || store.conveniences || findDeepKey(nextData, 'options'); if (opts) { if (Array.isArray(opts)) { result.conveniences = opts.map(function(o) { return typeof o === 'string' ? o : o.name || o.option || ''; }).filter(Boolean); } else if (typeof opts === 'object') { result.options = opts; } } result.raw = store; } } catch (e) {} } if (!result.name) { var nameM = html.match(/<title>([^<]+)<\/title>/); if (nameM) result.name = nameM[1].replace(/ : 네이버.*/, '').trim(); } if (!result.description) { var descM = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/); if (descM) result.description = descM[1]; } if (!result.imageUrl) { var imgM = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/); if (imgM) result.imageUrl = imgM[1]; } return result; }
function findPlaceData(obj) { if (!obj || typeof obj !== 'object') return null; if (obj.name && (obj.roadAddress || obj.address) && (obj.category || obj.businessCategory)) return obj; var paths = [['props','pageProps','initialState','place','detailPlace'],['props','pageProps','initialData','place'],['props','pageProps','place'],['props','pageProps']]; for (var i = 0; i < paths.length; i++) { var node = obj; for (var j = 0; j < paths[i].length; j++) { if (!node || typeof node !== 'object') { node = null; break; } node = node[paths[i][j]]; } if (node && node.name && (node.roadAddress || node.address || node.category)) return node; } return findPlaceObject(obj, 0); }
function findPlaceObject(obj, depth) { if (depth > 8 || !obj || typeof obj !== 'object') return null; if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) { var r = findPlaceObject(obj[i], depth + 1); if (r) return r; } return null; } if (obj.name && typeof obj.name === 'string' && (obj.roadAddress || obj.address) && (obj.category || obj.businessCategory || obj.visitorReviewCount !== undefined)) return obj; var keys = Object.keys(obj); for (var j = 0; j < keys.length; j++) { var r = findPlaceObject(obj[keys[j]], depth + 1); if (r) return r; } return null; }

async function handlePlaceDetailGql(request) {
  var url = new URL(request.url);
  var placeId = url.searchParams.get('placeId');
  if (!placeId) return jsonResp({ error: 'placeId required' }, 400);

  var gql = {
    operationName: 'getPlaceDetail',
    variables: { id: String(placeId) },
    query: 'query getPlaceDetail($id: String!) {\n  placeDetail(id: $id) {\n    id\n    name\n    category\n    businessCategory\n    roadAddress\n    address\n    fullAddress\n    commonAddress\n    phone\n    virtualPhone\n    x\n    y\n    imageUrl\n    imageCount\n    description\n    homepageUrl\n    blogUrl\n    bookingUrl\n    visitorReviewCount\n    visitorReviewScore\n    blogCafeReviewCount\n    bookingReviewCount\n    bookingReviewScore\n    saveCount\n    microReview\n    newOpening\n    hasBooking\n    hasNPay\n    __typename\n  }\n}'
  };

  try {
    // 오라클 프록시 경유
    var resp = await fetch(ORACLE_PUPPETEER_URL + '/naver/place', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ORACLE_API_KEY
      },
      body: JSON.stringify([gql])
    });

    var text = await resp.text();
    var ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return jsonResp({ error: 'Upstream error', status: resp.status }, 502);

    var data = JSON.parse(text);
    var detail = data[0] && data[0].data && data[0].data.placeDetail;
    return jsonResp({ ok: true, detail: detail || null });
  } catch (e) {
    return jsonResp({ error: e.message }, 502);
  }
}

var REVIEW_PHRASE_POOLS = {"restaurant":{"tasteCore":["음식이 너무 맛있어요","전체적으로 맛이 좋았어요","맛이 기대 이상이에요","정말 맛있게 먹었어요","음식 맛이 딱 제 스타일이에요","맛있게 잘 먹었어요","여기 음식 진짜 맛있어요","음식이 깔끔하고 맛있어요","전체적으로 음식이 맛있었어요"],"tasteCoreMenu":["{menu} 너무 맛있어요","{menu} 맛이 정말 좋았어요","{menu} 먹었는데 기대 이상이에요","{menu} 진짜 맛있게 먹었어요","{menu} 맛이 일품이에요","{menu} 강력 추천해요"],"tasteDetail":["간이 딱 맞고","양념이 잘 배어있고","재료가 신선하고","고기가 부드럽고","국물이 진하고","소스가 맛있고","밑반찬도 맛있고","맛이 깔끔하고","식감이 좋고","풍미가 좋고","불맛이 살아있고","정성이 느껴지고"],"secondary":["만족스럽게 먹고 갑니다","다음에 또 올 것 같아요","재방문 의사 있어요","기분 좋게 식사했어요","잘 먹고 갑니다","만족스러운 식사였어요","또 방문하고 싶어요","다음에 또 올게요"]},"cafe":{"tasteCore":["커피가 맛있어요","음료가 맛있어요","맛있게 잘 먹었어요","전체적으로 맛이 좋았어요","커피 맛이 좋아요","음료가 깔끔하고 맛있어요"],"tasteCoreMenu":["{menu} 맛이 좋았어요","{menu} 너무 맛있어요","{menu} 추천해요"],"tasteDetail":["향이 좋고","달지 않고 깔끔하고","디저트도 맛있고","원두가 좋은 게 느껴지고","온도도 딱 맞고","비주얼도 예쁘고","맛이 부드럽고"],"secondary":["만족하고 갑니다","다음에 또 올게요","카공하기도 좋아요","좋은 시간 보냈어요","또 방문하고 싶어요","자주 올 것 같아요"]},"hairshop":{"tasteCore":["머리 너무 잘해주셨어요","원하는 스타일로 잘 해주셨어요","시술 결과가 너무 마음에 들어요","기대 이상으로 잘해주셨어요","정말 예쁘게 해주셨어요","딱 원하는 대로 나왔어요"],"tasteCoreMenu":["{menu} 결과가 너무 마음에 들어요","{menu} 너무 잘해주셨어요","{menu} 딱 원하는 대로 해주셨어요","{menu} 예쁘게 해주셨어요"],"tasteDetail":["색감이 예쁘고","컷라인이 깔끔하고","머리결도 안 상하고","자연스럽게 잘 나왔고","스타일링 팁도 알려주시고","두상에 맞게 잘 잡아주시고"],"secondary":["만족하고 갑니다","다음에 또 올게요","단골 될 것 같아요","앞으로도 계속 다닐 것 같아요","지인한테도 추천하고 싶어요"]},"nailshop":{"tasteCore":["네일 너무 예쁘게 해주셨어요","디자인이 너무 마음에 들어요","손이 예뻐졌어요","기대 이상으로 잘해주셨어요","정말 꼼꼼하게 해주셨어요"],"tasteCoreMenu":["{menu} 결과가 마음에 들어요","{menu} 너무 예쁘게 해주셨어요","{menu} 추천해요"],"tasteDetail":["지속력도 좋고","디자인이 깔끔하고","손정리도 꼼꼼하게 해주시고","색감이 예쁘고","마감이 깔끔하고"],"secondary":["만족하고 갑니다","다음에 또 올게요","주변에 추천하고 싶어요","네일 볼 때마다 기분 좋아요","단골 될 것 같아요"]},"hospital":{"tasteCore":["진료를 꼼꼼하게 해주세요","설명을 자세하게 해주셔서 좋았어요","진료 결과가 만족스러워요","믿고 다닐 수 있는 병원이에요","꼼꼼하게 봐주셔서 안심이 됐어요"],"tasteCoreMenu":["{menu} 관련 설명을 잘 해주셨어요","{menu} 진료가 꼼꼼했어요","{menu} 치료 결과가 좋았어요"],"tasteDetail":["원장님이 꼼꼼하시고","치료 과정도 자세히 알려주시고","대기 시간도 짧고","사후 관리도 잘 알려주시고","불안감 없이 편하게 받았고"],"secondary":["다음에도 여기서 진료받으려고요","안심이 되었어요","신뢰가 가는 병원이에요","지인한테도 추천했어요","계속 다닐 것 같아요"]},"accommodation":{"tasteCore":["방이 깨끗하고 좋았어요","시설이 전체적으로 좋았어요","편하게 잘 쉬었어요","가격 대비 만족스러워요","전체적으로 만족스러웠어요"],"tasteCoreMenu":["{menu} 시설이 좋았어요","{menu} 만족스러웠어요"],"tasteDetail":["침구도 깨끗하고","어메니티도 잘 갖춰져있고","조용하고 편했고","뷰도 좋고","냉난방도 잘 되고"],"secondary":["편하게 쉬다 갑니다","다음에 또 이용하고 싶어요","잘 쉬고 갑니다","만족스러운 숙박이었어요","재방문 의사 있어요"]}};

var THEME_TO_BUCKET = {'taste':'skip','total':'skip','quality':'skip','service':'service','kindness':'service','friendliness':'service','staff':'service','mood':'atmosphere','ambiance':'atmosphere','interior':'atmosphere','comfort':'atmosphere','coziness':'atmosphere','view':'atmosphere','spaciousness':'atmosphere','facility':'atmosphere','quantity':'quantity','amount':'quantity','portion':'quantity','cleanliness':'cleanliness','hygiene':'cleanliness','sanitation':'cleanliness','waiting':'waiting','speed':'waiting','rapidness':'waiting','price':'price','value':'price','costEfficiency':'price','parking':'parking','variety':'variety','diversity':'variety','menu':'variety','freshness':'freshness','location':'location','accessibility':'location','convenience':'location'};

var BUCKET_PHRASES = {"service":["직원분들도 친절하시고","응대도 친절해서 좋았어요","서비스가 좋아서 더 만족했어요","직원분이 잘 안내해주셨어요","사장님이 친절하시고"],"atmosphere":["분위기도 좋고","매장이 깔끔하고","인테리어가 예쁘고","조용해서 대화하기 좋았어요","분위기가 아늑해요","매장이 넓고 쾌적하고"],"quantity":["양도 많고","생각보다 푸짐해서 좋았어요","구성이 알차고","양이 넉넉해서 좋았어요","포션이 넉넉하고"],"cleanliness":["매장도 청결하고","전체적으로 깔끔한 느낌이라 좋았어요","위생 관리가 잘 되어있어요","깔끔하게 관리되고 있어요"],"waiting":["웨이팅이 있었지만 기다릴 만했어요","생각보다 금방 들어갔어요","대기 시간이 짧았어요","음식도 금방 나오고"],"price":["가격 대비 만족스러워요","가성비가 좋아요","가격도 합리적이에요","이 가격에 이 퀄리티면 만족이에요"],"parking":["주차하기 편했어요","주차 공간도 넉넉하고","주차도 편하고"],"variety":["메뉴가 다양해서 고르기 좋았어요","선택지가 많아서 좋았어요","다음엔 다른 메뉴도 먹어보고 싶어요"],"freshness":["재료가 신선한 느낌이에요","신선한 재료를 사용하는 게 느껴졌어요","재료가 좋은 게 맛에서 느껴져요"],"location":["위치도 찾기 쉽고","접근성도 좋고","교통도 편하고"],"context":["친구랑 같이 왔는데","가족이랑 방문했는데","데이트로 방문했는데","점심 먹으러 왔는데","퇴근하고 들렀는데","지인 추천으로 왔는데"],"recommendation":["추천드리고 싶어요","근처 오시면 한 번쯤 가보셔도 좋을 것 같아요","주변 분들한테도 알려주고 싶어요"]};

function buildPlaceData(placeId, placeName, kind, rawThemes, rawMenus) { var topItems = []; for (var mi = 0; mi < Math.min(rawMenus.length, 5); mi++) { var label = rawMenus[mi].label || rawMenus[mi].code || ''; if (label) topItems.push(label); } var pool = REVIEW_PHRASE_POOLS[kind] || REVIEW_PHRASE_POOLS.restaurant; var tasteCore = pool.tasteCore.slice(); for (var ti = 0; ti < Math.min(topItems.length, 3); ti++) { for (var tj = 0; tj < pool.tasteCoreMenu.length; tj++) { tasteCore.push(pool.tasteCoreMenu[tj].replace('{menu}', topItems[ti])); } } var optionalBuckets = {}; for (var ri = 0; ri < rawThemes.length; ri++) { var code = rawThemes[ri].code || ''; var bucket = THEME_TO_BUCKET[code]; if (!bucket || bucket === 'skip') continue; if (!optionalBuckets[bucket] && BUCKET_PHRASES[bucket]) { optionalBuckets[bucket] = BUCKET_PHRASES[bucket].slice(); } } optionalBuckets.context = BUCKET_PHRASES.context.slice(); optionalBuckets.recommendation = BUCKET_PHRASES.recommendation.slice(); if (Object.keys(optionalBuckets).length <= 2) { optionalBuckets.service = BUCKET_PHRASES.service.slice(); optionalBuckets.atmosphere = BUCKET_PHRASES.atmosphere.slice(); } return { placeId: placeId, placeName: placeName, businessType: kind, topItems: topItems, requiredBuckets: { tasteCore: tasteCore, tasteDetail: pool.tasteDetail.slice(), secondary: pool.secondary.slice() }, optionalBuckets: optionalBuckets }; }

var PLACE_THEMES_STATS_QUERY = 'query getVisitorReviewStats($input:VisitorReviewStatsInput){visitorReviewStats(input:$input){id name visitorReviewsTotal review{avgRating totalCount}analysis{themes{code label count}menus{code label count}}}}';

async function handlePlaceThemes(request) {
  var url = new URL(request.url);
  var placeId = (url.searchParams.get('placeId') || '').trim();
  var kind = url.searchParams.get('kind') || 'restaurant';
  if (!placeId) return jsonResp({ ok: false, error: 'placeId required' }, 400);
  if (!/^\d+$/.test(placeId)) return jsonResp({ ok: false, error: 'placeId must be numeric' }, 400);

  try {
    // 오라클 프록시 경유
    var resp = await fetch(ORACLE_PUPPETEER_URL + '/naver/place', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ORACLE_API_KEY
      },
      body: JSON.stringify([{
        operationName: 'getVisitorReviewStats',
        variables: { input: { businessId: placeId, businessType: kind } },
        query: PLACE_THEMES_STATS_QUERY
      }])
    });

    if (resp.status === 429) return jsonResp({ ok: false, error: 'RATE_LIMITED' }, 429);
    var text = await resp.text();
    var ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return jsonResp({ ok: false, error: 'UPSTREAM_ERROR', status: resp.status }, 502);

    var data = JSON.parse(text);
    if (!Array.isArray(data) || !data[0]) return jsonResp({ ok: false, error: 'INVALID_RESPONSE' }, 502);
    if (data[0].errors) return jsonResp({ ok: false, error: 'GRAPHQL_ERROR', errors: data[0].errors }, 502);

    var stats = data[0].data && data[0].data.visitorReviewStats;
    if (!stats) return jsonResp({ ok: false, error: 'NO_DATA' }, 502);

    var placeName = stats.name || '';
    var analysis = stats.analysis || {};
    var rawThemes = (analysis.themes || []).slice().sort(function(a, b) { return (b.count || 0) - (a.count || 0); });
    var rawMenus = (analysis.menus || []).slice().sort(function(a, b) { return (b.count || 0) - (a.count || 0); });

    var placeData = buildPlaceData(placeId, placeName, kind, rawThemes, rawMenus);

    return jsonResp({
      ok: true, placeData: placeData,
      raw: { themes: rawThemes, menus: rawMenus, reviewTotal: stats.visitorReviewsTotal, avgRating: stats.review && stats.review.avgRating }
    });
  } catch (e) {
    return jsonResp({ ok: false, error: e.message }, 502);
  }
}

var PLACE_REVIEWS_GQL = 'query getVisitorReviews($input:VisitorReviewsInput){visitorReviews(input:$input){items{id reviewId rating author{nickname __typename}body media{type thumbnail __typename}tags created reply{body __typename}visitCount businessName __typename}total __typename}}';

async function handlePlaceReviews(request) {
  var url = new URL(request.url);
  var placeId = (url.searchParams.get('placeId') || '').trim();
  var kind = url.searchParams.get('kind') || 'restaurant';
  var size = Math.min(parseInt(url.searchParams.get('size')) || 30, 50);
  var sort = url.searchParams.get('sort') || '';

  if (!placeId) return jsonResp({ ok: false, error: 'placeId required' }, 400);
  if (!/^\d+$/.test(placeId)) return jsonResp({ ok: false, error: 'placeId must be numeric' }, 400);

  var vi = {
    businessId: placeId, businessType: kind, item: '0', size: size,
    isPhotoUsed: false, includeContent: true, getUserStats: false,
    includeReceiptPhotos: true, getReactions: false, getTrailer: false
  };
  if (sort) vi.sort = sort;

  try {
    // 오라클 프록시 경유
    var resp = await fetch(ORACLE_PUPPETEER_URL + '/naver/place', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ORACLE_API_KEY
      },
      body: JSON.stringify([{ operationName: 'getVisitorReviews', variables: { input: vi }, query: PLACE_REVIEWS_GQL }])
    });

    if (resp.status === 429) return jsonResp({ ok: false, error: 'RATE_LIMITED' }, 429);
    var text = await resp.text();
    var ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return jsonResp({ ok: false, error: 'UPSTREAM_ERROR', status: resp.status }, 502);

    var data = JSON.parse(text);
    if (!Array.isArray(data) || !data[0]) return jsonResp({ ok: false, error: 'INVALID_RESPONSE' }, 502);
    if (data[0].errors) return jsonResp({ ok: false, error: 'GRAPHQL_ERROR', errors: data[0].errors }, 502);

    var vr = data[0].data && data[0].data.visitorReviews;
    if (!vr) return jsonResp({ ok: false, error: 'NO_DATA' }, 502);

    var reviews = [];
    var items = vr.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var media = it.media || [];
      var imgCount = 0;
      var thumbnails = [];
      for (var m = 0; m < media.length; m++) {
        if (media[m].type === 'image') {
          imgCount++;
          if (media[m].thumbnail) thumbnails.push(String(media[m].thumbnail));
        }
      }
      reviews.push({
        id: it.id || '', reviewId: it.reviewId || '', rating: it.rating || 0,
        author: it.author ? it.author.nickname || '' : '',
        body: it.body || '', hasImage: imgCount > 0, imageCount: imgCount,
        thumbnails: thumbnails, businessName: it.businessName || '',
        date: it.created || '', hasReply: !!(it.reply && it.reply.body),
        visitCount: it.visitCount || 0, tags: it.tags || []
      });
    }
    return jsonResp({ ok: true, reviews: reviews, total: vr.total || 0 });
  } catch (e) {
    return jsonResp({ ok: false, error: e.message }, 502);
  }
}

var REVIEW_CACHE_TTL = 21600;
async function handleReviewStats(request, env) { var url = new URL(request.url); var businessId = (url.searchParams.get('businessId') || '').trim(); var startDate = (url.searchParams.get('startDate') || '').trim(); var endDate = (url.searchParams.get('endDate') || '').trim(); var force = url.searchParams.get('force') === '1'; if (!businessId || !startDate || !endDate) return jsonResp({ ok: false, error: 'businessId, startDate, endDate required' }, 400); if (!/^\d+$/.test(businessId)) return jsonResp({ ok: false, error: 'businessId must be digits' }, 400); if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return jsonResp({ ok: false, error: 'startDate/endDate must be YYYY-MM-DD' }, 400); var cacheKey = 'reviewStats:' + businessId + ':' + startDate + ':' + endDate; if (!force && env.REVIEW_CACHE) { try { var cached = await env.REVIEW_CACHE.get(cacheKey, 'json'); if (cached) return jsonResp({ ok: true, cached: true, key: cacheKey, data: cached, themeMap: THEME_KO }); } catch (e) {} } var upstreamUrl = 'https://new.smartplace.naver.com/graphql?opName=GetReviewDashboard'; var payload = { operationName: 'GetReviewDashboard', variables: { businessId: businessId, startDate: startDate, endDate: endDate }, query: REVIEW_QUERY }; try { var r = await fetch(upstreamUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'accept': 'application/json, text/plain, */*', 'from-system': 'smartplace', 'origin': 'https://new.smartplace.naver.com', 'referer': 'https://new.smartplace.naver.com/', 'user-agent': request.headers.get('user-agent') || 'Mozilla/5.0' }, body: JSON.stringify(payload) }); var text = await r.text(); var parsed; try { parsed = JSON.parse(text); } catch (e) { return jsonResp({ ok: false, error: 'UPSTREAM_NON_JSON', upstreamStatus: r.status, body: text.slice(0, 500) }, 502); } if (parsed && parsed.errors && parsed.errors.length) return jsonResp({ ok: false, error: 'GRAPHQL_ERROR', upstreamStatus: r.status, errors: parsed.errors }, 502); var data = parsed && parsed.data && parsed.data.reviewStatistics || null; if (!data) return jsonResp({ ok: false, error: 'NO_DATA', upstreamStatus: r.status }, 502); if (env.REVIEW_CACHE) { try { await env.REVIEW_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: REVIEW_CACHE_TTL }); } catch (e) {} } return jsonResp({ ok: true, cached: false, key: cacheKey, data: data, themeMap: THEME_KO }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 502); } }

async function handleYoutubeSearch(request, env) { var ytKey = env.YOUTUBE_API_KEY; if (!ytKey) return jsonResp({ ok: false, error: 'YOUTUBE_API_KEY not configured' }, 500); var url = new URL(request.url); var params = new URLSearchParams(); params.set('part', 'snippet'); params.set('type', 'video'); params.set('maxResults', url.searchParams.get('maxResults') || '50'); params.set('regionCode', 'KR'); params.set('key', ytKey); var q = url.searchParams.get('q'); if (q) params.set('q', q); var order = url.searchParams.get('order'); if (order) params.set('order', order); var duration = url.searchParams.get('videoDuration'); if (duration && duration !== 'any') params.set('videoDuration', duration); var after = url.searchParams.get('publishedAfter'); if (after) params.set('publishedAfter', after); var pageToken = url.searchParams.get('pageToken'); if (pageToken) params.set('pageToken', pageToken); try { var r = await fetch('https://www.googleapis.com/youtube/v3/search?' + params.toString()); return jsonResp(await r.json()); } catch (e) { return jsonResp({ error: e.message }, 502); } }
async function handleYoutubeVideos(request, env) { var ytKey = env.YOUTUBE_API_KEY; if (!ytKey) return jsonResp({ ok: false, error: 'YOUTUBE_API_KEY not configured' }, 500); var url = new URL(request.url); var id = url.searchParams.get('id'); if (!id) return jsonResp({ error: 'id required' }, 400); var part = url.searchParams.get('part') || 'snippet,contentDetails,statistics'; try { var r = await fetch('https://www.googleapis.com/youtube/v3/videos?part=' + encodeURIComponent(part) + '&id=' + encodeURIComponent(id) + '&key=' + ytKey); return jsonResp(await r.json()); } catch (e) { return jsonResp({ error: e.message }, 502); } }
async function handleYoutubeChannels(request, env) { var ytKey = env.YOUTUBE_API_KEY; if (!ytKey) return jsonResp({ ok: false, error: 'YOUTUBE_API_KEY not configured' }, 500); var url = new URL(request.url); var id = url.searchParams.get('id'); if (!id) return jsonResp({ error: 'id required' }, 400); var part = url.searchParams.get('part') || 'statistics,snippet'; try { var r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=' + encodeURIComponent(part) + '&id=' + encodeURIComponent(id) + '&key=' + ytKey); return jsonResp(await r.json()); } catch (e) { return jsonResp({ error: e.message }, 502); } }
async function handleYoutubeTrending(request, env) { var ytKey = env.YOUTUBE_API_KEY; if (!ytKey) return jsonResp({ ok: false, error: 'YOUTUBE_API_KEY not configured' }, 500); var url = new URL(request.url); var params = new URLSearchParams(); params.set('part', 'snippet,contentDetails,statistics'); params.set('chart', 'mostPopular'); params.set('regionCode', 'KR'); params.set('maxResults', '50'); params.set('key', ytKey); var cat = url.searchParams.get('categoryId'); if (cat && cat !== '0') params.set('videoCategoryId', cat); try { var r = await fetch('https://www.googleapis.com/youtube/v3/videos?' + params.toString()); return jsonResp(await r.json()); } catch (e) { return jsonResp({ error: e.message }, 502); } }
async function handleAiYoutubeAnalyze(request, env) { var geminiKey = env.GEMINI_API_KEY; if (!geminiKey) return jsonResp({ ok: false, error: 'GEMINI_API_KEY not configured' }, 500); var body; try { body = await request.json(); } catch (e) { return jsonResp({ error: 'invalid JSON' }, 400); } var title = body.title || ''; var channel = body.channel || ''; var duration = body.duration || ''; var ratio = body.ratio || ''; var tags = body.tags || ''; var prompt = '나는 유튜브 크리에이터다. 아래 영상을 벤치마킹해서 상세한 기획안을 작성해줘.\n\n[분석 대상]\n- 제목: ' + title + '\n- 채널: ' + channel + '\n- 길이: ' + duration + '\n- 성과: 구독자 대비 ' + ratio + '배 조회수\n- 태그: ' + tags + '\n\n[요청]\n1. 떡상 이유 분석\n2. 제목의 심리적 트리거 분석\n3. 비슷한 주제 제목 5개 추천\n4. 썸네일 전략\n5. 시청 지속시간 높이는 대본 구조\n6. 시리즈 확장 아이디어 3개\n\n구체적이고 실행 가능하게 답변해줘.'; try { var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }) }); var data = await r.json(); if (!r.ok) return jsonResp({ ok: false, error: data.error ? data.error.message : 'Gemini API error' }, 502); var text = ''; if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) { text = data.candidates[0].content.parts[0].text || ''; } return jsonResp({ ok: true, result: text, prompt: prompt }); } catch (e) { return jsonResp({ ok: false, error: e.message, prompt: prompt }, 502); } }

async function handleLandProxy(request) { var url = new URL(request.url); var targetUrl = url.searchParams.get('url'); if (!targetUrl) return jsonResp({ error: 'url parameter required' }, 400); if (targetUrl.indexOf('m.land.naver.com') === -1 && targetUrl.indexOf('fin.land.naver.com') === -1) return jsonResp({ error: 'only naver land URLs allowed' }, 403); var headers = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1', 'Referer': 'https://m.land.naver.com/', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'ko-KR,ko;q=0.9' }; if (targetUrl.indexOf('fin.land.naver.com') !== -1) { headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'; headers['Referer'] = 'https://fin.land.naver.com/'; headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'; } try { var resp = await fetch(targetUrl, { headers: headers }); var body = await resp.text(); return new Response(body, { status: resp.status, headers: { 'Content-Type': resp.headers.get('Content-Type') || 'text/plain', ...corsHeaders() } }); } catch (e) { return jsonResp({ error: e.message }, 502); } }
async function handleLandProxyPost(request) { var body; try { body = await request.json(); } catch(e) { return jsonResp({ error: 'invalid JSON' }, 400); } var targetUrl = body.url; var urls = body.urls; if (!targetUrl && (!urls || !Array.isArray(urls) || urls.length === 0)) return jsonResp({ error: 'url or urls required' }, 400); var headers = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1', 'Referer': 'https://m.land.naver.com/', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'ko-KR,ko;q=0.9' }; if (urls && Array.isArray(urls)) { var results = []; for (var i = 0; i < urls.length; i += 10) { var chunk = urls.slice(i, i + 10); var promises = chunk.map(function(u) { if (u.indexOf('m.land.naver.com') === -1 && u.indexOf('fin.land.naver.com') === -1) return Promise.resolve({ url: u, status: 403, body: '' }); var h = { ...headers }; if (u.indexOf('fin.land.naver.com') !== -1) { h['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'; h['Referer'] = 'https://fin.land.naver.com/'; h['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'; } return fetch(u, { headers: h }).then(function(r) { return r.text().then(function(t) { return { url: u, status: r.status, body: t }; }); }).catch(function(e) { return { url: u, status: 0, body: '', error: e.message }; }); }); var chunkResults = await Promise.all(promises); results = results.concat(chunkResults); } return jsonResp({ ok: true, results: results }); } if (targetUrl.indexOf('m.land.naver.com') === -1 && targetUrl.indexOf('fin.land.naver.com') === -1) return jsonResp({ error: 'only naver land URLs allowed' }, 403); if (targetUrl.indexOf('fin.land.naver.com') !== -1) { headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'; headers['Referer'] = 'https://fin.land.naver.com/'; headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'; } try { var resp = await fetch(targetUrl, { headers: headers }); var respBody = await resp.text(); return jsonResp({ ok: true, status: resp.status, body: respBody }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 502); } }

async function handleDatalabTrend(request, env) { var clientId = env.NAVER_DATALAB_CLIENT_ID; var clientSecret = env.NAVER_DATALAB_SECRET; if (!clientId || !clientSecret) return jsonResp({ ok: false, error: 'NAVER_DATALAB credentials not configured' }, 500); var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var startDate = body.startDate; var endDate = body.endDate; var timeUnit = body.timeUnit || 'date'; var keywordGroups = body.keywordGroups; var device = body.device || ''; var gender = body.gender || ''; var ages = body.ages || []; if (!startDate || !endDate || !keywordGroups || !keywordGroups.length) return jsonResp({ ok: false, error: 'startDate, endDate, keywordGroups required' }, 400); if (keywordGroups.length > 5) return jsonResp({ ok: false, error: 'max 5 keyword groups per request' }, 400); try { var resp = await fetch('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, body: JSON.stringify({ startDate: startDate, endDate: endDate, timeUnit: timeUnit, keywordGroups: keywordGroups, device: device, gender: gender, ages: ages }) }); var text = await resp.text(); if (!resp.ok) return jsonResp({ ok: false, error: 'DataLab API error', status: resp.status, body: text.substring(0, 500) }, 502); var data = JSON.parse(text); return jsonResp({ ok: true, data: data }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 502); } }

function extractXmlTag(xml, tag) { var patterns = [new RegExp('<' + tag + '><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>', 'i'), new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i')]; for (var i = 0; i < patterns.length; i++) { var m = xml.match(patterns[i]); if (m) return m[1].trim(); } return ''; }

async function handleGoogleTrendsDaily(request) { var urls = ['https://trends.google.com/trending/rss?geo=KR','https://trends.google.co.kr/trending/rss?geo=KR']; for (var u = 0; u < urls.length; u++) { try { var resp = await fetch(urls[u], { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Accept': 'application/xml, text/xml, */*', 'Accept-Language': 'ko-KR,ko;q=0.9' } }); if (!resp.ok) continue; var text = await resp.text(); if (!text.includes('<item>')) continue; var searches = []; var itemRegex = /<item>([\s\S]*?)<\/item>/g; var match; var rank = 0; while ((match = itemRegex.exec(text)) !== null && rank < 20) { rank++; var itemXml = match[1]; var title = extractXmlTag(itemXml, 'title'); var traffic = extractXmlTag(itemXml, 'ht:approx_traffic') || extractXmlTag(itemXml, 'approx_traffic'); var newsTitle = extractXmlTag(itemXml, 'ht:news_item_title') || extractXmlTag(itemXml, 'news_item_title'); var newsUrl = extractXmlTag(itemXml, 'ht:news_item_url') || extractXmlTag(itemXml, 'news_item_url'); var imgUrl = extractXmlTag(itemXml, 'ht:picture') || extractXmlTag(itemXml, 'picture'); searches.push({ query: title || '', traffic: traffic || '', articleTitle: newsTitle || '', articleUrl: newsUrl || '', imageUrl: imgUrl || '' }); } if (searches.length > 0) { var today = kstDateString(); return jsonResp({ ok: true, days: [{ date: today, formattedDate: today, searches: searches }] }); } } catch (e) { continue; } } try { var pageResp = await fetch('https://trends.google.co.kr/trending?geo=KR&hl=ko', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9' } }); if (pageResp.ok) { var html = await pageResp.text(); var searches2 = []; var trendRegex = /"query"\s*:\s*"([^"]+)"/g; var m2; var seen = {}; while ((m2 = trendRegex.exec(html)) !== null && searches2.length < 20) { var q = m2[1]; if (!seen[q]) { seen[q] = true; searches2.push({ query: q, traffic: '', articleTitle: '', articleUrl: '', imageUrl: '' }); } } if (searches2.length > 0) { return jsonResp({ ok: true, days: [{ date: kstDateString(), formattedDate: kstDateString(), searches: searches2 }] }); } } } catch (e) {} return jsonResp({ ok: false, error: 'Google Trends data unavailable' }, 502); }

async function handleGoogleTrendsRealtime(request) { try { var resp = await fetch('https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Accept': 'application/xml, text/xml, */*' } }); if (!resp.ok) return jsonResp({ ok: false, error: 'Google News unavailable', status: resp.status }, 502); var text = await resp.text(); var stories = []; var itemRegex = /<item>([\s\S]*?)<\/item>/g; var match; while ((match = itemRegex.exec(text)) !== null && stories.length < 20) { var itemXml = match[1]; var title = extractXmlTag(itemXml, 'title'); var link = extractXmlTag(itemXml, 'link'); var source = extractXmlTag(itemXml, 'source'); if (title) { stories.push({ title: title, entityNames: source ? [source] : [], articleTitle: title, articleUrl: link || '', imageUrl: '' }); } } return jsonResp({ ok: true, stories: stories }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 502); } }

var BLOG_DEFAULT_PROMPT = '너는 네이버 블로그 전문 에디터다.\n아래 자료를 바탕으로 네이버 블로그 포스팅을 작성해라.\n\n=== 작동 원칙 ===\n- 제공된 정보만 사용. 임의 정보 생성 금지.\n- 첫 문장은 독자의 흥미를 끄는 질문형으로 시작\n- 글에 ** 이나 # 같은 마크다운 문자는 절대 넣지 않는다.\n- 소제목 앞에 이모지 1개 추가.\n- 반드시 한국어(한글)로만 작성한다.\n\n=== 문체 규칙 ===\n- 전문가스러운 말투\n- 대화체. 실제 경험을 말하듯 자연스럽게.\n- "안녕하세요 OO입니다" 식의 진부한 서론 금지.\n- AI 문체 금지\n- 문단은 모바일 가독성을 위해 2~3문장 단위로 끊는다.\n\n=== 제목 전략 (20자 내외) ===\n- 감정 + 궁금증 + 반전 + 공감 요소 포함\n- 키워드는 제목 앞쪽에 배치\n\n=== 본문 구성 ===\n도입부: 독자의 경험/궁금증을 건드리는 질문 (Hook)\n중간부: 소제목 4~5개, 각 소제목 본문 400자 이상\n마무리: 요약 + CTA\n\n=== SEO 규칙 ===\n- 핵심 키워드: 제목 + 소제목 + 본문에 총 5~10회\n\n=== 출력 형식 (JSON만 출력) ===\n{\n "title": "블로그 제목",\n "sections": [\n {\n "subtitle": "소제목1",\n "body": "본문 내용 (400자 이상)",\n "image_prompt": "영어 이미지 프롬프트"\n }\n ],\n "hashtags": "#태그1 #태그2 ...(8~12개)",\n "summary": "3줄 요약"\n}';

async function handleBlogGenerate(request, env) { var groqKey = env.GROQ_API_KEY; if (!groqKey) return jsonResp({ ok: false, error: 'GROQ_API_KEY not configured' }, 500); var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var sources = body.sources || {}; var keyword = body.keyword || ''; var customPrompt = body.prompt || ''; var maxTokens = parseInt(body.maxTokens) || 3000; var sourceTexts = []; if (sources.youtube && sources.youtube.transcript) { var yt = sources.youtube; var transcript = String(yt.transcript || ''); if (transcript.length > 4000) transcript = transcript.substring(0, 2000) + '\n...(중략)...\n' + transcript.substring(transcript.length - 2000); sourceTexts.push('[유튜브 영상: ' + (yt.title || '제목 없음') + ']\n' + transcript); } if (sources.top_posts && Array.isArray(sources.top_posts)) { for (var i = 0; i < sources.top_posts.length; i++) { var post = sources.top_posts[i]; var postBody = String(post.body || ''); if (postBody.length > 1500) postBody = postBody.substring(0, 750) + '\n...(중략)...\n' + postBody.substring(postBody.length - 750); sourceTexts.push('[참고글 ' + (i + 1) + ': ' + (post.title || '') + ']\n' + postBody); } } if (sources.custom_urls && Array.isArray(sources.custom_urls)) { for (var j = 0; j < sources.custom_urls.length; j++) { var cu = sources.custom_urls[j]; var cuBody = String(cu.body || ''); if (cuBody.length > 2000) cuBody = cuBody.substring(0, 1000) + '\n...(중략)...\n' + cuBody.substring(cuBody.length - 1000); sourceTexts.push('[참고 URL ' + (j + 1) + ': ' + (cu.title || cu.url || '') + ']\n' + cuBody); } } if (!sourceTexts.length && !keyword) { return jsonResp({ ok: false, error: '소스 또는 키워드를 1개 이상 입력하세요.' }, 400); } var systemPrompt = customPrompt || BLOG_DEFAULT_PROMPT; var userContent = ''; if (keyword) userContent += '핵심 키워드: ' + keyword + '\n\n'; if (sourceTexts.length) userContent += '=== 참고 자료 ===\n' + sourceTexts.join('\n\n---\n\n'); else userContent += '위 키워드에 대해 전문적이고 흥미로운 블로그 글을 작성해주세요.'; userContent += '\n\n위 자료를 바탕으로 JSON 형식으로만 블로그 글을 작성해주세요.'; try { var groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey }, body: JSON.stringify({ model: body.model || 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], temperature: 0.7, max_tokens: maxTokens }) }); if (!groqResp.ok) { var errText = await groqResp.text(); return jsonResp({ ok: false, error: 'Groq API error: ' + groqResp.status, detail: errText.substring(0, 500) }, 502); } var groqData = await groqResp.json(); var content = ''; if (groqData.choices && groqData.choices[0] && groqData.choices[0].message) { content = groqData.choices[0].message.content || ''; } var jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/g, ''); var startIdx = jsonStr.indexOf('{'); var endIdx = jsonStr.lastIndexOf('}'); if (startIdx !== -1 && endIdx > startIdx) jsonStr = jsonStr.substring(startIdx, endIdx + 1); var parsed = null; try { parsed = JSON.parse(jsonStr); } catch (parseErr) { return jsonResp({ ok: true, parsed: false, raw: content, error: 'JSON 파싱 실패', model: groqData.model || body.model }); } return jsonResp({ ok: true, parsed: true, content: parsed, model: groqData.model || body.model, usage: groqData.usage || null }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 502); } }

async function handleParkingScan(request, env) { var geminiKey = env.GEMINI_API_KEY; if (!geminiKey) return jsonResp({ ok: false, error: 'GEMINI_API_KEY not configured' }, 500); var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var imageData = body.image; if (!imageData) return jsonResp({ ok: false, error: 'image required' }, 400); var base64 = imageData; var mimeType = 'image/jpeg'; if (imageData.indexOf(',') !== -1) { var parts = imageData.split(','); base64 = parts[1]; var mimeMatch = parts[0].match(/data:([^;]+)/); if (mimeMatch) mimeType = mimeMatch[1]; } var prompt = '이 이미지에서 한국 전화번호를 찾아주세요.\n규칙:\n- 010으로 시작하는 번호만 추출\n- 하이픈 포함 형식으로 반환\n- 번호가 없으면 빈 문자열만 반환'; try { var resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 100 } }) }); var data = await resp.json(); if (!resp.ok) return jsonResp({ ok: false, error: data.error ? data.error.message : 'Gemini API error' }, 502); var text = ''; if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) { text = (data.candidates[0].content.parts[0].text || '').trim(); } var phoneMatch = text.match(/01[016789]-?\d{3,4}-?\d{4}/); var phone = ''; if (phoneMatch) { var digits = phoneMatch[0].replace(/[^0-9]/g, ''); if (digits.length === 11) phone = digits.substring(0, 3) + '-' + digits.substring(3, 7) + '-' + digits.substring(7); else if (digits.length === 10) phone = digits.substring(0, 3) + '-' + digits.substring(3, 6) + '-' + digits.substring(6); else phone = phoneMatch[0]; } return jsonResp({ ok: true, phone: phone, raw: text }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 502); } }

function bizExtractPhones(text) { var normalized = []; var seen = {}; var re1 = /010[\s\-\.]*\d{4}[\s\-\.]*\d{4}/g; var m; while ((m = re1.exec(text)) !== null) { var d = m[0].replace(/[^\d]/g, ''); if (d.length === 11 && !seen[d]) { seen[d] = true; normalized.push(d.substring(0, 3) + '-' + d.substring(3, 7) + '-' + d.substring(7)); } } return normalized; }
function bizParseBlogUrl(link) { var pvMatch = link.match(/blogId=([^&]+).*?logNo=(\d+)/); if (pvMatch) return { blogId: pvMatch[1], postNo: pvMatch[2] }; var directMatch = link.match(/blog\.naver\.com\/([^\/\?]+)\/(\d+)/); if (directMatch) return { blogId: directMatch[1], postNo: directMatch[2] }; return null; }
async function bizFetchBlog(mobileUrl, originalUrl, searchTitle) { try { var resp = await fetch(mobileUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': 'https://m.search.naver.com/' } }); if (!resp.ok) return null; var html = await resp.text(); var blogTitle = searchTitle; var titleM = html.match(/<title>([^<]+)<\/title>/i); if (titleM) blogTitle = titleM[1].replace(/\s*[:\-]\s*네이버.*$/i, '').trim(); var cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '); var textOnly = cleanHtml.replace(/<[^>]+>/g, ' '); var phones = bizExtractPhones(textOnly); if (phones.length === 0) return null; var businessName = ''; var address = ''; var moduleRegex = /data-module(?:-v2)?='(\{[^']*"type"\s*:\s*"v2_map"[^']*\})'/g; var moduleMatch; while ((moduleMatch = moduleRegex.exec(html)) !== null) { try { var moduleData = JSON.parse(moduleMatch[1]); var places = moduleData.data && moduleData.data.places; if (places && places.length > 0) { var p = places[0]; if (p.name && p.name.trim()) businessName = p.name.trim(); if (p.address && p.address.trim()) address = p.address.trim(); break; } } catch (e) {} } return { phones: phones, businessName: businessName, address: address, blogTitle: blogTitle, originalUrl: originalUrl }; } catch (e) { return null; } }
async function handleBizCollect(request, env) { var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var keyword = (body.keyword || '').trim(); var maxBlogs = Math.min(parseInt(body.maxBlogs) || 50, 200); if (!keyword) return jsonResp({ ok: false, error: 'keyword required' }, 400); var clientId = env.NAVER_DATALAB_CLIENT_ID; var clientSecret = env.NAVER_DATALAB_SECRET; if (!clientId || !clientSecret) return jsonResp({ ok: false, error: 'NAVER API credentials not configured' }, 500); var searchQuery = keyword + ' "010"'; var blogItems = []; var searchPages = maxBlogs > 100 ? 2 : 1; for (var sp = 0; sp < searchPages; sp++) { try { var startIdx = sp * 100 + 1; var searchResp = await fetch('https://openapi.naver.com/v1/search/blog.json?query=' + encodeURIComponent(searchQuery) + '&display=100&start=' + startIdx + '&sort=date', { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } }); if (!searchResp.ok) { if (sp === 0) { var errText = await searchResp.text(); return jsonResp({ ok: false, error: 'Search API error ' + searchResp.status, detail: errText.substring(0, 300) }, 502); } break; } var searchData = await searchResp.json(); var pageItems = searchData.items || []; blogItems = blogItems.concat(pageItems); if (pageItems.length < 100) break; } catch (e) { if (sp === 0) return jsonResp({ ok: false, error: 'Search API: ' + e.message }, 502); break; } } var blogTargets = []; var seenUrls = {}; for (var i = 0; i < blogItems.length && blogTargets.length < maxBlogs; i++) { var item = blogItems[i]; var link = item.link || ''; var parsed = bizParseBlogUrl(link); if (!parsed) continue; var mobileUrl = 'https://m.blog.naver.com/' + parsed.blogId + '/' + parsed.postNo; if (seenUrls[mobileUrl]) continue; seenUrls[mobileUrl] = true; blogTargets.push({ mobileUrl: mobileUrl, originalUrl: link, searchTitle: (item.title || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, '') }); } var results = []; var seenCombo = {}; var processedCount = 0; var phoneFoundCount = 0; for (var batch = 0; batch < blogTargets.length; batch += 10) { var chunk = blogTargets.slice(batch, batch + 10); var promises = []; for (var c = 0; c < chunk.length; c++) { promises.push(bizFetchBlog(chunk[c].mobileUrl, chunk[c].originalUrl, chunk[c].searchTitle)); } var chunkResults = await Promise.all(promises); for (var j = 0; j < chunkResults.length; j++) { processedCount++; var cr = chunkResults[j]; if (!cr || !cr.phones || cr.phones.length === 0) continue; phoneFoundCount++; for (var k = 0; k < cr.phones.length; k++) { var comboKey = (cr.businessName || '') + '|' + cr.phones[k]; if (seenCombo[comboKey]) continue; seenCombo[comboKey] = true; results.push({ keyword: keyword, businessName: cr.businessName || '', address: cr.address || '', phone: cr.phones[k] }); } } if (batch + 10 < blogTargets.length) await sleep(300); } return jsonResp({ ok: true, keyword: keyword, searchTotal: blogItems.length, processedBlogs: processedCount, blogsWithPhone: phoneFoundCount, results: results, totalPhones: results.length }); }

async function handlePuppeteerProxy(request) {
  var body;
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); }

  var keyword = body.keyword;
  var blogId = body.blogId;
  var logNo = body.logNo;
  var sortByDate = body.sortByDate !== undefined ? body.sortByDate : true;

  if (!keyword || !blogId || !logNo) {
    return jsonResp({ ok: false, error: 'keyword, blogId, logNo required' }, 400);
  }

  try {
    var resp = await fetch(ORACLE_PUPPETEER_URL + '/generate-click-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-api-key': ORACLE_API_KEY
      },
      body: JSON.stringify({ keyword: keyword, blogId: blogId, logNo: logNo, sortByDate: sortByDate })
    });

    var text = await resp.text();
    var ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return new Response(text, {
        status: resp.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() }
      });
    }
    return jsonResp({ ok: false, error: 'Oracle returned non-JSON', status: resp.status, snippet: text.substring(0, 300) }, 502);
  } catch (e) {
    return jsonResp({ ok: false, error: 'Oracle server unreachable: ' + e.message }, 502);
  }
}

async function handlePuppeteerHealth() {
  try {
    var resp = await fetch(ORACLE_PUPPETEER_URL + '/health', {
      headers: {
        'Accept': 'application/json',
        'x-api-key': ORACLE_API_KEY
      }
    });
    var data = await resp.json();
    return jsonResp({ ok: true, oracle: data });
  } catch (e) {
    return jsonResp({ ok: false, error: 'Oracle server unreachable: ' + e.message }, 502);
  }
}

async function handleSmartplaceKeywords(request) { var body; try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'invalid JSON' }, 400); } var token = (body.token || '').trim(); var siteId = (body.siteId || '').trim(); var startDate = (body.startDate || '').trim(); var endDate = (body.endDate || '').trim(); var metrics = (body.metrics || 'pv').trim(); if (!token || !siteId) return jsonResp({ ok: false, error: 'token and siteId required' }, 400); if (!startDate || !endDate) return jsonResp({ ok: false, error: 'startDate and endDate required' }, 400); if (['pv', 'visitor', 'click'].indexOf(metrics) === -1) metrics = 'pv'; var apiUrl = 'https://new.smartplace.naver.com/api/proxy/bizadvisor/api/v3/sites/' + encodeURIComponent(siteId) + '/report?dimensions=ref_keyword&endDate=' + encodeURIComponent(endDate) + '&metrics=' + encodeURIComponent(metrics) + '&sort=' + encodeURIComponent(metrics) + '&startDate=' + encodeURIComponent(startDate) + '&useIndex=revenue-search-channel-detail'; try { var resp = await fetch(apiUrl, { headers: { 'accept': 'application/json', 'authorization': 'Bearer ' + token, 'cache-control': 'no-cache', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'referer': 'https://new.smartplace.naver.com/', 'origin': 'https://new.smartplace.naver.com' } }); if (resp.status === 401) return jsonResp({ ok: false, error: 'TOKEN_EXPIRED' }, 401); if (!resp.ok) { var errText = await resp.text(); return jsonResp({ ok: false, error: 'Smartplace API error', status: resp.status, detail: errText.substring(0, 300) }, 502); } var respData = await resp.json(); var keywords = respData.data || respData || []; if (!Array.isArray(keywords)) keywords = []; return jsonResp({ ok: true, data: keywords }); } catch (e) { return jsonResp({ ok: false, error: e.message }, 502); } }

// ════════════════════════════════════════
// ROUTE TABLE
// ════════════════════════════════════════
var routes = [
  { method: 'GET', path: '/health', handler: handleHealth },

  { method: 'POST', path: '/auth/signup', handler: handleAuthSignup },
  { method: 'POST', path: '/auth/login', handler: handleAuthLogin },
  { method: 'GET', path: '/auth/me', handler: handleAuthMe },

  { method: 'GET', path: '/rank/place', handler: handleRankPlace },
  { method: 'POST', path: '/rank/proxy', handler: handleRankProxy },
  { method: 'POST', path: '/rank/track', handler: handleTrackCreate },
  { method: 'GET', path: '/rank/tracks', handler: handleTrackList },
  { method: 'DELETE', path: '/rank/track', handler: handleTrackDelete },
  { method: 'POST', path: '/rank/collect', handler: handleCollect },
  { method: 'GET', path: '/rank/timeline', handler: handleTimeline },
  { method: 'GET', path: '/rank/snapshot', handler: handleSnapshot },

  { method: 'GET', path: '/keyword/volume', handler: handleKeywordVolume },
  { method: 'POST', path: '/keyword/volume', handler: handleKeywordVolumePost },
  { method: 'POST', path: '/ad/analyze', handler: handleAdAnalyze },

  { method: 'GET', path: '/place/keywords', handler: handlePlaceKeywords },
  { method: 'GET', path: '/place/detail', handler: handlePlaceDetail },
  { method: 'GET', path: '/place/detail-gql', handler: handlePlaceDetailGql },
  { method: 'GET', path: '/place/themes', handler: handlePlaceThemes },
  { method: 'GET', path: '/place/reviews', handler: handlePlaceReviews },

  { method: 'GET', path: '/review/stats', handler: handleReviewStats },

  { method: 'GET', path: '/youtube/search', handler: handleYoutubeSearch },
  { method: 'GET', path: '/youtube/videos', handler: handleYoutubeVideos },
  { method: 'GET', path: '/youtube/channels', handler: handleYoutubeChannels },
  { method: 'GET', path: '/youtube/trending', handler: handleYoutubeTrending },
  { method: 'POST', path: '/ai/youtube-analyze', handler: handleAiYoutubeAnalyze },

  { method: 'GET', path: '/land/proxy', handler: handleLandProxy },
  { method: 'POST', path: '/land/proxy', handler: handleLandProxyPost },

  { method: 'POST', path: '/datalab/trend', handler: handleDatalabTrend },
  { method: 'GET', path: '/google/trends/daily', handler: handleGoogleTrendsDaily },
  { method: 'GET', path: '/google/trends/realtime', handler: handleGoogleTrendsRealtime },

  { method: 'POST', path: '/ai/blog-generate', handler: handleBlogGenerate },
  { method: 'POST', path: '/ai/parking-scan', handler: handleParkingScan },

  { method: 'POST', path: '/biz/collect', handler: handleBizCollect },

  { method: 'POST', path: '/puppeteer/proxy', handler: handlePuppeteerProxy },
  { method: 'GET', path: '/puppeteer/health', handler: handlePuppeteerHealth },

  { method: 'POST', path: '/smartplace/keywords', handler: handleSmartplaceKeywords },

  { method: 'POST', path: '/escrow/create', handler: handleEscrowCreate },
  { method: 'GET', path: '/escrow/list', handler: handleEscrowList },
  { method: 'GET', path: '/escrow/detail', handler: handleEscrowDetail },
  { method: 'POST', path: '/escrow/apply', handler: handleEscrowApply },
  { method: 'POST', path: '/escrow/approve', handler: handleEscrowApprove },

  { method: 'GET', path: '/post/list', handler: handlePostList },
  { method: 'GET', path: '/post/detail', handler: handlePostDetail },
  { method: 'POST', path: '/post/create', handler: handlePostCreate },
  { method: 'POST', path: '/comment/create', handler: handleCommentCreate },

  { method: 'POST', path: '/attendance/check', handler: handleAttendanceCheck },
  { method: 'GET', path: '/attendance/status', handler: handleAttendanceStatus },

  { method: 'GET', path: '/snowball/history', handler: handleSnowballHistory },

  { method: 'GET', path: '/dashboard/stats', handler: handleDashboardStats },
];

// ════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

    var db = env.DB;
    if (db) { try { await autoMigrate(db); } catch (e) {} }

    var url = new URL(request.url);
    var pathname = url.pathname.replace(/\/+$/, '') || '/';

    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (r.method === request.method && r.path === pathname) {
        try { return await r.handler(request, env); }
        catch (e) {
          console.error('Handler error:', e);
          return jsonResp({ error: 'Internal server error' }, 500);
        }
      }
    }

    // ════════════════════════════════════════
    // COMMUNITY V2 ROUTES
    // fetch handler 내부 pathname 분기 구간에 추가
    // ════════════════════════════════════════
    if (pathname === '/api/community/posts' && request.method === 'GET') {
      return COMMUNITY_V2_handlePostList(request, env);
    }

    if (pathname === '/api/community/posts' && request.method === 'POST') {
      return COMMUNITY_V2_handlePostCreate(request, env);
    }

    if (/^\/api\/community\/posts\/\d+$/.test(pathname) && request.method === 'GET') {
      return COMMUNITY_V2_handlePostDetail(request, env, pathname);
    }

    if (/^\/api\/community\/posts\/\d+\/comments$/.test(pathname) && request.method === 'GET') {
      return COMMUNITY_V2_handleCommentList(request, env, pathname);
    }

    if (/^\/api\/community\/posts\/\d+\/comments$/.test(pathname) && request.method === 'POST') {
      return COMMUNITY_V2_handleCommentCreate(request, env, pathname);
    }

    if (pathname === '/api/community/attendance/status' && request.method === 'GET') {
      return COMMUNITY_V2_handleAttendanceStatus(request, env);
    }

    if (pathname === '/api/community/attendance/feed' && request.method === 'GET') {
      return COMMUNITY_V2_handleAttendanceFeed(request, env);
    }

    if (pathname === '/api/community/attendance/checkin' && request.method === 'POST') {
      return COMMUNITY_V2_handleAttendanceCheckin(request, env);
    }

    if (pathname === '/api/dev/session' && request.method === 'POST') {
      try {
        return await DEV_SESSION_handle(request, env);
      } catch (e) {
       console.error('DEV_SESSION error:', e);
       return jsonResp({ ok: false, error: e.message || 'DEV_SESSION failed' }, 500);
     }
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
        try { await collectTrack(db, tr); await sleep(1200); }
        catch (e) { if (e.message === 'BLOCKED_OR_RATE_LIMITED') break; }
      }
      try { await cleanupOld(db); } catch (e) {}
    })());
  },
};

// ════════════════════════════════════════
// COMMUNITY V2 API PATCH
// 아래 코드는 worker/src/index.js 맨 하단에 추가
// 기존 레거시 /post/*, /attendance/* API는 유지하고
// 새 REST 경로 /api/community/* 만 추가합니다.
// ════════════════════════════════════════

async function COMMUNITY_V2_ensureSchema(db) {
  try {
    var info = await db.prepare('PRAGMA table_info(attendance)').all();
    var cols = (info.results || []).map(function (r) { return r.name; });
    if (cols.indexOf('message') === -1) {
      await db.exec('ALTER TABLE attendance ADD COLUMN message TEXT');
    }
  } catch (e) {}

  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_posts_board_category_created ON posts(board, category, is_deleted, is_pinned, created_at DESC)');
  } catch (e) {}

  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_comments_post_parent_created ON comments(post_id, parent_id, is_deleted, created_at ASC)');
  } catch (e) {}

  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_feed_date ON attendance(check_date DESC, created_at DESC)');
  } catch (e) {}
}

function COMMUNITY_V2_toInt(v, fallback) {
  var n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function COMMUNITY_V2_scope(scope) {
  var allowed = ['all', 'title', 'content', 'title_content', 'author'];
  return allowed.indexOf(scope) !== -1 ? scope : 'all';
}

function COMMUNITY_V2_postIdFromPath(pathname) {
  var m = pathname.match(/\/api\/community\/posts\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function COMMUNITY_V2_escapeLike(v) {
  return String(v || '').replace(/[\\%_]/g, '\\$&');
}

function COMMUNITY_V2_commentTree(rows) {
  var byId = {};
  var roots = [];

  for (var i = 0; i < rows.length; i++) {
    byId[rows[i].id] = Object.assign({}, rows[i], { children: [] });
  }

  for (var j = 0; j < rows.length; j++) {
    var row = rows[j];
    var node = byId[row.id];
    if (row.parent_id && byId[row.parent_id]) {
      byId[row.parent_id].children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function COMMUNITY_V2_isAdmin(payload, env) {
  if (!payload) return false;
  if (payload.role === 'admin' || payload.role === 'operator') return true;

  var user = await env.DB.prepare('SELECT role FROM users WHERE id=?').bind(payload.sub).first();
  return !!(user && (user.role === 'admin' || user.role === 'operator'));
}

async function COMMUNITY_V2_handlePostList(request, env) {
  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var url = new URL(request.url);
  var board = String(url.searchParams.get('board') || 'community').trim();
  var category = String(url.searchParams.get('category') || '').trim();
  var page = Math.max(1, COMMUNITY_V2_toInt(url.searchParams.get('page'), 1));
  var pageSize = Math.min(50, Math.max(1, COMMUNITY_V2_toInt(url.searchParams.get('pageSize'), 30)));
  var offset = (page - 1) * pageSize;
  var scope = COMMUNITY_V2_scope(url.searchParams.get('scope') || 'all');
  var q = String(url.searchParams.get('q') || '').trim();

  var where = ['p.board=?', 'p.is_deleted=0'];
  var binds = [board];

  if (category) {
    where.push('p.category=?');
    binds.push(category);
  }

  if (q) {
    var escaped = '%' + COMMUNITY_V2_escapeLike(q) + '%';

    if (scope === 'title') {
      where.push("p.title LIKE ? ESCAPE '\\\\'");
      binds.push(escaped);
    } else if (scope === 'content') {
      where.push("p.content LIKE ? ESCAPE '\\\\'");
      binds.push(escaped);
    } else if (scope === 'title_content') {
      where.push("(p.title LIKE ? ESCAPE '\\\\' OR p.content LIKE ? ESCAPE '\\\\')");
      binds.push(escaped, escaped);
    } else if (scope === 'author') {
      where.push("u.name LIKE ? ESCAPE '\\\\'");
      binds.push(escaped);
    } else {
      where.push("(p.title LIKE ? ESCAPE '\\\\' OR p.content LIKE ? ESCAPE '\\\\' OR u.name LIKE ? ESCAPE '\\\\')");
      binds.push(escaped, escaped, escaped);
    }
  }

  var whereSql = where.join(' AND ');

  var listSql =
    'SELECT p.id, p.board, p.category, p.title, p.content, ' +
    'p.view_count, p.like_count, p.comment_count, p.is_pinned, ' +
    'p.created_at, p.updated_at, u.name AS author_name ' +
    'FROM posts p ' +
    'LEFT JOIN users u ON u.id = p.user_id ' +
    'WHERE ' + whereSql + ' ' +
    'ORDER BY p.is_pinned DESC, p.created_at DESC ' +
    'LIMIT ? OFFSET ?';

  var countSql =
    'SELECT COUNT(*) AS cnt ' +
    'FROM posts p ' +
    'LEFT JOIN users u ON u.id = p.user_id ' +
    'WHERE ' + whereSql;

  var listRes = await db.prepare(listSql).bind.apply(
    db.prepare(listSql),
    binds.concat([pageSize, offset])
  ).all();

  var countRes = await db.prepare(countSql).bind.apply(
    db.prepare(countSql),
    binds
  ).first();

  return jsonResp({
    ok: true,
    posts: listRes.results || [],
    total: countRes ? countRes.cnt : 0,
    page: page,
    pageSize: pageSize
  });
}

async function COMMUNITY_V2_handlePostDetail(request, env, pathname) {
  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var id = COMMUNITY_V2_postIdFromPath(pathname);
  if (!id) return jsonResp({ ok: false, error: 'invalid post id' }, 400);

  var post = await db.prepare(
    'SELECT p.*, u.name AS author_name ' +
    'FROM posts p ' +
    'LEFT JOIN users u ON u.id = p.user_id ' +
    'WHERE p.id=? AND p.is_deleted=0'
  ).bind(id).first();

  if (!post) return jsonResp({ ok: false, error: 'Post not found' }, 404);

  await db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id=?').bind(id).run();
  post.view_count = (post.view_count || 0) + 1;

  return jsonResp({ ok: true, post: post });
}

async function COMMUNITY_V2_handleCommentList(request, env, pathname) {
  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var postId = COMMUNITY_V2_postIdFromPath(pathname);
  if (!postId) return jsonResp({ ok: false, error: 'invalid post id' }, 400);

  var url = new URL(request.url);
  var page = Math.max(1, COMMUNITY_V2_toInt(url.searchParams.get('page'), 1));
  var pageSize = Math.min(100, Math.max(1, COMMUNITY_V2_toInt(url.searchParams.get('pageSize'), 100)));
  var offset = (page - 1) * pageSize;

  var rows = await db.prepare(
    'SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at, c.like_count, ' +
    'u.name AS author_name ' +
    'FROM comments c ' +
    'LEFT JOIN users u ON u.id = c.user_id ' +
    'WHERE c.post_id=? AND c.is_deleted=0 ' +
    'ORDER BY c.created_at ASC ' +
    'LIMIT ? OFFSET ?'
  ).bind(postId, pageSize, offset).all();

  var count = await db.prepare(
    'SELECT COUNT(*) AS cnt FROM comments WHERE post_id=? AND is_deleted=0'
  ).bind(postId).first();

  var resultRows = rows.results || [];

  return jsonResp({
    ok: true,
    comments: resultRows,
    tree: COMMUNITY_V2_commentTree(resultRows),
    total: count ? count.cnt : 0,
    page: page,
    pageSize: pageSize
  });
}

async function COMMUNITY_V2_handlePostCreate(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);

  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResp({ ok: false, error: 'invalid JSON' }, 400);
  }

  var board = String(body.board || 'community').trim();
  var category = String(body.category || '').trim();
  var title = String(body.title || '').trim();
  var content = String(body.content || '').trim();

  if (!title || !content) return jsonResp({ ok: false, error: 'title and content required' }, 400);
  if (board !== 'community') return jsonResp({ ok: false, error: 'invalid board' }, 400);

  var allowedCategories = ['notice', 'greeting', 'free', 'share', 'logic'];
  if (allowedCategories.indexOf(category) === -1) {
    return jsonResp({ ok: false, error: 'invalid category' }, 400);
  }

  if (category === 'notice') {
    var isAdmin = await COMMUNITY_V2_isAdmin(payload, env);
    if (!isAdmin) {
      return jsonResp({ ok: false, error: '공지사항은 운영자만 작성할 수 있습니다.' }, 403);
    }
  }

  var nowIso = new Date().toISOString();
  var result = await db.prepare(
    'INSERT INTO posts(user_id, board, category, title, content, is_pinned, created_at, updated_at) ' +
    'VALUES(?,?,?,?,?,?,?,?)'
  ).bind(
    payload.sub,
    board,
    category,
    title,
    content,
    category === 'notice' ? 1 : 0,
    nowIso,
    nowIso
  ).run();

  return jsonResp({ ok: true, id: result.meta.last_row_id });
}

async function COMMUNITY_V2_handleCommentCreate(request, env, pathname) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);

  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var postId = COMMUNITY_V2_postIdFromPath(pathname);
  if (!postId) return jsonResp({ ok: false, error: 'invalid post id' }, 400);

  var body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResp({ ok: false, error: 'invalid JSON' }, 400);
  }

  var content = String(body.content || '').trim();
  var parentId = body.parentId ? parseInt(body.parentId, 10) : null;
  if (!content) return jsonResp({ ok: false, error: 'content required' }, 400);

  if (parentId) {
    var parent = await db.prepare(
      'SELECT id, post_id FROM comments WHERE id=? AND is_deleted=0'
    ).bind(parentId).first();

    if (!parent || parent.post_id !== postId) {
      return jsonResp({ ok: false, error: 'invalid parent comment' }, 400);
    }
  }

  var nowIso = new Date().toISOString();

  await db.batch([
    db.prepare(
      'INSERT INTO comments(post_id, user_id, parent_id, content, created_at) VALUES(?,?,?,?,?)'
    ).bind(postId, payload.sub, parentId, content, nowIso),
    db.prepare(
      'UPDATE posts SET comment_count = comment_count + 1, updated_at=? WHERE id=?'
    ).bind(nowIso, postId)
  ]);

  return jsonResp({ ok: true });
}

async function COMMUNITY_V2_handleAttendanceStatus(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);

  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var today = kstDateString();
  var todayRecord = await db.prepare(
    'SELECT * FROM attendance WHERE user_id=? AND check_date=?'
  ).bind(payload.sub, today).first();

  var monthStart = today.substring(0, 7) + '-01';
  var monthRecords = await db.prepare(
    'SELECT a.check_date, a.reward, a.streak, a.created_at, COALESCE(a.message, \'\') AS message ' +
    'FROM attendance a ' +
    'WHERE a.user_id=? AND a.check_date>=? ' +
    'ORDER BY a.check_date ASC'
  ).bind(payload.sub, monthStart).all();

  return jsonResp({
    ok: true,
    checkedToday: !!todayRecord,
    currentStreak: todayRecord ? todayRecord.streak : 0,
    monthRecords: monthRecords.results || []
  });
}

async function COMMUNITY_V2_handleAttendanceFeed(request, env) {
  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var url = new URL(request.url);
  var page = Math.max(1, COMMUNITY_V2_toInt(url.searchParams.get('page'), 1));
  var pageSize = Math.min(50, Math.max(1, COMMUNITY_V2_toInt(url.searchParams.get('pageSize'), 30)));
  var offset = (page - 1) * pageSize;

  var rows = await db.prepare(
    'SELECT a.id, a.check_date, a.reward, a.streak, a.created_at, COALESCE(a.message, \'\') AS message, ' +
    'u.name AS author_name ' +
    'FROM attendance a ' +
    'LEFT JOIN users u ON u.id = a.user_id ' +
    'ORDER BY a.check_date DESC, a.created_at DESC ' +
    'LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all();

  var count = await db.prepare('SELECT COUNT(*) AS cnt FROM attendance').first();

  return jsonResp({
    ok: true,
    rows: rows.results || [],
    total: count ? count.cnt : 0,
    page: page,
    pageSize: pageSize
  });
}

async function COMMUNITY_V2_handleAttendanceCheckin(request, env) {
  var payload = await requireAuth(request, env);
  if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);

  var db = env.DB;
  await COMMUNITY_V2_ensureSchema(db);

  var body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  var message = String(body.message || '').trim();
  if (!message) return jsonResp({ ok: false, error: 'message required' }, 400);

  var today = kstDateString();
  var existing = await db.prepare(
    'SELECT id FROM attendance WHERE user_id=? AND check_date=?'
  ).bind(payload.sub, today).first();

  if (existing) {
    return jsonResp({ ok: false, error: '오늘은 이미 출석했습니다.' }, 409);
  }

  var yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000).toISOString().slice(0, 10);
  var yesterdayRecord = await db.prepare(
    'SELECT streak FROM attendance WHERE user_id=? AND check_date=?'
  ).bind(payload.sub, yesterday).first();

  var streak = yesterdayRecord ? (yesterdayRecord.streak + 1) : 1;

  var reward = 10;
  if (streak >= 30) reward = 50;
  else if (streak >= 14) reward = 30;
  else if (streak >= 7) reward = 20;

  var newBalance = await addSnowball(
    db,
    payload.sub,
    reward,
    'earn',
    '출석체크 보상 (연속 ' + streak + '일)',
    'attendance',
    today
  );

  await db.prepare(
    'INSERT INTO attendance(user_id, check_date, reward, streak, message, created_at) VALUES(?,?,?,?,?,?)'
  ).bind(payload.sub, today, reward, streak, message, kstNowString()).run();

  return jsonResp({
    ok: true,
    streak: streak,
    reward: reward,
    newBalance: newBalance
  });
}

// ════════════════════════════════════════
// DEV SESSION (임시 개발용)
// index.js 맨 하단에 추가
// ════════════════════════════════════════
async function DEV_SESSION_handle(request, env) {
  try {
    var db = env.DB;
    if (!db) return jsonResp({ ok: false, error: 'DB not configured' }, 500);

    var body = {};
    try { body = await request.json(); } catch (e) {}

    var key = String(body.key || '').trim();

    // 임시 개발용 키 — 실제 운영 전 반드시 제거/변경
    if (key !== 'sherpain-dev-2026') {
      return jsonResp({ ok: false, error: 'invalid dev key' }, 403);
    }

    var loginId = 'dev_owner';
    var email = 'owner@sherpain21.com';
    var nowIso = new Date().toISOString();

    var user = await db.prepare(
      'SELECT id, email, name, phone, role, plan, provider, login_id, tokens FROM users WHERE login_id=? OR email=? LIMIT 1'
    ).bind(loginId, email).first();

    if (!user) {
      var id = uuid();
      var referralCode = 'DEV' + Date.now().toString(36).toUpperCase();

      await db.batch([
        db.prepare(
          'INSERT INTO users(id, email, name, phone, role, plan, provider, provider_id, biz_type, store_name, agency_name, tokens, referral_code, login_id, password_hash, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(
          id,
          email,
          '대표님',
          '',
          'admin',
          'c',
          'dev',
          null,
          '',
          '',
          '',
          125000,
          referralCode,
          loginId,
          null,
          nowIso,
          nowIso
        ),
        db.prepare(
          'INSERT INTO snowball_transactions(user_id, type, amount, balance_after, description, ref_type) VALUES(?,?,?,?,?,?)'
        ).bind(
          id,
          'earn',
          125000,
          125000,
          '개발용 테스트 세션 지급',
          'dev'
        )
      ]);

      user = {
        id: id,
        email: email,
        name: '대표님',
        phone: '',
        role: 'admin',
        plan: 'c',
        provider: 'dev',
        login_id: loginId,
        tokens: 125000
      };
    } else {
      await db.prepare(
        'UPDATE users SET role=?, plan=?, provider=?, tokens=?, updated_at=? WHERE id=?'
      ).bind('admin', 'c', 'dev', 125000, nowIso, user.id).run();

      user.role = 'admin';
      user.plan = 'c';
      user.provider = 'dev';
      user.tokens = 125000;
    }

    var token = await issueUserToken(user, env);

    return jsonResp({
      ok: true,
      token: token,
      user: {
        id: user.id,
        email: user.email || '',
        name: user.name || '대표님',
        phone: user.phone || '',
        role: user.role || 'admin',
        plan: user.plan || 'c',
        provider: user.provider || 'dev',
        login_id: user.login_id || loginId,
        snowball: user.tokens || 125000
      }
    });
  } catch (e) {
    console.error('DEV_SESSION_handle failed:', e);
    return jsonResp({ ok: false, error: e.message || 'DEV_SESSION failed' }, 500);
  }
}