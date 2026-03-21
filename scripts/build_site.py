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
    body { font-family: Arial, sans-serif; background:#0f172a; color:#e2e8f0; margin:0; padding:24px; }
    .wrap { max-width:1200px; margin:0 auto; }
    .card { background:#111827; border:1px solid #334155; border-radius:12px; padding:16px; margin-bottom:16px; }
    table { width:100%; border-collapse:collapse; background:#111827; }
    th, td { border:1px solid #334155; padding:10px; text-align:left; }
    th { background:#1e293b; }
    .muted { color:#94a3b8; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 id="title">Naver Place Rank Lab</h1>
    <div class="card" id="summary">loading...</div>
    <div class="card">
      <h2>대조군 목록</h2>
      <table>
        <thead>
          <tr>
            <th>실제��위</th>
            <th>place_id</th>
            <th>데이터 여부</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </div>

<script>
async function main() {
  const report = await fetch('./report.json').then(r => r.json());

  document.getElementById('title').textContent = report.query + ' 대조군 분석';
  document.getElementById('summary').innerHTML = `
    <div><strong>생성시각:</strong> ${report.generated_at}</div>
    <div><strong>상태:</strong> ${report.status}</div>
    <div><strong>수집개수:</strong> ${report.collected_count} / ${report.expected_count}</div>
  `;

  const rows = report.rows || [];
  document.getElementById('rows').innerHTML = rows.map(r => `
    <tr>
      <td>${r.actual_rank}</td>
      <td>${r.place_id}</td>
      <td>${r.has_data ? '있음' : '없음'}</td>
      <td>${r.why_top || ''}</td>
    </tr>
  `).join('');
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
    (DOCS_DIR / "index.html").write_text(HTML, encoding="utf-8")
    (DOCS_DIR / ".nojekyll").write_text("", encoding="utf-8")

    print("site created:", DOCS_DIR / "index.html")

if __name__ == "__main__":
    main()
