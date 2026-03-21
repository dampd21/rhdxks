import json
import math
import re
import itertools
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "control_group.json"
DATA_DIR = ROOT / "data" / "batch"
DIST_DIR = ROOT / "dist"
DIST_DIR.mkdir(parents=True, exist_ok=True)

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

INTENT_SYNONYMS = {
    "맛집": [
        "맛있", "맛있어요", "추천", "재방문", "가성비",
        "신선", "푸짐", "친절", "만족", "분위기", "특별",
        "음식이 맛있어요"
    ]
}


def safe_div(a, b):
    return a / b if b not in (0, None) else 0.0


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


def minmax(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce").fillna(0.0)
    mn, mx = s.min(), s.max()
    if mx == mn:
        return pd.Series([0.5] * len(s), index=s.index)
    return (s - mn) / (mx - mn)


def parse_dt(val):
    if not val:
        return None
    try:
        dt = pd.to_datetime(val, errors="coerce", utc=True)
        if pd.isna(dt):
            return None
        return dt.to_pydatetime()
    except Exception:
        return None


def load_config():
    raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return raw["query"], raw["controls"]


def find_batch_file(rank, place_id):
    candidates = [
        DATA_DIR / f"{rank:02d}_{place_id}.json",
        DATA_DIR / f"{place_id}.json",
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def load_batch(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(raw, list):
        return raw

    if isinstance(raw, dict):
        for key in ("parsed_json", "response", "batch"):
            val = raw.get(key)
            if isinstance(val, list):
                return val

    raise ValueError(f"지원하��� 않는 배치 형식: {path}")


def map_batch_response(resp_list):
    mapped = {}
    for i, item in enumerate(resp_list):
        key = OP_ORDER[i] if i < len(OP_ORDER) else f"op_{i}"
        mapped[key] = item.get("data", item)
        if "errors" in item:
            mapped[f"{key}_errors"] = item["errors"]
    return mapped


def flatten_texts(batch):
    texts = []

    name = dig(batch, "getVisitorReviewStats_total", "visitorReviewStats", "name", default="")
    texts.append(name)

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
        for tag in item.get("tags", []) or []:
            texts.append(str(tag))

    return norm_text(" ".join([t for t in texts if t]))


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
        hits = sum(1 for term in terms if term and term in text)
        return min(1.0, hits / len(terms))

    loc_name = hit_ratio(name_n, location_tokens)
    loc_text = hit_ratio(text_n, location_tokens)

    intent_name = hit_ratio(name_n, intent_terms)
    intent_text = 0.0
    if intent_terms:
        unique_hits = sum(1 for term in set(intent_terms) if term in text_n)
        intent_text = min(1.0, unique_hits / 5.0)

    trust_bonus = min(1.0, math.log1p(review_total) / math.log(2000))
    rating_bonus = min(1.0, avg_rating / 5.0 if avg_rating else 0.0)

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

    place_name = stats.get("name", "") or ""

    review_total = review.get("totalCount") or visitor_reviews.get("total") or 0
    avg_rating = review.get("avgRating") or visitor_reviews.get("score") or 0
    image_review_count = review.get("imageReviewCount") or 0
    author_count = review.get("authorCount") or 0
    max_single_review_score_count = review.get("maxSingleReviewScoreCount") or 0

    voted_total_count = voted.get("totalCount") or 0
    voted_review_count = voted.get("reviewCount") or 0
    voted_user_count = voted.get("userCount") or 0

    top_keyword_count = 0
    top_keyword_name = ""
    if voted_details:
        top_kw = max(voted_details, key=lambda x: x.get("count", 0))
        top_keyword_count = top_kw.get("count", 0) or 0
        top_keyword_name = top_kw.get("displayName", "") or ""

    theme_sum = sum(x.get("count", 0) or 0 for x in themes)
    menu_sum = sum(x.get("count", 0) or 0 for x in menus)

    body_lengths = []
    media_flags = []
    reply_flags = []
    reaction_counts = []
    created_days = []

    now = datetime.now(timezone.utc)

    for item in items:
        body = item.get("body", "") or ""
        body_lengths.append(len(body))
        media_flags.append(1 if item.get("media") else 0)
        reply = item.get("reply", {}) or {}
        reply_flags.append(1 if reply.get("body") else 0)
        reaction_counts.append(dig(item, "reactionStat", "totalCount", default=0) or 0)

        created = parse_dt(item.get("created"))
        if created is not None:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            days = (now - created).days
            created_days.append(max(days, 0))

    body_len_avg = float(np.mean(body_lengths)) if body_lengths else 0.0
    media_ratio = float(np.mean(media_flags)) if media_flags else 0.0
    reply_ratio = float(np.mean(reply_flags)) if reply_flags else 0.0
    reactions_total = int(np.sum(reaction_counts)) if reaction_counts else 0
    avg_age_days = float(np.mean(created_days)) if created_days else 999.0
    freshness_inv = 1.0 / (1.0 + avg_age_days / 30.0)

    coupon_count = unified.get("total") or len(unified.get("coupons", []) or [])
    membership_count = len(unified.get("memberships", []) or [])

    talk_enabled = 1 if talk_alarm else 0
    talk_friend = 1 if str(talk_alarm.get("friendYn", "N")).upper() in {"Y", "TRUE", "1"} else 0

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
        avg_rating=avg_rating,
    )

    return {
        "place_id": str(place_id),
        "actual_rank": int(rank),
        "data_file": data_file,
        "place_name": place_name or place_id,

        "review_total": float(review_total),
        "log_review_total": math.log1p(float(review_total)),
        "avg_rating": float(avg_rating),
        "image_review_count": float(image_review_count),
        "image_review_ratio": safe_div(float(image_review_count), float(review_total)),
        "author_count": float(author_count),
        "author_diversity": safe_div(float(author_count), float(review_total)),
        "max_score_ratio": safe_div(float(max_single_review_score_count), float(review_total)),

        "voted_total_count": float(voted_total_count),
        "voted_review_count": float(voted_review_count),
        "voted_user_count": float(voted_user_count),
        "top_keyword_count": float(top_keyword_count),
        "top_keyword_name": top_keyword_name,
        "top_keyword_focus": safe_div(float(top_keyword_count), float(voted_total_count)),

        "theme_sum": float(theme_sum),
        "menu_sum": float(menu_sum),

        "body_len_avg": float(body_len_avg),
        "media_ratio": float(media_ratio),
        "reply_ratio": float(reply_ratio),
        "reactions_total": float(reactions_total),
        "avg_age_days": float(avg_age_days),
        "freshness_inv": float(freshness_inv),

        "coupon_count": float(coupon_count),
        "membership_count": float(membership_count),
        "talk_enabled": float(talk_enabled),
        "talk_friend": float(talk_friend),

        "ai_text_count": float(ai_text_count),
        "ai_image_count": float(ai_image_count),
        "ai_related_query_count": float(ai_related_query_count),
        "ai_video_count": float(ai_video_count),
        "ai_content_count": float(ai_content_count),

        "query_fit": float(query_fit),
    }


def build_group_scores(raw_df):
    df = raw_df.copy()

    numeric_cols = [
        "log_review_total",
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

    norm = pd.DataFrame(index=df.index)
    for col in numeric_cols:
        norm[col] = minmax(df[col])

    df["review_power"] = 100 * (
        0.45 * norm["log_review_total"] +
        0.20 * norm["image_review_count"] +
        0.15 * norm["author_count"] +
        0.10 * norm["voted_review_count"] +
        0.10 * norm["body_len_avg"]
    )

    df["quality_trust"] = 100 * (
        0.55 * norm["avg_rating"] +
        0.15 * norm["image_review_ratio"] +
        0.15 * norm["author_diversity"] +
        0.15 * norm["max_score_ratio"]
    )

    df["freshness_engagement"] = 100 * (
        0.35 * norm["freshness_inv"] +
        0.25 * norm["reply_ratio"] +
        0.20 * norm["media_ratio"] +
        0.20 * norm["reactions_total"]
    )

    df["commercial_signal"] = 100 * (
        0.55 * norm["coupon_count"] +
        0.25 * norm["membership_count"] +
        0.20 * norm["talk_enabled"]
    )

    df["semantic_seo"] = 100 * (
        0.40 * norm["query_fit"] +
        0.20 * norm["theme_sum"] +
        0.15 * norm["menu_sum"] +
        0.10 * norm["top_keyword_count"] +
        0.15 * norm["ai_content_count"]
    )

    return df


def predicted_rank_from_scores(score_dict):
    ordered = sorted(score_dict.items(), key=lambda x: x[1], reverse=True)
    return {pid: i + 1 for i, (pid, _) in enumerate(ordered)}


def spearman_rank_corr(actual_rank, pred_score):
    ids = list(actual_rank.keys())
    pred_rank = predicted_rank_from_scores(pred_score)
    n = len(ids)
    if n < 2:
        return 1.0
    d2 = sum((actual_rank[pid] - pred_rank[pid]) ** 2 for pid in ids)
    return 1 - (6 * d2) / (n * (n**2 - 1))


def pairwise_accuracy(actual_rank, pred_score):
    ids = list(actual_rank.keys())
    correct = 0
    total = 0
    for a, b in itertools.combinations(ids, 2):
        total += 1
        actual = actual_rank[a] < actual_rank[b]
        pred = pred_score[a] > pred_score[b]
        if actual == pred:
            correct += 1
    return safe_div(correct, total)


def tune_group_weights(df, target_rank, n_iter=25000, seed=42):
    rng = np.random.default_rng(seed)
    best = None

    for _ in range(n_iter):
        weights = rng.dirichlet(np.ones(len(GROUPS)))
        score_series = df[GROUPS].mul(weights, axis=1).sum(axis=1)
        score_dict = score_series.to_dict()

        rho = spearman_rank_corr(target_rank, score_dict)
        pair = pairwise_accuracy(target_rank, score_dict)
        top_actual = min(target_rank, key=target_rank.get)
        top1_ok = int(score_series.idxmax() == top_actual)

        objective = 0.55 * pair + 0.35 * ((rho + 1) / 2) + 0.10 * top1_ok

        if best is None or objective > best["objective"]:
            best = {
                "weights": dict(zip(GROUPS, weights)),
                "objective": objective,
                "rho": rho,
                "pairwise_accuracy": pair,
                "top1_ok": top1_ok,
            }

    return best


def explain_row(row, weight_map):
    contrib = {g: row[g] * weight_map[g] for g in GROUPS}
    top_groups = [k for k, _ in sorted(contrib.items(), key=lambda x: x[1], reverse=True)[:3]]

    reasons = []

    if "review_power" in top_groups:
        reasons.append(
            f"리뷰 {int(row['review_total'])}개 / 이미지리뷰 {int(row['image_review_count'])}개 / 작성자 {int(row['author_count'])}명"
        )
    if "quality_trust" in top_groups:
        reasons.append(
            f"평점 {row['avg_rating']:.2f} / 이미지비율 {row['image_review_ratio']:.1%}"
        )
    if "freshness_engagement" in top_groups:
        reasons.append(
            f"답글비율 {row['reply_ratio']:.1%} / 최근성 {row['freshness_inv']:.3f}"
        )
    if "commercial_signal" in top_groups:
        reasons.append(
            f"쿠폰 {int(row['coupon_count'])}개 / 멤버십 {int(row['membership_count'])}개 / 톡톡 {int(row['talk_enabled'])}"
        )
    if "semantic_seo" in top_groups:
        reasons.append(
            f"키워드적합도 {row['query_fit']:.1f} / 상위키워드 '{row['top_keyword_name'] or '-'}'"
        )

    return " | ".join(reasons)


def clean_value(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        if pd.isna(v) or math.isinf(v):
            return None
        return float(round(float(v), 4))
    if isinstance(v, (np.bool_, bool)):
        return bool(v)
    return v


def clean_record(rec):
    return {k: clean_value(v) for k, v in rec.items()}


def main():
    query, controls = load_config()

    rows = []
    missing = []

    for item in controls:
        rank = int(item["rank"])
        place_id = str(item["place_id"])
        path = find_batch_file(rank, place_id)

        if path is None:
            missing.append({"rank": rank, "place_id": place_id})
            continue

        try:
            raw = load_batch(path)
            batch = map_batch_response(raw)
            row = extract_features(place_id, rank, batch, query, path.name)
            rows.append(row)
        except Exception as e:
            missing.append({
                "rank": rank,
                "place_id": place_id,
                "error": str(e),
            })

    report = {
        "generated_at": datetime.now().isoformat(),
        "query": query,
        "expected_count": len(controls),
        "collected_count": len(rows),
        "missing_count": len(missing),
        "missing": missing,
        "status": "incomplete" if missing else "ok",
        "weights": [],
        "metrics": {},
        "rows": [],
    }

    if rows:
        raw_df = pd.DataFrame(rows).set_index("place_id")
        scored_df = build_group_scores(raw_df)

        actual_rank = {idx: int(scored_df.loc[idx, "actual_rank"]) for idx in scored_df.index}

        if len(scored_df) >= 3:
            best = tune_group_weights(scored_df, actual_rank)
            weight_map = best["weights"]
            metrics = {
                "objective": round(best["objective"], 4),
                "spearman_rho": round(best["rho"], 4),
                "pairwise_accuracy": round(best["pairwise_accuracy"], 4),
                "top1_correct": int(best["top1_ok"]),
            }
        else:
            weight_map = {g: 1 / len(GROUPS) for g in GROUPS}
            final_scores = sum(scored_df[g] * weight_map[g] for g in GROUPS)
            metrics = {
                "objective": None,
                "spearman_rho": None,
                "pairwise_accuracy": None,
                "top1_correct": None,
            }

        scored_df["final_score"] = sum(scored_df[g] * weight_map[g] for g in GROUPS)
        scored_df["pred_rank"] = scored_df["final_score"].rank(ascending=False, method="first").astype(int)
        scored_df["rank_gap"] = scored_df["pred_rank"] - scored_df["actual_rank"]

        for g in GROUPS:
            scored_df[f"contrib_{g}"] = scored_df[g] * weight_map[g]

        scored_df["why_top"] = scored_df.apply(lambda r: explain_row(r, weight_map), axis=1)

        report["weights"] = [
            {
                "group": g,
                "weight": round(weight_map[g], 4),
                "percent": round(weight_map[g] * 100, 2),
            }
            for g in GROUPS
        ]
        report["metrics"] = metrics

        result = scored_df.sort_values("actual_rank").reset_index()

        csv_path = DIST_DIR / "features.csv"
        result.to_csv(csv_path, index=False, encoding="utf-8-sig")

        report["rows"] = [clean_record(rec) for rec in result.to_dict(orient="records")]

    report_path = DIST_DIR / "report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    summary_md = DIST_DIR / "summary.md"
    summary_md.write_text(
        f"# Naver Place Rank Lab\n\n"
        f"- Query: {report['query']}\n"
        f"- Generated At: {report['generated_at']}\n"
        f"- Collected: {report['collected_count']} / {report['expected_count']}\n"
        f"- Missing: {report['missing_count']}\n"
        f"- Status: {report['status']}\n",
        encoding="utf-8"
    )

    print(f"[DONE] report -> {report_path}")
    if rows:
        print(f"[DONE] csv    -> {csv_path}")


if __name__ == "__main__":
    main()
