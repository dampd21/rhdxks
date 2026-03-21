import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "control_group.json"
DATA_DIR = ROOT / "data" / "batch"
DIST_DIR = ROOT / "dist"

DIST_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

def main():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    query = config.get("query", "")
    controls = config.get("controls", [])

    existing_files = {p.name for p in DATA_DIR.glob("*.json")}

    rows = []
    collected_count = 0

    for item in controls:
        rank = int(item["rank"])
        place_id = str(item["place_id"])

        expected_names = {
            f"{rank:02d}_{place_id}.json",
            f"{place_id}.json",
        }
        has_data = any(name in existing_files for name in expected_names)
        if has_data:
            collected_count += 1

        rows.append({
            "actual_rank": rank,
            "pred_rank": None,
            "rank_gap": None,
            "place_id": place_id,
            "place_name": place_id,
            "final_score": None,
            "query_fit": None,
            "review_total": None,
            "avg_rating": None,
            "coupon_count": None,
            "talk_enabled": None,
            "why_top": "데이터 수집 전 상태" if not has_data else "수집 데이터 존재",
            "has_data": has_data
        })

    report = {
        "generated_at": datetime.now().isoformat(),
        "query": query,
        "expected_count": len(controls),
        "collected_count": collected_count,
        "missing_count": len(controls) - collected_count,
        "status": "ok" if collected_count == len(controls) else "incomplete",
        "metrics": {
            "pairwise_accuracy": None,
            "spearman_rho": None
        },
        "weights": [],
        "missing": [
            {"rank": r["actual_rank"], "place_id": r["place_id"]}
            for r in rows if not r["has_data"]
        ],
        "rows": rows
    }

    (DIST_DIR / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    (DIST_DIR / "summary.md").write_text(
        f"# Rank Lab\n\n"
        f"- Query: {query}\n"
        f"- Generated: {report['generated_at']}\n"
        f"- Collected: {collected_count}/{len(controls)}\n",
        encoding="utf-8"
    )

    print("report created:", DIST_DIR / "report.json")

if __name__ == "__main__":
    main()
