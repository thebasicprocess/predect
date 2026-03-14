# PREDECT — Design Document
**Date:** 2026-03-14
**Status:** Approved

---

## What We're Building

PREDECT is a full-stack Swarm Intelligence Prediction Platform. Users provide a topic or question; PREDECT autonomously collects evidence, runs a swarm of AI agents through a simulation, and synthesizes a structured prediction with confidence scoring, scenario trees, and knowledge graph enrichment.

Tagline: *"Feed it reality. It returns the future."*

---

## Confirmed Decisions

| Decision | Choice |
|---|---|
| Build scope | Full production-grade — all pages, all features |
| LLM provider | Z.AI GLM models only (OpenAI-compatible API) |
| Graph DB | SQLite-backed (no Docker, no Neo4j) |
| Evidence sources | Keyless-first (ArXiv, HN, Reddit, URL scraping); premium sources activate via Settings |
| Simulation engine | Self-contained Python swarm (no MiroFish dependency) |

---

## Architecture

### Monorepo Structure

```
predect/
├── frontend/                    # Next.js 14 App Router + TypeScript
│   ├── app/
│   │   ├── page.tsx             # Landing
│   │   ├── predict/page.tsx     # Main workspace
│   │   ├── graph/page.tsx       # Graph explorer
│   │   ├── evidence/page.tsx    # Evidence manager
│   │   ├── history/page.tsx     # Prediction history
│   │   └── settings/page.tsx    # Config / API keys
│   ├── components/
│   │   ├── ui/                  # Design system components
│   │   ├── graph/               # Graph visualization (Sigma.js / D3-force)
│   │   ├── charts/              # Prediction charts (Recharts / D3)
│   │   ├── evidence/            # Evidence cards and collectors
│   │   ├── swarm/               # Agent visualization and feed
│   │   └── orchestrator/        # Model activity panel
│   └── lib/
│       ├── api.ts               # All fetch calls to FastAPI
│       ├── orchestrator.ts      # Model routing types + display logic
│       └── stores/              # Zustand stores
├── backend/
│   ├── main.py
│   ├── routers/
│   │   ├── predict.py
│   │   ├── evidence.py
│   │   ├── graph.py
│   │   └── orchestrator.py
│   ├── services/
│   │   ├── llm_router.py        # Task → model routing
│   │   ├── evidence_collector.py
│   │   ├── graph_service.py     # SQLite graph abstraction
│   │   ├── simulation.py        # Self-contained swarm engine
│   │   └── report_generator.py
│   ├── models/
│   │   ├── prediction.py        # Pydantic models
│   │   ├── evidence.py
│   │   └── graph.py
│   └── db/
│       └── schema.sql           # SQLite schema
├── .env
├── .env.example
└── docker-compose.yml           # Backend + frontend dev (no Neo4j)
```

---

## Data Layer

### SQLite Schema (single `predect.db` file)

```sql
-- Graph
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,         -- Person, Organization, Event, Location, Concept, Prediction
    name TEXT NOT NULL,
    properties TEXT,            -- JSON blob
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES nodes(id),
    target_id TEXT NOT NULL REFERENCES nodes(id),
    relationship TEXT NOT NULL, -- AFFILIATED_WITH, CAUSES, MENTIONS, SUPPORTS, etc.
    weight REAL DEFAULT 1.0,
    properties TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Predictions
CREATE TABLE predictions (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    domain TEXT,
    time_horizon TEXT,
    status TEXT DEFAULT 'pending',  -- pending, running, complete, failed
    confidence REAL,
    result TEXT,                -- JSON blob (full report)
    created_at TEXT DEFAULT (datetime('now'))
);

-- Evidence
CREATE TABLE evidence_bundles (
    id TEXT PRIMARY KEY,
    prediction_id TEXT REFERENCES predictions(id),
    query TEXT NOT NULL,
    items TEXT NOT NULL,        -- JSON array of EvidenceItem
    created_at TEXT DEFAULT (datetime('now'))
);

-- Simulation state
CREATE TABLE simulations (
    id TEXT PRIMARY KEY,
    prediction_id TEXT REFERENCES predictions(id),
    agents TEXT NOT NULL,       -- JSON array of AgentPersona
    rounds TEXT,                -- JSON array of RoundEvent
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## LLM Orchestration Engine

All models hit `https://api.z.ai/api/paas/v4/` via OpenAI-compatible client.

### Routing Table

| Task Type | Model | Rationale |
|---|---|---|
| `persona_generation` | `glm-4.5-air` | Fast, many calls (one per agent) |
| `simulation_round` | `glm-4.5-air` | High-volume interaction ticks |
| `quick_query` | `glm-4.5-air` | Interactive chat, latency-sensitive |
| `entity_extraction` | `glm-4.5` | Balanced quality |
| `graph_construction` | `glm-4.5` | Structured JSON output |
| `evidence_summarization` | `glm-4.5` | Document comprehension |
| `prediction_synthesis` | `glm-4.7` | Reasoning, long-form output |
| `financial_analysis` | `glm-4.7` | Reasoning required |
| `confidence_scoring` | `glm-4.7` | Nuanced multi-factor scoring |
| `public_opinion_analysis` | `glm-5` | Best quality sentiment |
| `creative_prediction` | `glm-5` | Narrative generation |

