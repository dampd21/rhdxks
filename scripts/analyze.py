import json
import math
import csv
import random
import re
from pathlib import Path
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "control_group.json"
DATA_DIR = ROOT / "data" / "batch"
DIST_DIR = ROOT / "dist"

DIST_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

OP_ORDER = [
    "getMyPlaceProfile",
    "getUnifiedCoupons",
    "getAiBriefing",
    "getVisitorReviews",
    "getVisitorReviewStats_item0",
    "getVisitorReviewStats_total",
]

GROUPS = [
    "review_power",
    "quality_trust",
    "freshness_engagement",
    "commercial_signal",
    "semantic_seo",
]

DEFAULT_GROUP_WEIGHTS = {
    "review_power": 0.30,
    "quality_trust": 0.25,
    "freshness_engagement": 0.15,
    "commercial_signal": 0.10,
    "semantic_seo": 0.20,
}

INTENT_SYNONYMS = {
    "맛집": [
        "맛있", "맛있어요", "추천", "재방문", "가성비",
        "푸짐", "친절", "만족", "분위기", "신선"
    ]
}


def safe_div(a, b):
    try:
        return a / b if b not in (0, None) else 0.0
    except Exception:
        return 0.0


def dig(obj, *keys, default=None):
    cur = obj
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None:
            return default
    return cur


