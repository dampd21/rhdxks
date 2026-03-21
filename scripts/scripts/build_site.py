import json
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
      --muted:#8fa1c7;
      --text:#eef3ff;
      --line:#24304f;
      --accent:#61a5ff;
      --accent2:#40d3a5;
      --warn:#ffb454;
      --bad:#ff6b6b;
      --good:#4ade80;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Inter, Pretendard, Apple SD Gothic Neo, Malgun Gothic, sans-serif;
      background:linear-gradient(180deg,#0b1020 0%,#0d1326 100%);
      color:var(--text);
    }
    .wrap{
      max-width:1400px;
      margin:0 auto;
      padding:32px 20px 60px;
    }
    h1{margin:0 0 8px;font-size:32px}
    p.sub{margin:0 0 24px;color:var(--muted)}
    .grid{
      display:grid;
      grid-template-columns:repeat(5,minmax(0,1fr));
      gap:14px;
      margin-bottom:18px;
    }
    .card{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:16px;
      padding:16px;
      box-shadow:0 10px 30px rgba(0,0,0,.2);
    }
    .card .label{
      color:var(--muted);
      font-size:12px;
      margin-bottom:8px;
      text-transform:uppercase;
      letter-spacing:.04em;
    }
    .card .value{
      font-size:24px;
      font-weight:700;
    }
    .panel{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:18px;
      padding:18px;
      margin-top:18px;
      overflow:hidden;
    }
    .panel h2{margin:0 0 14px;font-size:20px}
    table{
      width:100%;
      border-collapse:collapse;
      font-size:14px;
    }
    th,td{
      padding:10px 8px;
      border-bottom:1px solid var(--line);
      text-align:left;
      vertical-align:top;
    }
    th{
      color:#bcd0ff;
      font-weight:600;
      position:sticky;
      top:0;
      background:rgba(19,26,46,.98);
    }
    .badge{
      display:inline-block;
      padding:4px 8px;
      border-radius:999px;
      border:1px solid var(--line);
      background:#18213d;
      color:#dce7ff;
      font-size:12px;
      margin-right:6px;
      margin-bottom:6px;
    }
    .bar{
      width:100%;
      height:10px;
      border-radius:999px;
      background:#10172d;
      border:1px solid var(--line);
      overflow:hidden;
    }
    .bar > span{
      display:block;
      height:100%;
      background:linear-gradient(90deg,var(--accent),var(--accent2));
    }
    .row{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:18px;
    }
    .ok{color:var(--good)}
    .warn{color:var(--warn)}
    .bad{color:var(--bad)}
    .muted{color:var(--muted)}
    .pill{
      display:inline-block;
      padding:4px 8px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
      color:#07101f;
      background:#dbeafe;
    }
    .status-ok{background:#86efac}
    .status-incomplete{background:#fcd34d}
    .small{font-size:12px;color:var(--muted)}
    .scroll{overflow:auto}
    @media (max-width: 1100px){
      .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .row{grid-template-columns:1fr}
    }
    @media (max-width: 640px){
      .grid{grid-template-columns:1fr}
      h1{font-size:26px}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 id="title">Naver Place Rank Lab</h1>
    <p class="sub" id="subtitle">loading...</p>

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

  document.getElementById('title').textContent = `${report.query} 대조군 분석 대시보드`;
  document.getElementById('subtitle').innerHTML =
    `생성시각: <span class="muted">${report.generated_at}</span> · 상태: ` +
    `<span class="pill ${report.status === 'ok' ? 'status-ok' : 'status-incomplete'}">${report.status}</span>`;

  renderCards(report);
  renderWeights(report.weights || []);
  renderMissing(report.missing || []);
  renderRows(report.rows || []);
}

function num(v, d=2){
  if(v === null || v === undefined || Number.isNaN(v)) return '-';
  return Number(v).toFixed(d);
}

function renderCards(report){
  const metrics = report.metrics || {};
  const cards = [
    ['Query', report.query],
    ['Collected / Expected', `${report.collected_count} / ${report.expected_count}`],
    ['Missing', report.missing_count],
    ['Pairwise Accuracy', metrics.pairwise_accuracy ?? '-'],
    ['Spearman Rho', metrics.spearman_rho ?? '-'],
  ];

  const el = document.getElementById('cards');
  el.innerHTML = cards.map(([label, value]) => `
    <div class="card">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join('');
}

function renderWeights(weights){
  const el = document.getElementById('weights');
  if(!weights.length){
    el.innerHTML = '<div class="muted">가중치 정보가 없습니다.</div>';
    return;
  }
  el.innerHTML = weights.map(w => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <strong>${w.group}</strong>
        <span>${num(w.percent,2)}%</span>
      </div>
      <div class="bar"><span style="width:${w.percent}%"></span></div>
    </div>
  `).join('');
}

function renderMissing(items){
  const el = document.getElementById('missing');
  if(!items.length){
    el.innerHTML = '<div class="ok">모든 대조군 데이터가 존재합니다.</div>';
    return;
  }
  el.innerHTML = `
    <div class="warn" style="margin-bottom:10px">${items.length}개 누락</div>
    ${items.map(x => `<span class="badge">#${x.rank} · ${x.place_id}</span>`).join('')}
  `;
}

function gapClass(v){
  if(v === 0) return 'ok';
  if(Math.abs(v) <= 2) return 'warn';
  return 'bad';
}

function renderRows(rows){
  const el = document.getElementById('rows');
  if(!rows.length){
    el.innerHTML = '<tr><td colspan="11" class="muted">분석 가능한 데이터가 없습니다.</td></tr>';
    return;
  }

  el.innerHTML = rows.map(r => `
    <tr>
      <td>${r.actual_rank}</td>
      <td>${r.pred_rank ?? '-'}</td>
      <td class="${gapClass(r.rank_gap ?? 0)}">${r.rank_gap ?? '-'}</td>
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
      <td style="min-width:360px">${r.why_top || '-'}</td>
    </tr>
  `).join('');
}

main().catch(err => {
  document.getElementById('subtitle').textContent = 'report.json 로드 실패';
  console.error(err);
});
</script>
</body>
</html>
"""


def main():
    report_path = DIST_DIR / "report.json"
    if not report_path.exists():
        raise FileNotFoundError("dist/report.json 이 없습니다. 먼저 analyze.py를 실행하세요.")

    shutil.copyfile(report_path, DOCS_DIR / "report.json")

    features_path = DIST_DIR / "features.csv"
    if features_path.exists():
        shutil.copyfile(features_path, DOCS_DIR / "features.csv")

    (DOCS_DIR / "index.html").write_text(HTML, encoding="utf-8")
    (DOCS_DIR / ".nojekyll").write_text("", encoding="utf-8")

    print(f"[DONE] docs/index.html 생성 완료")
    print(f"[DONE] docs/report.json 복사 완료")


if __name__ == "__main__":
    main()
