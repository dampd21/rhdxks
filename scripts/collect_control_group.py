import json
import time
import base64
from pathlib import Path
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "control_group.json"
OUT_DIR = ROOT / "data" / "batch"
META_DIR = ROOT / "data" / "meta"

OUT_DIR.mkdir(parents=True, exist_ok=True)
META_DIR.mkdir(parents=True, exist_ok=True)


def load_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def build_driver():
    options = Options()

    # headless는 권장하지 않음. 일반 브라우저 세션 기반 수집 권장
    options.add_argument("--window-size=1400,2200")
    options.add_argument("--lang=ko-KR")

    # 전용 크롬 프로필 경로를 쓰고 싶으면 환경변수 지정
    # 예: CHROME_PROFILE_DIR=C:\\naverlab\\chrome-profile
    # 처음 한 번 이 프로필로 Chrome 열어서 필요한 세션을 준비해둘 수 있음
    import os
    profile_dir = os.environ.get("CHROME_PROFILE_DIR", "").strip()
    if profile_dir:
        options.add_argument(f"--user-data-dir={profile_dir}")

    # 성능 로그 활성화
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    driver = webdriver.Chrome(options=options)
    driver.execute_cdp_cmd("Network.enable", {})
    return driver


def wait_ready(driver, timeout=20):
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )


def parse_perf(entry):
    try:
        return json.loads(entry["message"])["message"]
    except Exception:
        return {}


def decode_body(body_obj):
    body = body_obj.get("body", "")
    if body_obj.get("base64Encoded"):
        try:
            return base64.b64decode(body).decode("utf-8", errors="replace")
        except Exception:
            return body
    return body


def collect_graphql_batches(driver):
    logs = driver.get_log("performance")
    seen = set()
    batches = []

    for entry in logs:
        msg = parse_perf(entry)
        if msg.get("method") != "Network.responseReceived":
            continue

        params = msg.get("params", {})
        request_id = params.get("requestId")
        response = params.get("response", {}) or {}
        url = response.get("url", "")

        if "api.place.naver.com/graphql" not in url:
            continue

        if not request_id or request_id in seen:
            continue

        seen.add(request_id)

        parsed = None
        raw_text = None
        error = None

        try:
            body_obj = driver.execute_cdp_cmd(
                "Network.getResponseBody",
                {"requestId": request_id}
            )
            raw_text = decode_body(body_obj)
            try:
                parsed = json.loads(raw_text)
            except Exception:
                parsed = None
        except Exception as e:
            error = str(e)

        batches.append({
            "request_id": request_id,
            "url": url,
            "status": response.get("status"),
            "mimeType": response.get("mimeType"),
            "parsed_json": parsed,
            "raw_text": raw_text if parsed is None else None,
            "error": error,
        })

    return batches


def batch_score(item):
    parsed = item.get("parsed_json")
    if not isinstance(parsed, list):
        return -1

    score = len(parsed)
    text = json.dumps(parsed, ensure_ascii=False)

    hints = [
        "visitorReviewStats",
        "visitorReviews",
        "unifiedCoupons",
        "aiBriefing",
    ]
    for h in hints:
        if h in text:
            score += 5

    return score


def choose_best_batch(batches):
    ranked = []
    for b in batches:
        score = batch_score(b)
        if score >= 0:
            ranked.append((score, b))

    if not ranked:
        return None

    ranked.sort(key=lambda x: x[0], reverse=True)
    return ranked[0][1]


def capture_one(driver, rank, place_id):
    url = f"https://m.place.naver.com/restaurant/{place_id}/home"

    # 이전 로그 비우기
    try:
        driver.get_log("performance")
    except Exception:
        pass

    driver.get(url)
    wait_ready(driver, timeout=20)
    time.sleep(5)

    # 추가 네트워크 유도
    driver.execute_script("window.scrollTo(0, 900)")
    time.sleep(2)

    batches = collect_graphql_batches(driver)
    best = choose_best_batch(batches)

    meta = {
        "rank": rank,
        "place_id": place_id,
        "url": url,
        "captured_at": datetime.now().isoformat(),
        "batch_count": len(batches),
        "best_found": best is not None,
    }

    meta_path = META_DIR / f"{rank:02d}_{place_id}_meta.json"
    meta_path.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    if best and isinstance(best.get("parsed_json"), list):
        out_path = OUT_DIR / f"{rank:02d}_{place_id}.json"
        out_path.write_text(
            json.dumps(best["parsed_json"], ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"[OK] {rank:02d} {place_id} -> {out_path.name}")
        return True

    fail_path = META_DIR / f"{rank:02d}_{place_id}_debug.json"
    fail_path.write_text(
        json.dumps({"rank": rank, "place_id": place_id, "batches": batches}, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"[WARN] {rank:02d} {place_id} -> batch not found")
    return False


def main():
    cfg = load_config()
    controls = cfg.get("controls", [])

    driver = build_driver()

    ok = 0
    try:
        for item in controls:
            rank = int(item["rank"])
            place_id = str(item["place_id"])
            try:
                success = capture_one(driver, rank, place_id)
                if success:
                    ok += 1
            except Exception as e:
                print(f"[ERROR] rank={rank:02d}, place_id={place_id}, error={e}")
    finally:
        driver.quit()

    print(f"[DONE] collected={ok}/{len(controls)}")


if __name__ == "__main__":
    main()