def norm_text(s):
    if s is None:
        return ""
    s = str(s).lower()
    s = re.sub(r"[^0-9a-z가-힣\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_dt(val):
    if not val:
        return None
    try:
        s = str(val).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def load_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def find_batch_file(rank, place_id):
    exact_candidates = [
        DATA_DIR / f"{rank:02d}_{place_id}.json",
        DATA_DIR / f"{rank}_{place_id}.json",
        DATA_DIR / f"{place_id}.json",
    ]
    for path in exact_candidates:
        if path.exists():
            return path

    pattern_candidates = sorted(DATA_DIR.glob(f"*_{place_id}.json"))
    if pattern_candidates:
        return pattern_candidates[0]

    return None


def load_batch(path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw

    if isinstance(raw, dict):
        # 혹시 wrapper 형태면
        for key in ("parsed_json", "batch", "response"):
            if isinstance(raw.get(key), list):
                return raw[key]

    raise ValueError(f"지원하지 않는 JSON 형식: {path.name}")


def map_batch_response(resp_list):
    mapped = {}
    for i, item in enumerate(resp_list):
        key = OP_ORDER[i] if i < len(OP_ORDER) else f"op_{i}"
        if isinstance(item, dict):
            mapped[key] = item.get("data", item)
        else:
            mapped[key] = item
    return mapped


def flatten_texts(batch):
    texts = []

    place_name = dig(batch, "getVisitorReviewStats_total", "visitorReviewStats", "name", default="")
    if place_name:
        texts.append(place_name)

    ai = dig(batch, "getAiBriefing", "aiBriefing", default={}) or {}
    for x in ai.get("textSummaries", []) or []:
        texts.append(x.get("sentence", ""))
    for x in ai.get("relatedQueries", []) or []:
        texts.append(x.get("query", ""))
        texts.append(x.get("pattern", ""))

    analysis = dig(batch, "getVisitorReviewStats_total", "visitorReviewStats", "analysis", default={}) or {}
    for x in analysis.get("menus", []) or []:
        texts.append(x.get("label", ""))
    for x in analysis.get("themes", []) or []:
        texts.append(x.get("label", ""))
    for x in dig(analysis, "votedKeyword", "details", default=[]) or []:
        texts.append(x.get("displayName", ""))

    items = dig(batch, "getVisitorReviews", "visitorReviews", "items", default=[]) or []
    for item in items:
        texts.append(item.get("body", ""))
        for kw in item.get("votedKeywords", []) or []:
            texts.append(kw.get("name", ""))

    return norm_text(" ".join([x for x in texts if x]))


def compute_query_fit_score(query, place_name, whole_text, review_total, avg_rating):
    q = norm_text(query)
    name_n = norm_text(place_name)
    text_n = norm_text(whole_text)

    tokens = [t for t in q.split() if t]
    location_tokens = []
    intent_terms = []

    for tok in tokens:
        if tok in INTENT_SYNONYMS:
            intent_terms.extend([tok] + INTENT_SYNONYMS[tok])
        else:
            location_tokens.append(tok)

    def hit_ratio(text, terms):
        if not terms:
            return 0.0
        hit_count = sum(1 for term in terms if term and term in text)
        return min(1.0, hit_count / len(terms))

    loc_name = hit_ratio(name_n, location_tokens)
    loc_text = hit_ratio(text_n, location_tokens)
    intent_name = hit_ratio(name_n, intent_terms)

    unique_intent_hits = len({term for term in intent_terms if term and term in text_n})
    intent_text = min(1.0, unique_intent_hits / 5.0)

    trust_bonus = min(1.0, math.log1p(review_total) / math.log(2000)) if review_total else 0.0
    rating_bonus = min(1.0, avg_rating / 5.0) if avg_rating else 0.0

    score = 100 * (
        0.20 * loc_name +
        0.15 * loc_text +
        0.10 * intent_name +
        0.30 * intent_text +
        0.15 * trust_bonus +
        0.10 * rating_bonus
    )
    return round(score, 2)


def extract_features(place_id, rank, batch, query, data_file):
    stats = dig(batch, "getVisitorReviewStats_total", "visitorReviewStats", default={}) or {}
    review = stats.get("review", {}) or {}
    analysis = stats.get("analysis", {}) or {}
    voted = analysis.get("votedKeyword", {}) or {}
    voted_details = voted.get("details", []) or []
    themes = analysis.get("themes", []) or []
    menus = analysis.get("menus", []) or []

    visitor_reviews = dig(batch, "getVisitorReviews", "visitorReviews", default={}) or {}
    items = visitor_reviews.get("items", []) or []

    unified = dig(batch, "getUnifiedCoupons", "unifiedCoupons", default={}) or {}
    talk_alarm = dig(batch, "getUnifiedCoupons", "naverTalk", "alarm", default={}) or {}

    ai = dig(batch, "getAiBriefing", "aiBriefing", default={}) or {}

    place_name = stats.get("name", "") or str(place_id)

    review_total = review.get("totalCount") or visitor_reviews.get("total") or 0
    avg_rating = review.get("avgRating") or visitor_reviews.get("score") or 0
    image_review_count = review.get("imageReviewCount") or 0
    author_count = review.get("authorCount") or 0
    max_single_review_score_count = review.get("maxSingleReviewScoreCount") or 0

    voted_total_count = voted.get("totalCount") or 0
    voted_review_count = voted.get("reviewCount") or 0
    voted_user_count = voted.get("userCount") or 0

    top_keyword_name = ""
    top_keyword_count = 0
    if voted_details:
        top_kw = max(voted_details, key=lambda x: x.get("count", 0))
        top_keyword_name = top_kw.get("displayName", "") or ""
        top_keyword_count = top_kw.get("count", 0) or 0

    theme_sum = sum((x.get("count", 0) or 0) for x in themes)
    menu_sum = sum((x.get("count", 0) or 0) for x in menus)

    now = datetime.now(timezone.utc)
    body_lengths = []
    reply_flags = []
    media_flags = []
    reaction_counts = []
    ages = []

    for item in items:
        body = item.get("body", "") or ""
        body_lengths.append(len(body))

        media_flags.append(1 if item.get("media") else 0)

        reply = item.get("reply", {}) or {}
        reply_flags.append(1 if reply.get("body") else 0)

        reaction_counts.append(dig(item, "reactionStat", "totalCount", default=0) or 0)

        created = parse_dt(item.get("created"))
        if created:
            ages.append(max((now - created).days, 0))

    body_len_avg = sum(body_lengths) / len(body_lengths) if body_lengths else 0.0
    reply_ratio = sum(reply_flags) / len(reply_flags) if reply_flags else 0.0
    media_ratio = sum(media_flags) / len(media_flags) if media_flags else 0.0
    reactions_total = sum(reaction_counts) if reaction_counts else 0.0
    avg_age_days = sum(ages) / len(ages) if ages else 999.0
    freshness_inv = 1.0 / (1.0 + avg_age_days / 30.0)

    coupon_count = unified.get("total") or len(unified.get("coupons", []) or [])
    membership_count = len(unified.get("memberships", []) or [])

    talk_enabled = 1 if talk_alarm else 0

    ai_text_count = len(ai.get("textSummaries", []) or [])
    ai_image_count = len(ai.get("imageSummaries", []) or [])
    ai_related_query_count = len(ai.get("relatedQueries", []) or [])
    ai_video_count = len(ai.get("videoSources", []) or [])
    ai_content_count = ai_text_count + ai_image_count + ai_related_query_count + ai_video_count

    whole_text = flatten_texts(batch)
    query_fit = compute_query_fit_score(
        query=query,
        place_name=place_name,
        whole_text=whole_text,
        review_total=review_total,
        avg_rating=avg_rating
    )

    return {
        "place_id": str(place_id),
        "actual_rank": int(rank),
        "data_file": data_file,
        "place_name": place_name,

        "review_total": float(review_total),
        "avg_rating": float(avg_rating),
        "image_review_count": float(image_review_count),
        "image_review_ratio": safe_div(float(image_review_count), float(review_total)),
        "author_count": float(author_count),
        "author_diversity": safe_div(float(author_count), float(review_total)),
        "max_score_ratio": safe_div(float(max_single_review_score_count), float(review_total)),

        "voted_total_count": float(voted_total_count),
        "voted_review_count": float(voted_review_count),
        "voted_user_count": float(voted_user_count),
        "top_keyword_name": top_keyword_name,
        "top_keyword_count": float(top_keyword_count),

        "theme_sum": float(theme_sum),
        "menu_sum": float(menu_sum),

        "body_len_avg": float(body_len_avg),
        "reply_ratio": float(reply_ratio),
        "media_ratio": float(media_ratio),
        "reactions_total": float(reactions_total),
        "avg_age_days": float(avg_age_days),
        "freshness_inv": float(freshness_inv),

        "coupon_count": float(coupon_count),
        "membership_count": float(membership_count),
        "talk_enabled": float(talk_enabled),

        "ai_content_count": float(ai_content_count),
        "query_fit": float(query_fit),
    }


def minmax_normalize(rows, key):
    vals = [r.get(key, 0.0) for r in rows]
    vals = [0.0 if v is None else float(v) for v in vals]
    mn = min(vals) if vals else 0.0
    mx = max(vals) if vals else 0.0

    result = {}
    if not vals:
        return result

    if mx == mn:
        for r in rows:
            result[r["place_id"]] = 0.5
        return result

    for r in rows:
        v = 0.0 if r.get(key) is None else float(r.get(key))
        result[r["place_id"]] = (v - mn) / (mx - mn)
    return result


def build_group_scores(rows):
    feature_keys = [
        "review_total",
        "avg_rating",
        "image_review_count",
        "image_review_ratio",
        "author_count",
        "author_diversity",
        "max_score_ratio",
        "voted_review_count",
        "body_len_avg",
        "freshness_inv",
        "reply_ratio",
        "media_ratio",
        "reactions_total",
        "coupon_count",
        "membership_count",
        "talk_enabled",
        "theme_sum",
        "menu_sum",
        "top_keyword_count",
        "ai_content_count",
        "query_fit",
    ]

    norms = {k: minmax_normalize(rows, k) for k in feature_keys}

    for r in rows:
        pid = r["place_id"]

        r["review_power"] = 100 * (
            0.45 * norms["review_total"][pid] +
            0.20 * norms["image_review_count"][pid] +
            0.15 * norms["author_count"][pid] +
            0.10 * norms["voted_review_count"][pid] +
            0.10 * norms["body_len_avg"][pid]
        )

        r["quality_trust"] = 100 * (
            0.55 * norms["avg_rating"][pid] +
            0.15 * norms["image_review_ratio"][pid] +
            0.15 * norms["author_diversity"][pid] +
            0.15 * norms["max_score_ratio"][pid]
        )

        r["freshness_engagement"] = 100 * (
            0.35 * norms["freshness_inv"][pid] +
            0.25 * norms["reply_ratio"][pid] +
            0.20 * norms["media_ratio"][pid] +
            0.20 * norms["reactions_total"][pid]
        )

        r["commercial_signal"] = 100 * (
            0.55 * norms["coupon_count"][pid] +
            0.25 * norms["membership_count"][pid] +
            0.20 * norms["talk_enabled"][pid]
        )

        r["semantic_seo"] = 100 * (
            0.40 * norms["query_fit"][pid] +
            0.20 * norms["theme_sum"][pid] +
            0.15 * norms["menu_sum"][pid] +
            0.10 * norms["top_keyword_count"][pid] +
            0.15 * norms["ai_content_count"][pid]
        )


def predicted_rank_map(rows, score_key="final_score"):
    ordered = sorted(rows, key=lambda x: x.get(score_key, 0), reverse=True)
    return {r["place_id"]: i + 1 for i, r in enumerate(ordered)}


def spearman_rank_corr(actual_rank, pred_score_rows):
    pred_rank = predicted_rank_map(pred_score_rows)
    ids = list(actual_rank.keys())
    n = len(ids)
    if n < 2:
        return 1.0
    d2 = sum((actual_rank[pid] - pred_rank[pid]) ** 2 for pid in ids)
    return 1 - (6 * d2) / (n * (n**2 - 1))


def pairwise_accuracy(actual_rank, pred_score_rows):
    pred_score = {r["place_id"]: r.get("final_score", 0.0) for r in pred_score_rows}
    ids = list(actual_rank.keys())
    total = 0
    correct = 0

    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            actual = actual_rank[a] < actual_rank[b]
            pred = pred_score[a] > pred_score[b]
            total += 1
            if actual == pred:
                correct += 1

    return safe_div(correct, total)


def random_weights():
    nums = [random.random() for _ in GROUPS]
    s = sum(nums) or 1.0
    return {g: nums[i] / s for i, g in enumerate(GROUPS)}


def apply_final_scores(rows, weights):
    for r in rows:
        r["final_score"] = sum(r[g] * weights[g] for g in GROUPS)


def tune_weights(rows):
    if len(rows) < 3:
        return DEFAULT_GROUP_WEIGHTS, {
            "objective": None,
            "pairwise_accuracy": None,
            "spearman_rho": None,
            "top1_correct": None,
        }

    actual_rank = {r["place_id"]: r["actual_rank"] for r in rows}

    best_weights = DEFAULT_GROUP_WEIGHTS.copy()
    best_metrics = None
    best_objective = -1

    for _ in range(12000):
        weights = random_weights()

        tmp_rows = [dict(r) for r in rows]
        apply_final_scores(tmp_rows, weights)

        pair = pairwise_accuracy(actual_rank, tmp_rows)
        rho = spearman_rank_corr(actual_rank, tmp_rows)
        pred_top = min(predicted_rank_map(tmp_rows), key=lambda x: predicted_rank_map(tmp_rows)[x])
        actual_top = min(actual_rank, key=actual_rank.get)
        top1 = 1 if pred_top == actual_top else 0

        objective = 0.55 * pair + 0.35 * ((rho + 1) / 2) + 0.10 * top1

        if objective > best_objective:
            best_objective = objective
            best_weights = weights
            best_metrics = {
                "objective": round(objective, 4),
                "pairwise_accuracy": round(pair, 4),
                "spearman_rho": round(rho, 4),
                "top1_correct": top1,
            }

    return best_weights, best_metrics


def explain_row(r, weights):
    contrib = {g: r[g] * weights[g] for g in GROUPS}
    top_groups = sorted(contrib.items(), key=lambda x: x[1], reverse=True)[:3]
    top_names = [x[0] for x in top_groups]

    reasons = []

    if "review_power" in top_names:
        reasons.append(
            f"리뷰 {int(r['review_total'])}개 / 이미지리뷰 {int(r['image_review_count'])}개 / 작성자 {int(r['author_count'])}명"
        )
    if "quality_trust" in top_names:
        reasons.append(
            f"평점 {r['avg_rating']:.2f} / 이미지비율 {r['image_review_ratio']:.1%}"
        )
    if "freshness_engagement" in top_names:
        reasons.append(
            f"답글비율 {r['reply_ratio']:.1%} / 최근성 {r['freshness_inv']:.3f}"
        )
    if "commercial_signal" in top_names:
        reasons.append(
            f"쿠폰 {int(r['coupon_count'])}개 / 멤버십 {int(r['membership_count'])}개 / 톡톡 {int(r['talk_enabled'])}"
        )
    if "semantic_seo" in top_names:
        reasons.append(
            f"키워드적합도 {r['query_fit']:.1f} / 상위키워드 '{r['top_keyword_name'] or '-'}'"
        )

    return " | ".join(reasons)


def write_csv(rows, path):
    if not rows:
        return
    keys = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)


def main():
    config = load_config()
    query = config.get("query", "")
    controls = config.get("controls", [])

    missing = []
    rows = []

    for item in controls:
        rank = int(item["rank"])
        place_id = str(item["place_id"])
        path = find_batch_file(rank, place_id)

        if path is None:
            missing.append({"rank": rank, "place_id": place_id, "reason": "json not found"})
            continue

        try:
            raw = load_batch(path)
            batch = map_batch_response(raw)
            row = extract_features(place_id, rank, batch, query, path.name)
            rows.append(row)
        except Exception as e:
            missing.append({"rank": rank, "place_id": place_id, "reason": str(e)})

    report = {
        "generated_at": datetime.now().isoformat(),
        "query": query,
        "expected_count": len(controls),
        "collected_count": len(rows),
        "missing_count": len(missing),
        "status": "ok" if not missing else "incomplete",
        "metrics": {},
        "weights": [],
        "missing": missing,
        "rows": [],
    }

    if rows:
        build_group_scores(rows)
        weights, metrics = tune_weights(rows)
        apply_final_scores(rows, weights)

        pred_map = predicted_rank_map(rows)

        for r in rows:
            r["pred_rank"] = pred_map[r["place_id"]]
            r["rank_gap"] = r["pred_rank"] - r["actual_rank"]
            r["why_top"] = explain_row(r, weights)

        rows_sorted = sorted(rows, key=lambda x: x["actual_rank"])

        report["metrics"] = metrics
        report["weights"] = [
            {
                "group": g,
                "weight": round(weights[g], 4),
                "percent": round(weights[g] * 100, 2)
            }
            for g in GROUPS
        ]
        report["rows"] = rows_sorted

        write_csv(rows_sorted, DIST_DIR / "features.csv")

    (DIST_DIR / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    (DIST_DIR / "summary.md").write_text(
        f"# Naver Place Rank Lab\n\n"
        f"- Query: {report['query']}\n"
        f"- Generated: {report['generated_at']}\n"
        f"- Collected: {report['collected_count']} / {report['expected_count']}\n"
        f"- Missing: {report['missing_count']}\n"
        f"- Status: {report['status']}\n",
        encoding="utf-8"
    )

    print("report created:", DIST_DIR / "report.json")


if __name__ == "__main__":
    main()