### UI Representation

Every model invocation emits a `ModelActivityEvent` that the frontend displays in the right-panel "Model Activity" section:
- Model name + provider badge
- Task type label
- Cost tier dot (🟢 fast / 🟡 balanced / 🔴 premium)
- Live pulsing animation while active
- Token count on completion

---

## Self-Contained Swarm Simulation

```
Input: topic, evidence bundle, agent_count, rounds

Step 1 — Persona Generation (glm-4.5-air)
  Generate N agent personas: each has name, role, beliefs[], memory[], behavioral_bias
  Personas are seeded from entities extracted from evidence bundle

Step 2 — Simulation Rounds (glm-4.5-air)
  For each round (1..M):
    - Randomly pair agents
    - Generate interaction: each pair exchanges "views" on the prediction topic
    - Update beliefs and memory of both agents
    - Extract emergent claims from interaction
    - Stream RoundEvent to frontend via SSE

Step 3 — Convergence Analysis (glm-4.7)
  Analyze final agent belief distributions
  Identify dominant narrative clusters (K-means on belief vectors)
  Detect outlier scenarios and black swan signals

Step 4 — Synthesis (glm-4.7 or glm-5)
  Combine: original evidence + simulation outcomes + cluster analysis
  Generate structured PredictionReport
```

### PredictionReport Structure

```typescript
interface PredictionReport {
  headline: string
  verdict: string
  confidence: { score: number; band: [number, number]; color: string }
  scenarios: {
    base: { description: string; probability: number }
    bull: { description: string; probability: number }
    bear: { description: string; probability: number }
  }
  keyDrivers: string[]
  riskFactors: string[]
  timelineOutlook: { period: string; outlook: string }[]
  agentConsensus: number       // 0–1: how much did agents agree?
  dominantNarratives: string[]
}
```

---

## Evidence Collection Engine

### Keyless Sources (available day one)

| Source | API | Coverage |
|---|---|---|
| ArXiv | `export.arxiv.org/api/query` | Academic papers |
| Hacker News | Firebase API | Tech discourse |
| Reddit | `reddit.com/r/{topic}.json` | Public opinion |
| URL scraping | httpx + BeautifulSoup | Any article |

### Premium Sources (activate via Settings key entry)

| Source | Key Variable |
|---|---|
| NewsAPI | `NEWS_API_KEY` |
| GNews | `GNEWS_API_KEY` |
| Alpha Vantage | `ALPHA_VANTAGE_KEY` |

### Evidence Pipeline

```
1. Search all active sources in parallel (asyncio.gather)
2. Fetch full text for top N results
3. GLM-4.5: summarize + extract entities + score sentiment
4. Score relevance (semantic similarity to query)
5. Deduplicate by URL/title similarity
6. Return top 20 items sorted by relevance × credibility
```

---

## Frontend Pages

### `/` Landing
Hero + feature strip + how-it-works + example predictions + model orchestration explainer. Animated WebGL-style gradient background.

### `/predict` Workspace (core app)
3-column layout `260px | 1fr | 340px`:
- **Left:** Config panel (topic, time horizon, domain, simulation settings, behavior toggles)
- **Center:** Query input → evidence zone → pipeline progress → results (confidence gauge, tabs for Report/Charts/Scenarios/Agents/Graph)
- **Right:** Model activity panel, agent feed, simulation timeline, evidence signal bar

### `/graph` Graph Explorer
Full-canvas D3 force-directed graph + 320px sidebar. Node type legend, search, selected node detail, timeline scrubber.

### `/evidence` Evidence Manager
Evidence bundle browser. Source-type tabs, evidence cards with sentiment/relevance/entities. Manual add via URL/PDF/text.

### `/history` Prediction History
Calendar heatmap + prediction list. Click date to view that day's predictions.

### `/settings` Settings
API keys section, model overrides per task type, simulation defaults.

---

## Design System

Dark mode only. Colors, spacing, typography, and animation from the spec:
- **Base bg:** `#0a0a0f`
- **Accent:** `#635BFF` (Stripe purple)
- **Glass cards:** `backdrop-filter: blur(16px)` + `rgba(255,255,255,0.04)` bg
- **Springs:** Framer Motion `{ type: 'spring', stiffness: 300, damping: 30 }`
- **Font:** Inter + JetBrains Mono

---

## API Surface (FastAPI)

```
POST   /api/predict/run
GET    /api/predict/{id}/stream    # SSE
GET    /api/predict/{id}/result
GET    /api/predict/history

POST   /api/evidence/collect
POST   /api/evidence/fetch-url
GET    /api/evidence/bundle/{id}

GET    /api/graph/nodes
GET    /api/graph/edges
GET    /api/graph/node/{id}
GET    /api/graph/stats
GET    /api/graph/timeline

POST   /api/orchestrator/plan
GET    /api/orchestrator/status
GET    /api/orchestrator/usage

GET    /api/health
```

---

## Environment Variables

```env
ZAI_API_KEY=<provided>
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/

NEWS_API_KEY=
GNEWS_API_KEY=
ALPHA_VANTAGE_KEY=

NEXT_PUBLIC_API_URL=http://localhost:8000
DATABASE_URL=./predect.db
```
