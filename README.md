# PREDECT

> Swarm Intelligence Prediction Platform — *Feed it reality. It returns the future.*

## What It Does

PREDECT takes a question, autonomously collects evidence from ArXiv, Hacker News, and Reddit, runs a swarm of AI agents through a structured simulation, and synthesizes a structured prediction with confidence scores, scenario trees, and a knowledge graph.

## Stack

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind CSS + Framer Motion
- **Backend:** FastAPI + Python + SQLite
- **AI:** Z.AI GLM models (glm-4-flash, glm-4-air, glm-4, glm-4-plus)
- **Evidence:** ArXiv, Hacker News, Reddit (keyless)

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
# Windows:
source venv/Scripts/activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example ../.env
# Edit .env and add your ZAI_API_KEY

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at http://localhost:8000
API docs at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `ZAI_API_KEY` | Yes | Z.AI API key for GLM models |
| `ZAI_BASE_URL` | Yes | Z.AI API base URL |
| `NEWS_API_KEY` | No | NewsAPI key (premium evidence) |
| `GNEWS_API_KEY` | No | GNews key (premium evidence) |
| `ALPHA_VANTAGE_KEY` | No | Alpha Vantage key (financial data) |

## API Endpoints

```
POST   /api/predict/run          Start a prediction
GET    /api/predict/{id}/stream  SSE stream (real-time pipeline events)
GET    /api/predict/{id}/result  Get completed prediction
GET    /api/predict/history      List all predictions

POST   /api/evidence/collect     Collect evidence for a query
GET    /api/graph/nodes          Get all graph nodes
GET    /api/graph/edges          Get all graph edges
GET    /api/graph/stats          Graph statistics

GET    /api/health               Health check
```

## Pages

| Page | Description |
|---|---|
| `/` | Landing page |
| `/predict` | Main prediction workspace |
| `/graph` | Knowledge graph explorer |
| `/evidence` | Evidence browser |
| `/history` | Prediction history |
| `/settings` | Configuration |
