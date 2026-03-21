import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "dist"
DOCS_DIR = ROOT / "docs"

DOCS_DIR.mkdir(parents=True, exist_ok=True)

HTML = """<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Naver Place Rank Lab</title>
  <style>
    :root{
      --bg:#0b1020;
      --card:#131a2e;
      --muted:#90a0c0;
      --text:#eef3ff;
      --line:#273252;
      --good:#4ade80;
      --warn:#fbbf24;
      --bad:#fb7185;
      --blue:#60a5fa;
      --cyan:#22d3ee;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Arial, sans-serif;
      background:var(--bg);
      color:var(--text);
    }
    .wrap{
      max-width:1400px;
      margin:0 auto;
      padding:24px;
    }
    h1{margin:0 0 8px}
    .sub{color:var(--muted); margin-bottom:20px}
    .grid{
      display:grid;
      grid-template-columns:repeat(5, minmax(0,1fr));
      gap:12px;
      margin-bottom:18px;
    }
    .card,.panel{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:14px;
      padding:16px;
    }
    .label{
      font-size:12px;
      color:var(--muted);
      margin-bottom:6px;
      text-transform:uppercase;
    }
    .value{
      font-size:24px;
      font-weight:700;
    }
    .row{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:18px;
      margin-bottom:18px;
    }
    .bar{
      width:100%;
      height:10px;
      background:#0f172a;
      border:1px solid var(--line);
      border-radius:999px;
      overflow:hidden;
      margin-top:6px;
    }
    .bar > span{
      display:block;
      height:100%;
      background:linear-gradient(90deg,var(--blue),var(--cyan));
    }
    table{
      width:100%;
      border-collapse:collapse;
      font-size:14px;
    }
    th,td{
      border-bottom:1px solid var(--line);
      padding:10px 8px;
      text-align:left;
      vertical-align:top;
    }
    th{
      color:#c8d4f2;
      position:sticky;
      top:0;
      background:var(--card);
    }
    .scroll{overflow:auto}
    .ok{color:var(--good)}
    .warn{color:var(--warn)}
    .bad{color:var(--bad)}
    .badge{
      display:inline-block;
      font-size:12px;
      padding:5px 9px;
      border-radius:999px;
      background:#1d2742;
      border:1px solid var(--line);
      color:#dbeafe;
      margin:4px 6px 0 0;
    }
    .small{font-size:12px;color:var(--muted)}
    @media (max-width: 1100px){
      .grid{grid-template-columns:repeat(2, minmax(0,1fr))}
      .row{grid-template-columns:1fr}
    }
    @media (max-width: 700px){
      .grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 id="title">Naver Place Rank Lab</h1>
    <div class="sub" id="subtitle">loading...</div>

    <div class="grid" id="cards"></div>

    <div class="row">
      <div class="panel">
        <h2>가중치</h2>
        <div id="weights"></div>
      </div>
      <div class="panel">
        <h2>누락 데이터</h2>
        <div id="missing"></div>
      </div>
    </div>

    <div class="panel">
      <h2>순위 비교</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>실제</th>
              <th>예측</th>
              <th>차이</th>
              <th>플레이스</th>
              <th>최종점수</th>
              <th>키워드 적합도</th>
              <th>리뷰수</th>
              <th>평점</th>
              <th>쿠폰</th>
              <th>톡톡</th>
              <th>주요 사유</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </div>
  </div>

<script>
async function main(){
  const report = await fetch('./report.json').then(r => r.json());

  document.getElementById('title').textContent = report.query + ' 대조군 분석';
  document.getElementById('subtitle').textContent =
    `생성시각: ${report.generated_at} / 상태: ${report.status}`;

  renderCards(report);
  renderWeights(report.weights || []);
  renderMissing(report.missing || []);
  renderRows(report.rows || []);
}

function num(v, d=2){
  if(v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if(Number.isNaN(n)) return "-";
  return n.toFixed(d);
}

function renderCards(report){
  const m = report.metrics || {};
  const cards = [
    ["Collected / Expected", `${report.collected_count} / ${report.expected_count}`],
    ["Missing", report.missing_count],
    ["Pairwise Accuracy", m.pairwise_accuracy ?? "-"],
    ["Spearman Rho", m.spearman_rho ?? "-"],
    ["Top1 Correct", m.top1_correct ?? "-"]
  ];

  document.getElementById("cards").innerHTML = cards.map(([k,v]) => `
    <div class="card">
      <div class="label">${k}</div>
      <div class="value">${v}</div>
    </div>
  `).join("");
}

function renderWeights(weights){
  const el = document.getElementById("weights");
  if(!weights.length){
    el.innerHTML = `<div class="small">가중치 데이터 없음</div>`;
    return;
  }

  el.innerHTML = weights.map(w => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between">
        <strong>${w.group}</strong>
        <span>${num(w.percent,2)}%</span>
      </div>
      <div class="bar"><span style="width:${w.percent}%"></span></div>
    </div>
  `).join("");
}

function renderMissing(items){
  const el = document.getElementById("missing");
  if(!items.length){
    el.innerHTML = `<div class="ok">누락 없음</div>`;
    return;
  }
  el.innerHTML = `
    <div class="warn">${items.length}개 누락</div>
    <div style="margin-top:10px">
      ${items.map(x => `<span class="badge">#${x.rank} ${x.place_id}</span>`).join("")}
    </div>
  `;
}

function gapClass(v){
  if(v === 0) return "ok";
  if(Math.abs(v) <= 2) return "warn";
  return "bad";
}

function renderRows(rows){
  const el = document.getElementById("rows");
  if(!rows.length){
    el.innerHTML = `<tr><td colspan="11">데이터 없음</td></tr>`;
    return;
  }

  el.innerHTML = rows.map(r => `
    <tr>
      <td>${r.actual_rank ?? "-"}</td>
      <td>${r.pred_rank ?? "-"}</td>
      <td class="${gapClass(r.rank_gap ?? 0)}">${r.rank_gap ?? "-"}</td>
      <td>
        <div><strong>${r.place_name || r.place_id}</strong></div>
        <div class="small">${r.place_id}</div>
      </td>
      <td>${num(r.final_score,2)}</td>
      <td>${num(r.query_fit,1)}</td>
      <td>${num(r.review_total,0)}</td>
      <td>${num(r.avg_rating,2)}</td>
      <td>${num(r.coupon_count,0)}</td>
      <td>${num(r.talk_enabled,0)}</td>
      <td style="min-width:320px">${r.why_top || "-"}</td>
    </tr>
  `).join("");
}

main();
</script>
</body>
</html>
"""

def main():
    report_path = DIST_DIR / "report.json"
    if not report_path.exists():
        raise FileNotFoundError("dist/report.json not found")

    shutil.copyfile(report_path, DOCS_DIR / "report.json")

    features_path = DIST_DIR / "features.csv"
    if features_path.exists():
        shutil.copyfile(features_path, DOCS_DIR / "features.csv")

    (DOCS_DIR / "index.html").write_text(HTML, encoding="utf-8")
    (DOCS_DIR / ".nojekyll").write_text("", encoding="utf-8")

    print("site created:", DOCS_DIR / "index.html")

if __name__ == "__main__":
    main()
