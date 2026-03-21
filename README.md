# Naver Place Rank Lab

네이버 플레이스 대조군 JSON 응답을 기반으로
순위 요인을 분석하고 GitHub Pages로 대시보드를 배포하는 프로젝트입니다.

## 구조

- `config/control_group.json` : 대조군 랭크/플레이스 ID
- `data/batch/*.json` : 저장한 GraphQL batch 응답
- `scripts/analyze.py` : feature 추출 + 가중치 튜닝 + report 생성
- `scripts/build_site.py` : Pages용 정적 사이트 생성
- `.github/workflows/analyze-and-deploy.yml` : GitHub Actions 배포

## 배치 파일 규칙

예시:

- `data/batch/01_2074838465.json`
- `data/batch/02_1850483662.json`

## 로컬 실행

```bash
pip install -r requirements.txt
python scripts/analyze.py
python scripts/build_site.py
python -m http.server 8000 -d docs
