# PREDECT — Swarm Intelligence Prediction Platform

> Feed it reality. It returns the future.

PREDECT collects evidence from across the web, runs a swarm of AI agents through a structured simulation, and synthesizes structured predictions with confidence scores, scenario trees, and a live knowledge graph.

## Tech Stack

- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS + Framer Motion
- **Backend**: FastAPI + Python + SQLite
- **LLMs**: Z.AI GLM models (glm-4.5-air / glm-4.5 / glm-4.7 / glm-5)
- **Evidence**: ArXiv, Hacker News, Reddit (keyless) + NewsAPI/GNews/Alpha Vantage (optional)

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env
# Add your ZAI_API_KEY to .env
uvicorn backend.main:app --reload --port 8000
```

Backend runs at http://localhost:8000 — API docs at http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
# Set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env
npm run dev
```

Frontend runs at http://localhost:3000

## Deployment

### Frontend → Vercel
1. Push to GitHub
2. Import repo in Vercel dashboard
3. Vercel auto-detects Next.js from `vercel.json`
4. Set env var: `NEXT_PUBLIC_API_URL=https://your-railway-backend.railway.app`

### Backend → Railway
1. Push to GitHub
2. New project in Railway → Deploy from GitHub
3. Railway uses `railway.toml` and `Dockerfile` automatically
4. Set env vars: `ZAI_API_KEY`, `CORS_ORIGINS=https://your-vercel-url.vercel.app`
5. Add a Volume at `/app/data` for SQLite persistence

## Environment Variables

See `.env.example` for all available configuration options.

| Variable | Required | Description |
|---|---|---|
| `ZAI_API_KEY` | Yes | Z.AI API key for GLM models |
| `ZAI_BASE_URL` | Yes | Z.AI API base URL |
| `NEWS_API_KEY` | No | NewsAPI key (premium evidence) |
| `GNEWS_API_KEY` | No | GNews key (premium evidence) |
| `ALPHA_VANTAGE_KEY` | No | Alpha Vantage key (financial data) |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL (frontend uses this) |
| `DATABASE_URL` | No | SQLite path (default: `./predect.db`) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |

## API Reference

| Endpoint | Description |
|---|---|
| `POST /api/predict/run` | Start a new prediction |
| `GET /api/predict/{id}/stream` | SSE stream of pipeline events |
| `GET /api/predict/{id}/result` | Get completed prediction result |
| `GET /api/predict/history` | List recent predictions |
| `POST /api/evidence/collect` | Collect evidence for a query |
| `GET /api/graph/nodes` | Get graph nodes |
| `GET /api/graph/edges` | Get graph edges |
| `GET /api/graph/stats` | Graph statistics |
| `GET /api/health` | Health check |

## Pages

| Page | Description |
|---|---|
| `/` | Landing page |
| `/predict` | Main prediction workspace |
| `/graph` | Knowledge graph explorer |
| `/evidence` | Evidence browser |
| `/history` | Prediction history |
| `/settings` | Configuration |
