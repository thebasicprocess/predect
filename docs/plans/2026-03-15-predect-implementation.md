# PREDECT Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build PREDECT — a full-stack Swarm Intelligence Prediction Platform with Next.js 14 frontend and FastAPI backend, then push to GitHub and deploy frontend to Vercel.

**Architecture:** Next.js 14 App Router frontend in `frontend/`, FastAPI + SQLite backend in `backend/`. SSE streaming for real-time pipeline progress. Zustand + TanStack Query for state. Z.AI GLM models via OpenAI-compatible API.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Recharts, D3, Sigma.js, Zustand, TanStack Query v5, FastAPI, SQLite, httpx, BeautifulSoup4, sse-starlette, openai SDK

---

## Task 1: Project Scaffold

**Files:**
- Create: `frontend/` (Next.js 14 app)
- Create: `backend/` (FastAPI app)
- Create: `.env`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `vercel.json`

**Step 1: Scaffold Next.js 14 app**

```bash
cd /c/Users/saymyname/Projects/Strat
npx create-next-app@14 frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

**Step 2: Install frontend dependencies**

```bash
cd /c/Users/saymyname/Projects/Strat/frontend
npm install framer-motion@11 recharts d3 sigma graphology graphology-layout-forceatlas2 @react-sigma/core zustand @tanstack/react-query@5 react-hook-form lucide-react clsx tailwind-merge date-fns
npm install --save-dev @types/d3 @types/react-calendar-heatmap
```

**Step 3: Scaffold FastAPI backend**

```bash
cd /c/Users/saymyname/Projects/Strat
mkdir -p backend/routers backend/services backend/models backend/db
cd backend
python -m venv venv
source venv/Scripts/activate || source venv/bin/activate
pip install fastapi uvicorn[standard] sse-starlette httpx beautifulsoup4 openai pydantic python-dotenv PyPDF2 python-multipart
pip freeze > requirements.txt
```

**Step 4: Create .env**

```bash
cat > /c/Users/saymyname/Projects/Strat/.env << 'EOF'
ZAI_API_KEY=62dacadb3b5d4338afc0a32d4c97c47f.WM0j9oeGsFrMk6ny
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
NEWS_API_KEY=
GNEWS_API_KEY=
ALPHA_VANTAGE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
DATABASE_URL=./predect.db
EOF
```

**Step 5: Create .env.example**

```
ZAI_API_KEY=your_zai_api_key_here
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
NEWS_API_KEY=
GNEWS_API_KEY=
ALPHA_VANTAGE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
DATABASE_URL=./predect.db
```

**Step 6: Create .gitignore**

```
node_modules/
.next/
backend/venv/
backend/__pycache__/
backend/*.pyc
backend/predect.db
.env
*.log
.DS_Store
dist/
```

**Step 7: Create vercel.json** (frontend-only deployment)

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/.next",
  "framework": "nextjs",
  "installCommand": "cd frontend && npm install"
}
```

**Step 8: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add .
git commit -m "feat: scaffold Next.js 14 frontend and FastAPI backend"
```

---

## Task 2: SQLite Schema + Backend Models

**Files:**
- Create: `backend/db/schema.sql`
- Create: `backend/db/database.py`
- Create: `backend/models/prediction.py`
- Create: `backend/models/evidence.py`
- Create: `backend/models/graph.py`
- Create: `backend/models/simulation.py`

**Step 1: Create schema.sql**

```sql
-- backend/db/schema.sql
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES nodes(id),
    target_id TEXT NOT NULL REFERENCES nodes(id),
    relationship TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    properties TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    domain TEXT,
    time_horizon TEXT,
    status TEXT DEFAULT 'pending',
    confidence REAL,
    result TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evidence_bundles (
    id TEXT PRIMARY KEY,
    prediction_id TEXT REFERENCES predictions(id),
    query TEXT NOT NULL,
    items TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS simulations (
    id TEXT PRIMARY KEY,
    prediction_id TEXT REFERENCES predictions(id),
    agents TEXT NOT NULL DEFAULT '[]',
    rounds TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
```

**Step 2: Create database.py**

```python
# backend/db/database.py
import sqlite3
import json
import os
from pathlib import Path

DB_PATH = os.getenv("DATABASE_URL", "./predect.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    with conn:
        conn.executescript(SCHEMA_PATH.read_text())
    conn.close()
```

**Step 3: Create prediction models**

```python
# backend/models/prediction.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ScenarioItem(BaseModel):
    description: str
    probability: float


class Scenarios(BaseModel):
    base: ScenarioItem
    bull: ScenarioItem
    bear: ScenarioItem


class TimelineItem(BaseModel):
    period: str
    outlook: str


class ConfidenceBand(BaseModel):
    score: float
    band: List[float]
    color: str


class PredictionReport(BaseModel):
    headline: str
    verdict: str
    confidence: ConfidenceBand
    scenarios: Scenarios
    keyDrivers: List[str]
    riskFactors: List[str]
    timelineOutlook: List[TimelineItem]
    agentConsensus: float
    dominantNarratives: List[str]


class PredictRequest(BaseModel):
    query: str
    domain: Optional[str] = "general"
    time_horizon: Optional[str] = "6 months"
    agent_count: Optional[int] = 8
    rounds: Optional[int] = 5
    collect_evidence: Optional[bool] = True


class PredictionRecord(BaseModel):
    id: str
    query: str
    domain: Optional[str]
    time_horizon: Optional[str]
    status: str
    confidence: Optional[float]
    result: Optional[PredictionReport]
    created_at: str
```

**Step 4: Create evidence models**

```python
# backend/models/evidence.py
from pydantic import BaseModel
from typing import Optional, List


class EvidenceItem(BaseModel):
    id: str
    title: str
    url: str
    source: str  # arxiv | hn | reddit | web | newsapi | gnews
    snippet: str
    full_text: Optional[str] = None
    relevance_score: float = 0.0
    credibility_score: float = 0.5
    sentiment: Optional[float] = None  # -1 to 1
    entities: List[str] = []
    published_at: Optional[str] = None


class EvidenceBundle(BaseModel):
    id: str
    prediction_id: Optional[str]
    query: str
    items: List[EvidenceItem]
    created_at: str


class CollectRequest(BaseModel):
    query: str
    prediction_id: Optional[str] = None
    max_items: Optional[int] = 20
```

**Step 5: Create graph models**

```python
# backend/models/graph.py
from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class Node(BaseModel):
    id: str
    type: str  # Person | Organization | Event | Location | Concept | Prediction
    name: str
    properties: Dict[str, Any] = {}
    created_at: Optional[str] = None


class Edge(BaseModel):
    id: str
    source_id: str
    target_id: str
    relationship: str
    weight: float = 1.0
    properties: Dict[str, Any] = {}
    created_at: Optional[str] = None


class GraphStats(BaseModel):
    node_count: int
    edge_count: int
    node_types: Dict[str, int]
    relationship_types: Dict[str, int]
```

**Step 6: Create simulation models**

```python
# backend/models/simulation.py
from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class AgentPersona(BaseModel):
    id: str
    name: str
    role: str
    beliefs: List[str]
    memory: List[str] = []
    behavioral_bias: str


class RoundEvent(BaseModel):
    round: int
    agent1_id: str
    agent2_id: str
    agent1_name: str
    agent2_name: str
    interaction_summary: str
    emergent_claims: List[str]
    belief_shifts: Dict[str, Any] = {}


class SimulationState(BaseModel):
    id: str
    prediction_id: Optional[str]
    agents: List[AgentPersona]
    rounds: List[RoundEvent] = []
    status: str = "pending"
    created_at: Optional[str] = None
```

**Step 7: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add backend/
git commit -m "feat: add SQLite schema and Pydantic models"
```

---

## Task 3: LLM Router Service

**Files:**
- Create: `backend/services/llm_router.py`

**Step 1: Create llm_router.py**

```python
# backend/services/llm_router.py
import os
from openai import AsyncOpenAI
from typing import Optional, AsyncIterator
import json

ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")
ZAI_BASE_URL = os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4/")

TASK_MODEL_MAP = {
    "persona_generation": "glm-4-flash",
    "simulation_round": "glm-4-flash",
    "quick_query": "glm-4-flash",
    "entity_extraction": "glm-4-air",
    "graph_construction": "glm-4-air",
    "evidence_summarization": "glm-4-air",
    "prediction_synthesis": "glm-4",
    "financial_analysis": "glm-4",
    "confidence_scoring": "glm-4",
    "public_opinion_analysis": "glm-4-plus",
    "creative_prediction": "glm-4-plus",
}

TASK_TIER = {
    "persona_generation": "fast",
    "simulation_round": "fast",
    "quick_query": "fast",
    "entity_extraction": "balanced",
    "graph_construction": "balanced",
    "evidence_summarization": "balanced",
    "prediction_synthesis": "premium",
    "financial_analysis": "premium",
    "confidence_scoring": "premium",
    "public_opinion_analysis": "premium",
    "creative_prediction": "premium",
}


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=ZAI_API_KEY,
        base_url=ZAI_BASE_URL,
    )


def get_model_for_task(task: str) -> str:
    return TASK_MODEL_MAP.get(task, "glm-4-air")


def get_tier_for_task(task: str) -> str:
    return TASK_TIER.get(task, "balanced")


async def llm_call(
    task: str,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
    client = get_client()
    model = get_model_for_task(task)

    kwargs = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
    }

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


async def llm_call_json(task: str, system_prompt: str, user_prompt: str) -> dict:
    raw = await llm_call(task, system_prompt, user_prompt, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Extract JSON from markdown code blocks if present
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
        if match:
            return json.loads(match.group(1))
        raise ValueError(f"Could not parse JSON from LLM response: {raw[:200]}")
```

**Step 2: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add backend/services/llm_router.py
git commit -m "feat: add LLM router with Z.AI GLM task routing"
```

---

## Task 4: Graph Service

**Files:**
- Create: `backend/services/graph_service.py`

**Step 1: Create graph_service.py**

```python
# backend/services/graph_service.py
import json
import uuid
from typing import List, Optional, Dict
from backend.db.database import get_connection
from backend.models.graph import Node, Edge, GraphStats


def create_node(type: str, name: str, properties: dict = {}) -> Node:
    conn = get_connection()
    node_id = str(uuid.uuid4())
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO nodes (id, type, name, properties) VALUES (?, ?, ?, ?)",
            (node_id, type, name, json.dumps(properties)),
        )
    conn.close()
    return Node(id=node_id, type=type, name=name, properties=properties)


def get_or_create_node(type: str, name: str) -> Node:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM nodes WHERE name = ? AND type = ?", (name, type)
    ).fetchone()
    if row:
        conn.close()
        return Node(
            id=row["id"],
            type=row["type"],
            name=row["name"],
            properties=json.loads(row["properties"] or "{}"),
            created_at=row["created_at"],
        )
    conn.close()
    return create_node(type, name)


def create_edge(source_id: str, target_id: str, relationship: str, weight: float = 1.0) -> Edge:
    conn = get_connection()
    edge_id = str(uuid.uuid4())
    with conn:
        conn.execute(
            "INSERT INTO edges (id, source_id, target_id, relationship, weight) VALUES (?, ?, ?, ?, ?)",
            (edge_id, source_id, target_id, relationship, weight),
        )
    conn.close()
    return Edge(id=edge_id, source_id=source_id, target_id=target_id, relationship=relationship, weight=weight)


def get_all_nodes(limit: int = 500) -> List[Node]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM nodes ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [Node(id=r["id"], type=r["type"], name=r["name"], properties=json.loads(r["properties"] or "{}"), created_at=r["created_at"]) for r in rows]


def get_all_edges(limit: int = 1000) -> List[Edge]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM edges ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [Edge(id=r["id"], source_id=r["source_id"], target_id=r["target_id"], relationship=r["relationship"], weight=r["weight"], properties=json.loads(r["properties"] or "{}"), created_at=r["created_at"]) for r in rows]


def get_graph_stats() -> GraphStats:
    conn = get_connection()
    node_count = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    edge_count = conn.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
    node_types_rows = conn.execute("SELECT type, COUNT(*) as cnt FROM nodes GROUP BY type").fetchall()
    rel_rows = conn.execute("SELECT relationship, COUNT(*) as cnt FROM edges GROUP BY relationship").fetchall()
    conn.close()
    return GraphStats(
        node_count=node_count,
        edge_count=edge_count,
        node_types={r["type"]: r["cnt"] for r in node_types_rows},
        relationship_types={r["relationship"]: r["cnt"] for r in rel_rows},
    )
```

**Step 2: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add backend/services/graph_service.py
git commit -m "feat: add SQLite graph service (nodes/edges CRUD)"
```

---

## Task 5: Evidence Collection Engine

**Files:**
- Create: `backend/services/evidence_collector.py`

**Step 1: Create evidence_collector.py**

```python
# backend/services/evidence_collector.py
import asyncio
import hashlib
import json
import os
import uuid
import xml.etree.ElementTree as ET
from typing import List
import httpx
from bs4 import BeautifulSoup
from backend.models.evidence import EvidenceItem
from backend.services.llm_router import llm_call_json


async def collect_arxiv(query: str, max_results: int = 5) -> List[EvidenceItem]:
    url = f"https://export.arxiv.org/api/query?search_query=all:{query}&max_results={max_results}&sortBy=relevance"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
        root = ET.fromstring(resp.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items = []
        for entry in root.findall("atom:entry", ns):
            title_el = entry.find("atom:title", ns)
            summary_el = entry.find("atom:summary", ns)
            link_el = entry.find("atom:id", ns)
            if not (title_el is not None and summary_el is not None and link_el is not None):
                continue
            title = title_el.text.strip().replace("\n", " ")
            snippet = summary_el.text.strip().replace("\n", " ")[:500]
            url_str = link_el.text.strip()
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="arxiv",
                snippet=snippet,
                credibility_score=0.9,
                relevance_score=0.7,
            ))
        return items
    except Exception:
        return []


async def collect_hn(query: str, max_results: int = 5) -> List[EvidenceItem]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            search_resp = await client.get(
                f"https://hn.algolia.com/api/v1/search?query={query}&hitsPerPage={max_results}&tags=story"
            )
        data = search_resp.json()
        items = []
        for hit in data.get("hits", []):
            title = hit.get("title", "")
            url_str = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            snippet = hit.get("story_text") or hit.get("comment_text") or title
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="hn",
                snippet=str(snippet)[:500],
                credibility_score=0.7,
                relevance_score=0.65,
            ))
        return items
    except Exception:
        return []


async def collect_reddit(query: str, max_results: int = 5) -> List[EvidenceItem]:
    try:
        headers = {"User-Agent": "PREDECT/1.0"}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(
                f"https://www.reddit.com/search.json?q={query}&limit={max_results}&sort=relevance"
            )
        data = resp.json()
        items = []
        for post in data.get("data", {}).get("children", []):
            d = post["data"]
            title = d.get("title", "")
            url_str = f"https://reddit.com{d.get('permalink', '')}"
            snippet = d.get("selftext", title)[:500]
            items.append(EvidenceItem(
                id=hashlib.md5(url_str.encode()).hexdigest(),
                title=title,
                url=url_str,
                source="reddit",
                snippet=snippet,
                credibility_score=0.5,
                relevance_score=0.6,
            ))
        return items
    except Exception:
        return []


async def scrape_url(url: str) -> str:
    try:
        headers = {"User-Agent": "Mozilla/5.0 PREDECT/1.0"}
        async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = " ".join(soup.get_text().split())
        return text[:3000]
    except Exception:
        return ""


async def enrich_evidence(items: List[EvidenceItem], query: str) -> List[EvidenceItem]:
    """Use LLM to score relevance, extract entities, and sentiment."""
    if not items:
        return items

    batch_text = "\n\n".join([f"[{i}] {item.title}: {item.snippet}" for i, item in enumerate(items)])

    result = await llm_call_json(
        "evidence_summarization",
        system_prompt="You are an evidence analyst. Given a query and evidence items, score each item.",
        user_prompt=f"""Query: {query}

Evidence items:
{batch_text}

Return a JSON object with key "items" containing an array where each element has:
- index: int (0-based)
- relevance: float 0-1
- sentiment: float -1 to 1
- entities: array of strings (key named entities)

Return only valid JSON."""
    )

    enriched = list(items)
    for item_data in result.get("items", []):
        idx = item_data.get("index", -1)
        if 0 <= idx < len(enriched):
            enriched[idx].relevance_score = item_data.get("relevance", enriched[idx].relevance_score)
            enriched[idx].sentiment = item_data.get("sentiment", 0.0)
            enriched[idx].entities = item_data.get("entities", [])

    return enriched


async def collect_evidence(query: str, max_items: int = 20) -> List[EvidenceItem]:
    """Collect from all keyless sources in parallel."""
    results = await asyncio.gather(
        collect_arxiv(query, max_results=5),
        collect_hn(query, max_results=5),
        collect_reddit(query, max_results=5),
        return_exceptions=True,
    )

    items: List[EvidenceItem] = []
    for r in results:
        if isinstance(r, list):
            items.extend(r)

    # Deduplicate by URL
    seen_urls = set()
    unique = []
    for item in items:
        if item.url not in seen_urls:
            seen_urls.add(item.url)
            unique.append(item)

    # Enrich with LLM
    try:
        unique = await enrich_evidence(unique[:max_items], query)
    except Exception:
        pass

    # Sort by relevance × credibility
    unique.sort(key=lambda x: x.relevance_score * x.credibility_score, reverse=True)
    return unique[:max_items]
```

**Step 2: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add backend/services/evidence_collector.py
git commit -m "feat: add evidence collection engine (ArXiv, HN, Reddit)"
```

---

## Task 6: Simulation Engine

**Files:**
- Create: `backend/services/simulation.py`
- Create: `backend/services/report_generator.py`

**Step 1: Create simulation.py**

```python
# backend/services/simulation.py
import asyncio
import json
import uuid
from typing import List, AsyncIterator, Callable, Awaitable
from backend.models.simulation import AgentPersona, RoundEvent
from backend.models.evidence import EvidenceItem
from backend.services.llm_router import llm_call_json, llm_call


async def generate_personas(
    topic: str,
    evidence_items: List[EvidenceItem],
    count: int = 8,
) -> List[AgentPersona]:
    """Generate diverse agent personas seeded from evidence entities."""
    entities = []
    for item in evidence_items[:10]:
        entities.extend(item.entities[:3])
    entity_str = ", ".join(set(entities[:20])) if entities else "various stakeholders"

    result = await llm_call_json(
        "persona_generation",
        system_prompt="You are a simulation designer creating diverse agent personas for a prediction simulation.",
        user_prompt=f"""Topic: {topic}
Key entities from evidence: {entity_str}

Generate {count} diverse agent personas. Each should represent a different perspective, background, or stakeholder type related to the topic.

Return JSON: {{"agents": [{{"id": "agent_1", "name": "string", "role": "string", "beliefs": ["belief1", "belief2", "belief3"], "behavioral_bias": "string"}}]}}

Make agents diverse: experts, skeptics, optimists, domain insiders, public voices, international perspectives."""
    )

    agents = []
    for i, a in enumerate(result.get("agents", [])[:count]):
        agents.append(AgentPersona(
            id=a.get("id", f"agent_{i}"),
            name=a.get("name", f"Agent {i}"),
            role=a.get("role", "Analyst"),
            beliefs=a.get("beliefs", []),
            behavioral_bias=a.get("behavioral_bias", "neutral"),
        ))
    return agents


async def run_simulation_round(
    round_num: int,
    agents: List[AgentPersona],
    topic: str,
    on_event: Callable[[dict], Awaitable[None]] = None,
) -> tuple[List[RoundEvent], List[AgentPersona]]:
    """Run one round: randomly pair agents and generate interactions."""
    import random

    shuffled = agents[:]
    random.shuffle(shuffled)
    pairs = [(shuffled[i], shuffled[i+1]) for i in range(0, len(shuffled)-1, 2)]

    events = []
    updated_agents = {a.id: a for a in agents}

    for agent1, agent2 in pairs:
        result = await llm_call_json(
            "simulation_round",
            system_prompt="You are simulating a conversation between two agents analyzing a prediction topic.",
            user_prompt=f"""Round {round_num}. Topic: {topic}

Agent 1: {agent1.name} ({agent1.role})
Beliefs: {'; '.join(agent1.beliefs[:3])}
Bias: {agent1.behavioral_bias}

Agent 2: {agent2.name} ({agent2.role})
Beliefs: {'; '.join(agent2.beliefs[:3])}
Bias: {agent2.behavioral_bias}

Generate their interaction and belief updates.

Return JSON: {{
  "interaction_summary": "2-3 sentence summary",
  "emergent_claims": ["claim1", "claim2"],
  "agent1_belief_update": "new belief to add",
  "agent2_belief_update": "new belief to add"
}}"""
        )

        event = RoundEvent(
            round=round_num,
            agent1_id=agent1.id,
            agent2_id=agent2.id,
            agent1_name=agent1.name,
            agent2_name=agent2.name,
            interaction_summary=result.get("interaction_summary", ""),
            emergent_claims=result.get("emergent_claims", []),
        )
        events.append(event)

        # Update agent beliefs
        if result.get("agent1_belief_update"):
            updated_agents[agent1.id].beliefs.append(result["agent1_belief_update"])
            updated_agents[agent1.id].memory.append(f"R{round_num}: {result['agent1_belief_update']}")
        if result.get("agent2_belief_update"):
            updated_agents[agent2.id].beliefs.append(result["agent2_belief_update"])
            updated_agents[agent2.id].memory.append(f"R{round_num}: {result['agent2_belief_update']}")

        if on_event:
            await on_event({
                "phase": "simulation",
                "step": round_num,
                "message": f"Round {round_num}: {agent1.name} × {agent2.name}",
                "data": event.model_dump(),
            })

    return events, list(updated_agents.values())


async def run_full_simulation(
    topic: str,
    evidence_items: List[EvidenceItem],
    agent_count: int = 8,
    rounds: int = 5,
    on_event: Callable[[dict], Awaitable[None]] = None,
) -> tuple[List[AgentPersona], List[RoundEvent]]:
    """Run complete swarm simulation."""
    agents = await generate_personas(topic, evidence_items, agent_count)

    if on_event:
        await on_event({
            "phase": "agents",
            "step": 1,
            "totalSteps": rounds + 2,
            "message": f"Generated {len(agents)} agent personas",
            "data": {"agents": [a.model_dump() for a in agents]},
        })

    all_rounds = []
    for r in range(1, rounds + 1):
        round_events, agents = await run_simulation_round(r, agents, topic, on_event)
        all_rounds.extend(round_events)

    return agents, all_rounds
```

**Step 2: Create report_generator.py**

```python
# backend/services/report_generator.py
import json
from typing import List
from backend.models.prediction import PredictionReport, Scenarios, ScenarioItem, TimelineItem, ConfidenceBand
from backend.models.evidence import EvidenceItem
from backend.models.simulation import AgentPersona, RoundEvent
from backend.services.llm_router import llm_call_json


async def generate_report(
    query: str,
    domain: str,
    time_horizon: str,
    evidence_items: List[EvidenceItem],
    agents: List[AgentPersona],
    rounds: List[RoundEvent],
) -> PredictionReport:
    """Synthesize full prediction report from evidence + simulation."""

    # Collect all emergent claims
    all_claims = []
    for r in rounds:
        all_claims.extend(r.emergent_claims)

    # Collect all final beliefs
    all_beliefs = []
    for a in agents:
        all_beliefs.extend(a.beliefs[-2:])  # Latest 2 beliefs per agent

    evidence_summary = "\n".join([
        f"- [{item.source}] {item.title}: {item.snippet[:200]}"
        for item in evidence_items[:10]
    ])

    claims_summary = "\n".join([f"- {c}" for c in set(all_claims[:20])])
    beliefs_summary = "\n".join([f"- {b}" for b in set(all_beliefs[:20])])

    # Calculate agent consensus (simplified: how many rounds had >50% convergent claims)
    agent_consensus = min(0.9, len(set(all_claims)) / max(len(all_claims), 1))

    result = await llm_call_json(
        "prediction_synthesis",
        system_prompt="""You are a world-class analyst synthesizing evidence and simulation data into a structured prediction report.
Be specific, data-driven, and calibrated. Output valid JSON only.""",
        user_prompt=f"""Query: {query}
Domain: {domain}
Time Horizon: {time_horizon}

Evidence Summary:
{evidence_summary}

Simulation Emergent Claims:
{claims_summary}

Agent Final Beliefs:
{beliefs_summary}

Generate a comprehensive prediction report as JSON:
{{
  "headline": "Bold 1-sentence prediction headline",
  "verdict": "2-3 sentence verdict with specific details",
  "confidence_score": 0.0-1.0,
  "confidence_color": "#hex",
  "scenarios": {{
    "base": {{"description": "Most likely scenario (2-3 sentences)", "probability": 0.0-1.0}},
    "bull": {{"description": "Optimistic scenario (2-3 sentences)", "probability": 0.0-1.0}},
    "bear": {{"description": "Pessimistic scenario (2-3 sentences)", "probability": 0.0-1.0}}
  }},
  "keyDrivers": ["driver1", "driver2", "driver3", "driver4"],
  "riskFactors": ["risk1", "risk2", "risk3"],
  "timelineOutlook": [
    {{"period": "1 month", "outlook": "description"}},
    {{"period": "3 months", "outlook": "description"}},
    {{"period": "6 months", "outlook": "description"}}
  ],
  "dominantNarratives": ["narrative1", "narrative2", "narrative3"]
}}"""
    )

    score = float(result.get("confidence_score", 0.65))
    band_low = max(0.0, score - 0.15)
    band_high = min(1.0, score + 0.15)
    color = result.get("confidence_color", "#635BFF")

    scenarios_data = result.get("scenarios", {})

    return PredictionReport(
        headline=result.get("headline", f"Prediction for: {query}"),
        verdict=result.get("verdict", "Analysis complete."),
        confidence=ConfidenceBand(score=score, band=[band_low, band_high], color=color),
        scenarios=Scenarios(
            base=ScenarioItem(**scenarios_data.get("base", {"description": "Base case", "probability": 0.5})),
            bull=ScenarioItem(**scenarios_data.get("bull", {"description": "Bull case", "probability": 0.25})),
            bear=ScenarioItem(**scenarios_data.get("bear", {"description": "Bear case", "probability": 0.25})),
        ),
        keyDrivers=result.get("keyDrivers", []),
        riskFactors=result.get("riskFactors", []),
        timelineOutlook=[TimelineItem(**t) for t in result.get("timelineOutlook", [])],
        agentConsensus=agent_consensus,
        dominantNarratives=result.get("dominantNarratives", []),
    )
```

**Step 3: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add backend/services/
git commit -m "feat: add simulation engine and report generator"
```

---

## Task 7: FastAPI Main App + All Routes

**Files:**
- Create: `backend/main.py`
- Create: `backend/routers/predict.py`
- Create: `backend/routers/evidence.py`
- Create: `backend/routers/graph.py`
- Create: `backend/routers/orchestrator.py`

**Step 1: Create main.py**

```python
# backend/main.py
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from backend.db.database import init_db
from backend.routers import predict, evidence, graph, orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="PREDECT API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/api/predict", tags=["predict"])
app.include_router(evidence.router, prefix="/api/evidence", tags=["evidence"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(orchestrator.router, prefix="/api/orchestrator", tags=["orchestrator"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "PREDECT"}
```

**Step 2: Create predict router**

```python
# backend/routers/predict.py
import json
import uuid
from datetime import datetime
from typing import AsyncIterator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.models.prediction import PredictRequest, PredictionRecord
from backend.db.database import get_connection
from backend.services.evidence_collector import collect_evidence
from backend.services.simulation import run_full_simulation
from backend.services.report_generator import generate_report
from backend.services.graph_service import get_or_create_node, create_edge

router = APIRouter()

# In-memory SSE queues per prediction id
_sse_queues: dict = {}


async def run_pipeline(prediction_id: str, request: PredictRequest):
    """Full pipeline: evidence → graph → simulation → report."""
    import asyncio

    queue = _sse_queues.get(prediction_id)

    async def emit(event: dict):
        if queue:
            await queue.put(json.dumps(event))

    conn = get_connection()

    try:
        # Phase 1: Evidence
        await emit({"phase": "evidence", "step": 1, "totalSteps": 6, "message": "Collecting evidence...", "model": "glm-4-air", "task": "evidence_summarization"})

        evidence_items = []
        if request.collect_evidence:
            evidence_items = await collect_evidence(request.query, max_items=15)

        evidence_id = str(uuid.uuid4())
        with conn:
            conn.execute(
                "INSERT INTO evidence_bundles (id, prediction_id, query, items) VALUES (?, ?, ?, ?)",
                (evidence_id, prediction_id, request.query, json.dumps([e.model_dump() for e in evidence_items])),
            )

        await emit({"phase": "evidence", "step": 1, "totalSteps": 6, "message": f"Collected {len(evidence_items)} evidence items", "data": {"count": len(evidence_items)}})

        # Phase 2: Graph construction
        await emit({"phase": "graph", "step": 2, "totalSteps": 6, "message": "Building knowledge graph...", "model": "glm-4-air", "task": "graph_construction"})

        # Create prediction node
        pred_node = get_or_create_node("Prediction", request.query[:100])

        # Create entity nodes from evidence
        entity_names = set()
        for item in evidence_items:
            for entity in item.entities[:3]:
                entity_names.add(entity)

        for entity in list(entity_names)[:20]:
            entity_node = get_or_create_node("Concept", entity)
            create_edge(pred_node.id, entity_node.id, "RELATES_TO", weight=0.8)

        await emit({"phase": "graph", "step": 2, "totalSteps": 6, "message": f"Graph updated with {len(entity_names)} entities"})

        # Phase 3-4: Simulation
        await emit({"phase": "agents", "step": 3, "totalSteps": 6, "message": "Generating agent personas...", "model": "glm-4-flash", "task": "persona_generation"})

        sim_id = str(uuid.uuid4())
        with conn:
            conn.execute(
                "INSERT INTO simulations (id, prediction_id, agents, rounds, status) VALUES (?, ?, ?, ?, ?)",
                (sim_id, prediction_id, "[]", "[]", "running"),
            )

        agents, rounds = await run_full_simulation(
            topic=request.query,
            evidence_items=evidence_items,
            agent_count=request.agent_count,
            rounds=request.rounds,
            on_event=emit,
        )

        with conn:
            conn.execute(
                "UPDATE simulations SET agents = ?, rounds = ?, status = ? WHERE id = ?",
                (json.dumps([a.model_dump() for a in agents]), json.dumps([r.model_dump() for r in rounds]), "complete", sim_id),
            )

        # Phase 5: Analysis + Report
        await emit({"phase": "analysis", "step": 5, "totalSteps": 6, "message": "Synthesizing prediction...", "model": "glm-4", "task": "prediction_synthesis"})

        report = await generate_report(
            query=request.query,
            domain=request.domain or "general",
            time_horizon=request.time_horizon or "6 months",
            evidence_items=evidence_items,
            agents=agents,
            rounds=rounds,
        )

        # Phase 6: Save result
        await emit({"phase": "report", "step": 6, "totalSteps": 6, "message": "Prediction complete!", "data": report.model_dump()})

        with conn:
            conn.execute(
                "UPDATE predictions SET status = ?, confidence = ?, result = ? WHERE id = ?",
                ("complete", report.confidence.score, json.dumps(report.model_dump()), prediction_id),
            )

    except Exception as e:
        await emit({"phase": "error", "step": -1, "message": str(e)})
        with conn:
            conn.execute("UPDATE predictions SET status = ? WHERE id = ?", ("failed", prediction_id))

    finally:
        conn.close()
        if queue:
            await queue.put("[DONE]")


@router.post("/run")
async def run_prediction(request: PredictRequest):
    import asyncio

    prediction_id = str(uuid.uuid4())
    conn = get_connection()
    with conn:
        conn.execute(
            "INSERT INTO predictions (id, query, domain, time_horizon, status) VALUES (?, ?, ?, ?, ?)",
            (prediction_id, request.query, request.domain, request.time_horizon, "running"),
        )
    conn.close()

    # Start pipeline in background
    import asyncio
    queue = asyncio.Queue()
    _sse_queues[prediction_id] = queue
    asyncio.create_task(run_pipeline(prediction_id, request))

    return {"prediction_id": prediction_id, "status": "running"}


@router.get("/{prediction_id}/stream")
async def stream_prediction(prediction_id: str):
    import asyncio

    if prediction_id not in _sse_queues:
        # Check if already complete
        conn = get_connection()
        row = conn.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        conn.close()
        if row and row["status"] == "complete":
            async def done_gen():
                yield f"data: [DONE]\n\n"
            return StreamingResponse(done_gen(), media_type="text/event-stream")

    queue = _sse_queues.get(prediction_id)

    async def event_generator():
        if not queue:
            yield f"data: [DONE]\n\n"
            return

        while True:
            msg = await queue.get()
            if msg == "[DONE]":
                yield f"data: [DONE]\n\n"
                _sse_queues.pop(prediction_id, None)
                break
            yield f"data: {msg}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{prediction_id}/result")
async def get_result(prediction_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
    conn.close()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Prediction not found")

    result = json.loads(row["result"]) if row["result"] else None
    return PredictionRecord(
        id=row["id"],
        query=row["query"],
        domain=row["domain"],
        time_horizon=row["time_horizon"],
        status=row["status"],
        confidence=row["confidence"],
        result=result,
        created_at=row["created_at"],
    )


@router.get("/history")
async def get_history():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM predictions ORDER BY created_at DESC LIMIT 100").fetchall()
    conn.close()
    results = []
    for row in rows:
        result = json.loads(row["result"]) if row["result"] else None
        results.append({
            "id": row["id"],
            "query": row["query"],
            "domain": row["domain"],
            "time_horizon": row["time_horizon"],
            "status": row["status"],
            "confidence": row["confidence"],
            "headline": result.get("headline") if result else None,
            "created_at": row["created_at"],
        })
    return results
```

**Step 3: Create evidence router**

```python
# backend/routers/evidence.py
import json
import uuid
from fastapi import APIRouter
from backend.models.evidence import CollectRequest, EvidenceBundle
from backend.services.evidence_collector import collect_evidence, scrape_url
from backend.db.database import get_connection

router = APIRouter()


@router.post("/collect")
async def collect(request: CollectRequest):
    items = await collect_evidence(request.query, max_items=request.max_items or 20)
    bundle_id = str(uuid.uuid4())
    conn = get_connection()
    with conn:
        conn.execute(
            "INSERT INTO evidence_bundles (id, prediction_id, query, items) VALUES (?, ?, ?, ?)",
            (bundle_id, request.prediction_id, request.query, json.dumps([i.model_dump() for i in items])),
        )
    conn.close()
    return {"bundle_id": bundle_id, "count": len(items), "items": [i.model_dump() for i in items]}


@router.post("/fetch-url")
async def fetch_url(body: dict):
    url = body.get("url", "")
    text = await scrape_url(url)
    return {"url": url, "text": text, "length": len(text)}


@router.get("/bundle/{bundle_id}")
async def get_bundle(bundle_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM evidence_bundles WHERE id = ?", (bundle_id,)).fetchone()
    conn.close()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Bundle not found")
    return {
        "id": row["id"],
        "prediction_id": row["prediction_id"],
        "query": row["query"],
        "items": json.loads(row["items"]),
        "created_at": row["created_at"],
    }
```

**Step 4: Create graph router**

```python
# backend/routers/graph.py
from fastapi import APIRouter
from backend.services.graph_service import get_all_nodes, get_all_edges, get_graph_stats
from backend.db.database import get_connection
import json

router = APIRouter()


@router.get("/nodes")
async def nodes(limit: int = 500):
    return [n.model_dump() for n in get_all_nodes(limit)]


@router.get("/edges")
async def edges(limit: int = 1000):
    return [e.model_dump() for e in get_all_edges(limit)]


@router.get("/node/{node_id}")
async def get_node(node_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
    conn.close()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Node not found")
    return {"id": row["id"], "type": row["type"], "name": row["name"], "properties": json.loads(row["properties"] or "{}"), "created_at": row["created_at"]}


@router.get("/stats")
async def stats():
    return get_graph_stats().model_dump()


@router.get("/timeline")
async def timeline():
    conn = get_connection()
    rows = conn.execute(
        "SELECT date(created_at) as day, COUNT(*) as count FROM nodes GROUP BY day ORDER BY day DESC LIMIT 30"
    ).fetchall()
    conn.close()
    return [{"date": r["day"], "count": r["count"]} for r in rows]
```

**Step 5: Create orchestrator router**

```python
# backend/routers/orchestrator.py
from fastapi import APIRouter
from backend.services.llm_router import TASK_MODEL_MAP, TASK_TIER
from backend.db.database import get_connection
import json

router = APIRouter()


@router.post("/plan")
async def plan(body: dict):
    task = body.get("task", "quick_query")
    from backend.services.llm_router import get_model_for_task
    return {"task": task, "model": get_model_for_task(task), "tier": TASK_TIER.get(task, "balanced")}


@router.get("/status")
async def status():
    conn = get_connection()
    running = conn.execute("SELECT COUNT(*) FROM predictions WHERE status = 'running'").fetchone()[0]
    complete = conn.execute("SELECT COUNT(*) FROM predictions WHERE status = 'complete'").fetchone()[0]
    conn.close()
    return {"running": running, "complete": complete, "routing_table": TASK_MODEL_MAP}


@router.get("/usage")
async def usage():
    conn = get_connection()
    rows = conn.execute("SELECT status, COUNT(*) as cnt FROM predictions GROUP BY status").fetchall()
    conn.close()
    return {"predictions_by_status": {r["status"]: r["cnt"] for r in rows}}
```

**Step 6: Create backend __init__ files**

```bash
touch /c/Users/saymyname/Projects/Strat/backend/__init__.py
touch /c/Users/saymyname/Projects/Strat/backend/routers/__init__.py
touch /c/Users/saymyname/Projects/Strat/backend/services/__init__.py
touch /c/Users/saymyname/Projects/Strat/backend/models/__init__.py
touch /c/Users/saymyname/Projects/Strat/backend/db/__init__.py
```

**Step 7: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add backend/
git commit -m "feat: add FastAPI routes (predict, evidence, graph, orchestrator)"
```

---

## Task 8: Frontend Configuration

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/globals.css`
- Create: `frontend/lib/utils.ts`
- Create: `frontend/lib/api.ts`

**Step 1: Update tailwind.config.ts**

```typescript
// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0a0f",
          card: "rgba(255,255,255,0.03)",
          hover: "rgba(255,255,255,0.06)",
        },
        accent: {
          DEFAULT: "#635BFF",
          hover: "#7C75FF",
          muted: "rgba(99,91,255,0.15)",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.15)",
        },
        text: {
          primary: "#F8F8FC",
          secondary: "rgba(248,248,252,0.6)",
          muted: "rgba(248,248,252,0.35)",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        tier: {
          fast: "#10B981",
          balanced: "#F59E0B",
          premium: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backdropBlur: {
        glass: "16px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 2: Update globals.css**

```css
/* frontend/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-base: #0a0a0f;
  --bg-card: rgba(255, 255, 255, 0.03);
  --bg-hover: rgba(255, 255, 255, 0.06);
  --accent: #635BFF;
  --accent-hover: #7C75FF;
  --accent-muted: rgba(99, 91, 255, 0.15);
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.15);
  --text-primary: #F8F8FC;
  --text-secondary: rgba(248, 248, 252, 0.6);
  --text-muted: rgba(248, 248, 252, 0.35);
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Glass card utility */
.glass {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 12px;
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #635BFF, #A78BFA, #60A5FA);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Animated gradient background for hero */
.hero-bg {
  background: radial-gradient(ellipse at 20% 50%, rgba(99, 91, 255, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(167, 139, 250, 0.1) 0%, transparent 50%),
              radial-gradient(ellipse at 60% 80%, rgba(96, 165, 250, 0.08) 0%, transparent 50%),
              var(--bg-base);
}

/* Shimmer skeleton */
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
  border-radius: 6px;
}
```

**Step 3: Create utils.ts**

```typescript
// frontend/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function getConfidenceColor(score: number): string {
  if (score >= 0.75) return "#10B981";
  if (score >= 0.5) return "#F59E0B";
  return "#EF4444";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + "..." : str;
}
```

**Step 4: Create api.ts**

```typescript
// frontend/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PredictRequest {
  query: string;
  domain?: string;
  time_horizon?: string;
  agent_count?: number;
  rounds?: number;
  collect_evidence?: boolean;
}

export interface SSEEvent {
  phase: string;
  step: number;
  totalSteps?: number;
  message: string;
  model?: string;
  task?: string;
  tokens?: number;
  data?: Record<string, unknown>;
}

export async function startPrediction(req: PredictRequest): Promise<{ prediction_id: string }> {
  const res = await fetch(`${API_URL}/api/predict/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to start prediction: ${res.statusText}`);
  return res.json();
}

export function streamPrediction(predictionId: string, onEvent: (e: SSEEvent) => void, onDone: () => void): () => void {
  const es = new EventSource(`${API_URL}/api/predict/${predictionId}/stream`);

  es.onmessage = (e) => {
    if (e.data === "[DONE]") {
      es.close();
      onDone();
      return;
    }
    try {
      const event = JSON.parse(e.data) as SSEEvent;
      onEvent(event);
    } catch {}
  };

  es.onerror = () => {
    es.close();
    onDone();
  };

  return () => es.close();
}

export async function getPredictionResult(id: string) {
  const res = await fetch(`${API_URL}/api/predict/${id}/result`);
  if (!res.ok) throw new Error("Failed to get result");
  return res.json();
}

export async function getPredictionHistory() {
  const res = await fetch(`${API_URL}/api/predict/history`);
  if (!res.ok) return [];
  return res.json();
}

export async function collectEvidence(query: string, predictionId?: string) {
  const res = await fetch(`${API_URL}/api/evidence/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, prediction_id: predictionId, max_items: 20 }),
  });
  if (!res.ok) throw new Error("Evidence collection failed");
  return res.json();
}

export async function getGraphNodes(limit = 500) {
  const res = await fetch(`${API_URL}/api/graph/nodes?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGraphEdges(limit = 1000) {
  const res = await fetch(`${API_URL}/api/graph/edges?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGraphStats() {
  const res = await fetch(`${API_URL}/api/graph/stats`);
  if (!res.ok) return null;
  return res.json();
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
```

**Step 5: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/
git commit -m "feat: configure Tailwind design tokens and frontend API client"
```

---

## Task 9: Zustand Stores

**Files:**
- Create: `frontend/lib/stores/predictionStore.ts`
- Create: `frontend/lib/stores/settingsStore.ts`

**Step 1: Create predictionStore.ts**

```typescript
// frontend/lib/stores/predictionStore.ts
import { create } from "zustand";
import type { SSEEvent } from "@/lib/api";

export interface PredictionState {
  predictionId: string | null;
  status: "idle" | "running" | "complete" | "error";
  events: SSEEvent[];
  result: Record<string, unknown> | null;
  progress: number;
  currentPhase: string;
  agents: unknown[];
  roundEvents: unknown[];
  error: string | null;

  setPredictionId: (id: string) => void;
  setStatus: (s: PredictionState["status"]) => void;
  addEvent: (e: SSEEvent) => void;
  setResult: (r: Record<string, unknown>) => void;
  reset: () => void;
}

export const usePredictionStore = create<PredictionState>((set) => ({
  predictionId: null,
  status: "idle",
  events: [],
  result: null,
  progress: 0,
  currentPhase: "",
  agents: [],
  roundEvents: [],
  error: null,

  setPredictionId: (id) => set({ predictionId: id }),
  setStatus: (status) => set({ status }),
  addEvent: (e) =>
    set((state) => ({
      events: [...state.events, e],
      progress: e.totalSteps ? Math.round((e.step / e.totalSteps) * 100) : state.progress,
      currentPhase: e.phase,
      agents: e.phase === "agents" && e.data?.agents ? (e.data.agents as unknown[]) : state.agents,
      roundEvents: e.phase === "simulation" && e.data ? [...state.roundEvents, e.data] : state.roundEvents,
    })),
  setResult: (result) => set({ result, status: "complete" }),
  reset: () =>
    set({
      predictionId: null,
      status: "idle",
      events: [],
      result: null,
      progress: 0,
      currentPhase: "",
      agents: [],
      roundEvents: [],
      error: null,
    }),
}));
```

**Step 2: Create settingsStore.ts**

```typescript
// frontend/lib/stores/settingsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Settings {
  agentCount: number;
  rounds: number;
  defaultDomain: string;
  defaultTimeHorizon: string;
  newsApiKey: string;
  gNewsApiKey: string;
  alphaVantageKey: string;

  setAgentCount: (n: number) => void;
  setRounds: (n: number) => void;
  setDefaultDomain: (d: string) => void;
  setDefaultTimeHorizon: (h: string) => void;
  setNewsApiKey: (k: string) => void;
  setGNewsApiKey: (k: string) => void;
  setAlphaVantageKey: (k: string) => void;
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      agentCount: 8,
      rounds: 5,
      defaultDomain: "general",
      defaultTimeHorizon: "6 months",
      newsApiKey: "",
      gNewsApiKey: "",
      alphaVantageKey: "",

      setAgentCount: (agentCount) => set({ agentCount }),
      setRounds: (rounds) => set({ rounds }),
      setDefaultDomain: (defaultDomain) => set({ defaultDomain }),
      setDefaultTimeHorizon: (defaultTimeHorizon) => set({ defaultTimeHorizon }),
      setNewsApiKey: (newsApiKey) => set({ newsApiKey }),
      setGNewsApiKey: (gNewsApiKey) => set({ gNewsApiKey }),
      setAlphaVantageKey: (alphaVantageKey) => set({ alphaVantageKey }),
    }),
    { name: "predect-settings" }
  )
);
```

**Step 3: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/lib/
git commit -m "feat: add Zustand prediction and settings stores"
```

---

## Task 10: UI Component Library

**Files:**
- Create: `frontend/components/ui/Button.tsx`
- Create: `frontend/components/ui/Card.tsx`
- Create: `frontend/components/ui/Badge.tsx`
- Create: `frontend/components/ui/Input.tsx`
- Create: `frontend/components/ui/Progress.tsx`
- Create: `frontend/components/ui/Skeleton.tsx`
- Create: `frontend/components/ui/ModelBadge.tsx`
- Create: `frontend/components/ui/Tabs.tsx`

**Step 1: Button.tsx**

```tsx
// frontend/components/ui/Button.tsx
"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/25",
      ghost: "hover:bg-bg-hover text-text-secondary hover:text-text-primary",
      outline: "border border-border hover:border-border-strong text-text-secondary hover:text-text-primary hover:bg-bg-hover",
      danger: "bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20",
    };
    const sizes = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-6 py-3 gap-2",
    };
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...(props as Record<string, unknown>)}
      >
        {loading && (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
```

**Step 2: Card.tsx**

```tsx
// frontend/components/ui/Card.tsx
import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export function Card({ className, glow, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-4",
        glow && "shadow-lg shadow-accent/10 border-accent/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between mb-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-text-primary", className)} {...props}>
      {children}
    </h3>
  );
}
```

**Step 3: Badge.tsx**

```tsx
// frontend/components/ui/Badge.tsx
import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "accent" | "muted";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", size = "sm", children, className }: BadgeProps) {
  const variants = {
    default: "bg-white/5 text-text-secondary border border-border",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    danger: "bg-danger/10 text-danger border border-danger/20",
    accent: "bg-accent/10 text-accent border border-accent/20",
    muted: "bg-white/3 text-text-muted border border-border",
  };
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full font-medium", variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}
```

**Step 4: Input.tsx**

```tsx
// frontend/components/ui/Input.tsx
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-medium text-text-secondary">{label}</label>}
    <input
      ref={ref}
      className={cn(
        "w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted",
        "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
        "transition-all duration-200",
        error && "border-danger focus:border-danger focus:ring-danger/30",
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-danger">{error}</p>}
  </div>
));
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, className, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-medium text-text-secondary">{label}</label>}
    <textarea
      ref={ref}
      className={cn(
        "w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted",
        "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
        "transition-all duration-200 resize-none",
        className
      )}
      {...props}
    />
  </div>
));
Textarea.displayName = "Textarea";
```

**Step 5: Progress.tsx**

```tsx
// frontend/components/ui/Progress.tsx
"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  color?: string;
  showLabel?: boolean;
}

export function Progress({ value, max = 100, className, color = "#635BFF", showLabel }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>
      {showLabel && <span className="text-xs text-text-muted font-mono w-8 text-right">{Math.round(pct)}%</span>}
    </div>
  );
}
```

**Step 6: Skeleton.tsx**

```tsx
// frontend/components/ui/Skeleton.tsx
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}
```

**Step 7: ModelBadge.tsx**

```tsx
// frontend/components/ui/ModelBadge.tsx
"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModelBadgeProps {
  model: string;
  task?: string;
  tier?: "fast" | "balanced" | "premium";
  active?: boolean;
  tokens?: number;
}

const tierDots = {
  fast: "bg-success",
  balanced: "bg-warning",
  premium: "bg-danger",
};

const tierColors = {
  fast: "text-success",
  balanced: "text-warning",
  premium: "text-danger",
};

export function ModelBadge({ model, task, tier = "balanced", active, tokens }: ModelBadgeProps) {
  return (
    <motion.div
      layout
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg glass text-xs",
        active && "border-accent/30 bg-accent/5"
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", tierDots[tier], active && "animate-pulse")} />
      <span className="font-mono text-text-primary font-medium">{model}</span>
      {task && <span className="text-text-muted">·</span>}
      {task && <span className={cn("text-text-muted", active && tierColors[tier])}>{task.replace(/_/g, " ")}</span>}
      {tokens && <span className="ml-auto text-text-muted font-mono">{tokens.toLocaleString()}t</span>}
    </motion.div>
  );
}
```

**Step 8: Tabs.tsx**

```tsx
// frontend/components/ui/Tabs.tsx
"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex items-center gap-1 bg-white/3 p-1 rounded-lg", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200",
            activeTab === tab.id ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-bg"
              className="absolute inset-0 bg-white/8 rounded-md"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{tab.icon}</span>
          <span className="relative">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

**Step 9: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/components/
git commit -m "feat: add UI component library (Button, Card, Badge, Input, Progress, Skeleton, ModelBadge, Tabs)"
```

---

## Task 11: Root Layout + Navigation

**Files:**
- Modify: `frontend/app/layout.tsx`
- Create: `frontend/components/Navigation.tsx`

**Step 1: Update layout.tsx**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "PREDECT — Swarm Intelligence Prediction Platform",
  description: "Feed it reality. It returns the future.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-[#F8F8FC] antialiased">
        <QueryProvider>
          <Navigation />
          <main className="pt-14">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
```

**Step 2: Create QueryProvider**

```tsx
// frontend/components/QueryProvider.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

**Step 3: Create Navigation.tsx**

```tsx
// frontend/components/Navigation.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BrainCircuit, Network, FileSearch, History, Settings, Zap,
} from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Zap },
  { href: "/predict", label: "Predict", icon: BrainCircuit },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/evidence", label: "Evidence", icon: FileSearch },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-bg-base/80 backdrop-blur-glass">
      <div className="max-w-screen-2xl mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-accent" />
          </div>
          <span className="font-bold text-sm tracking-tight">
            PRE<span className="text-accent">DECT</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href) && href !== "/";
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
                  active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-white/6 rounded-lg border border-border"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon className="relative w-3.5 h-3.5" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-text-muted">Z.AI Connected</span>
        </div>
      </div>
    </nav>
  );
}
```

**Step 4: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/
git commit -m "feat: add root layout, navigation, and query provider"
```

---

## Task 12: Landing Page

**Files:**
- Modify: `frontend/app/page.tsx`

**Step 1: Write landing page**

```tsx
// frontend/app/page.tsx
"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  BrainCircuit, Network, FileSearch, Zap, ChevronRight,
  BarChart3, Cpu, Globe, ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Evidence Collection",
    description: "Autonomously scans ArXiv, Hacker News, Reddit, and the web. Zero API keys required.",
    badge: "Keyless",
  },
  {
    icon: BrainCircuit,
    title: "Swarm Simulation",
    description: "8+ AI agents with distinct personas debate your prediction through multiple interaction rounds.",
    badge: "GLM-4-Flash",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    description: "Entities and relationships extracted from evidence build an explorable graph over time.",
    badge: "SQLite",
  },
  {
    icon: BarChart3,
    title: "Structured Reports",
    description: "Confidence scores, scenario trees, timeline forecasts, and dominant narrative clusters.",
    badge: "GLM-4",
  },
];

const steps = [
  { n: "01", title: "Enter your question", desc: "Any topic: markets, geopolitics, technology, sports." },
  { n: "02", title: "Evidence collection", desc: "PREDECT searches academic papers, forums, and the web." },
  { n: "03", title: "Swarm simulation", desc: "Diverse AI agents debate the topic through structured rounds." },
  { n: "04", title: "Prediction report", desc: "Confidence score, scenarios, drivers, and risk factors." },
];

const examples = [
  { query: "Will the Fed cut rates before Q3 2026?", confidence: 0.72, domain: "Finance" },
  { query: "OpenAI GPT-5 release timeline", confidence: 0.61, domain: "Technology" },
  { query: "Euro 2026 winner prediction", confidence: 0.48, domain: "Sports" },
];

const models = [
  { model: "glm-4-flash", task: "Persona & Simulation", tier: "fast", color: "#10B981" },
  { model: "glm-4-air", task: "Evidence & Graph", tier: "balanced", color: "#F59E0B" },
  { model: "glm-4", task: "Synthesis & Scoring", tier: "premium", color: "#EF4444" },
  { model: "glm-4-plus", task: "Sentiment & Narrative", tier: "premium", color: "#EF4444" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="hero-bg relative overflow-hidden px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="accent" size="md" className="mb-6">
              <Zap className="w-3 h-3 mr-1" />
              Powered by Z.AI GLM Swarm Intelligence
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Feed it{" "}
            <span className="gradient-text">reality</span>
            <br />
            It returns the{" "}
            <span className="gradient-text">future</span>
          </motion.h1>

          <motion.p
            className="text-lg text-text-secondary max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            PREDECT collects evidence from across the web, runs a swarm of AI agents through
            a structured simulation, and synthesizes a structured prediction with confidence
            scores, scenario trees, and a knowledge graph.
          </motion.p>

          <motion.div
            className="flex items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link href="/predict">
              <Button size="lg" className="group">
                Start Predicting
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="/graph">
              <Button size="lg" variant="outline">
                Explore Graph
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold mb-3">How it works</h2>
          <p className="text-text-secondary">Four AI-powered stages from question to prediction</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full hover:border-border-strong transition-colors duration-300">
                <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-accent" />
                </div>
                <Badge variant="muted" className="mb-3">{f.badge}</Badge>
                <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{f.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works steps */}
      <section className="px-6 py-20 border-y border-border bg-white/1">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-3xl font-bold text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Four-phase pipeline
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-4xl font-bold font-mono gradient-text mb-3">{step.n}</div>
                <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-text-secondary">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Example predictions */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <motion.h2
          className="text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Example predictions
        </motion.h2>
        <div className="space-y-3">
          {examples.map((ex, i) => (
            <motion.div
              key={ex.query}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="flex items-center justify-between hover:border-border-strong transition-colors">
                <div className="flex items-center gap-3">
                  <Badge variant="muted">{ex.domain}</Badge>
                  <span className="text-sm">{ex.query}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div
                    className="text-sm font-bold font-mono"
                    style={{ color: ex.confidence >= 0.7 ? "#10B981" : ex.confidence >= 0.5 ? "#F59E0B" : "#EF4444" }}
                  >
                    {Math.round(ex.confidence * 100)}%
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/predict">
            <Button variant="outline">Run your own prediction</Button>
          </Link>
        </div>
      </section>

      {/* Model orchestration */}
      <section className="px-6 py-20 border-t border-border bg-white/1">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-3xl font-bold mb-3">Intelligent model routing</h2>
            <p className="text-text-secondary mb-10">
              Each task is routed to the optimal GLM model — fast models for high-volume simulation, premium models for synthesis.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {models.map((m) => (
                <div key={m.model} className="glass rounded-xl p-4 text-left">
                  <div className="w-2 h-2 rounded-full mb-3" style={{ background: m.color }} />
                  <div className="font-mono text-xs font-bold mb-1">{m.model}</div>
                  <div className="text-xs text-text-muted">{m.task}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-4xl font-bold mb-4">Ready to predict?</h2>
          <p className="text-text-secondary mb-8 max-w-lg mx-auto">
            No API keys required. PREDECT works out of the box with keyless evidence sources.
          </p>
          <Link href="/predict">
            <Button size="lg">
              <Zap className="w-4 h-4" />
              Launch Prediction Engine
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/app/page.tsx
git commit -m "feat: add landing page with hero, features, and model routing showcase"
```

---

## Task 13: Predict Workspace Page

**Files:**
- Create: `frontend/app/predict/page.tsx`
- Create: `frontend/components/predict/ConfigPanel.tsx`
- Create: `frontend/components/predict/PipelinePanel.tsx`
- Create: `frontend/components/predict/ActivityPanel.tsx`
- Create: `frontend/components/predict/ResultsView.tsx`

**Step 1: Create ConfigPanel.tsx**

```tsx
// frontend/components/predict/ConfigPanel.tsx
"use client";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SlidersHorizontal } from "lucide-react";

interface ConfigPanelProps {
  query: string;
  setQuery: (q: string) => void;
  domain: string;
  setDomain: (d: string) => void;
  timeHorizon: string;
  setTimeHorizon: (t: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

const domains = ["general", "finance", "technology", "politics", "science", "sports", "crypto", "climate"];
const horizons = ["1 week", "1 month", "3 months", "6 months", "1 year", "2+ years"];

export function ConfigPanel({ query, setQuery, domain, setDomain, timeHorizon, setTimeHorizon, onSubmit, loading }: ConfigPanelProps) {
  const { agentCount, rounds, setAgentCount, setRounds } = useSettingsStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold">Configuration</span>
      </div>

      <Card>
        <CardHeader><CardTitle>Question</CardTitle></CardHeader>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What will happen with..."
          rows={4}
          className="mb-3"
        />
        <Button onClick={onSubmit} loading={loading} disabled={!query.trim()} className="w-full">
          Run Prediction
        </Button>
      </Card>

      <Card>
        <CardHeader><CardTitle>Domain</CardTitle></CardHeader>
        <div className="grid grid-cols-2 gap-1.5">
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className={`text-xs px-2 py-1.5 rounded-md border transition-colors capitalize ${
                domain === d
                  ? "bg-accent/15 border-accent/30 text-accent"
                  : "border-border text-text-muted hover:border-border-strong hover:text-text-secondary"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Time Horizon</CardTitle></CardHeader>
        <div className="space-y-1.5">
          {horizons.map((h) => (
            <button
              key={h}
              onClick={() => setTimeHorizon(h)}
              className={`w-full text-left text-xs px-3 py-1.5 rounded-md border transition-colors ${
                timeHorizon === h
                  ? "bg-accent/15 border-accent/30 text-accent"
                  : "border-transparent text-text-muted hover:border-border hover:text-text-secondary"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Simulation</CardTitle></CardHeader>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Agents</span>
              <span className="text-xs font-mono text-text-primary">{agentCount}</span>
            </div>
            <input
              type="range"
              min={4}
              max={16}
              value={agentCount}
              onChange={(e) => setAgentCount(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Rounds</span>
              <span className="text-xs font-mono text-text-primary">{rounds}</span>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
```

**Step 2: Create PipelinePanel.tsx**

```tsx
// frontend/components/predict/PipelinePanel.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { Progress } from "@/components/ui/Progress";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CheckCircle, Circle, Loader2 } from "lucide-react";

const phases = [
  { id: "evidence", label: "Evidence Collection", color: "#635BFF" },
  { id: "graph", label: "Graph Construction", color: "#635BFF" },
  { id: "agents", label: "Agent Generation", color: "#635BFF" },
  { id: "simulation", label: "Swarm Simulation", color: "#635BFF" },
  { id: "analysis", label: "Synthesis", color: "#635BFF" },
  { id: "report", label: "Report Generation", color: "#10B981" },
];

export function PipelinePanel() {
  const { status, events, progress, currentPhase } = usePredictionStore();

  if (status === "idle") return null;

  const completedPhases = new Set(events.map((e) => e.phase));

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">Pipeline Progress</span>
        <Badge variant={status === "complete" ? "success" : status === "error" ? "danger" : "accent"}>
          {status === "running" ? "Running" : status === "complete" ? "Complete" : "Error"}
        </Badge>
      </div>

      <Progress value={progress} showLabel className="mb-4" />

      <div className="space-y-2">
        {phases.map((phase) => {
          const done = completedPhases.has(phase.id);
          const active = currentPhase === phase.id && status === "running";
          return (
            <div key={phase.id} className="flex items-center gap-2.5">
              {done ? (
                <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
              ) : active ? (
                <Loader2 className="w-3.5 h-3.5 text-accent flex-shrink-0 animate-spin" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              )}
              <span className={`text-xs ${done || active ? "text-text-primary" : "text-text-muted"}`}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Latest message */}
      <AnimatePresence mode="wait">
        {events.length > 0 && (
          <motion.div
            key={events[events.length - 1]?.message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 pt-3 border-t border-border"
          >
            <p className="text-xs text-text-muted">
              {events[events.length - 1]?.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
```

**Step 3: Create ActivityPanel.tsx**

```tsx
// frontend/components/predict/ActivityPanel.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ModelBadge } from "@/components/ui/ModelBadge";
import { Activity, Users } from "lucide-react";

export function ActivityPanel() {
  const { events, agents, status } = usePredictionStore();

  const modelEvents = events.filter((e) => e.model && e.task);
  const latestModelEvent = modelEvents[modelEvents.length - 1];

  return (
    <div className="space-y-4">
      {/* Model activity */}
      <Card>
        <CardHeader>
          <CardTitle>Model Activity</CardTitle>
          <Activity className="w-3.5 h-3.5 text-text-muted" />
        </CardHeader>
        <div className="space-y-2">
          <AnimatePresence>
            {modelEvents.slice(-6).reverse().map((e, i) => (
              <motion.div
                key={`${e.phase}-${e.step}-${i}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <ModelBadge
                  model={e.model || ""}
                  task={e.task}
                  active={i === 0 && status === "running"}
                  tokens={e.tokens}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {modelEvents.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No activity yet</p>
          )}
        </div>
      </Card>

      {/* Agents */}
      {agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Swarm</CardTitle>
            <Users className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <div className="space-y-2">
            {(agents as Array<{ id: string; name: string; role: string; behavioral_bias: string }>).map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 p-2 rounded-lg bg-white/2"
              >
                <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                  {agent.name[0]}
                </div>
                <div>
                  <div className="text-xs font-medium">{agent.name}</div>
                  <div className="text-xs text-text-muted">{agent.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

**Step 4: Create ResultsView.tsx**

```tsx
// frontend/components/predict/ResultsView.tsx
"use client";
import { motion } from "framer-motion";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatConfidence, getConfidenceColor } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export function ResultsView() {
  const { result, status } = usePredictionStore();

  if (status !== "complete" || !result) return null;

  const report = result as {
    headline: string;
    verdict: string;
    confidence: { score: number; band: number[]; color: string };
    scenarios: {
      base: { description: string; probability: number };
      bull: { description: string; probability: number };
      bear: { description: string; probability: number };
    };
    keyDrivers: string[];
    riskFactors: string[];
    timelineOutlook: Array<{ period: string; outlook: string }>;
    agentConsensus: number;
    dominantNarratives: string[];
  };

  const confidenceColor = getConfidenceColor(report.confidence.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Headline + Confidence */}
      <Card glow>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Badge variant="success" className="mb-2">Prediction Complete</Badge>
            <h2 className="text-xl font-bold leading-tight">{report.headline}</h2>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-4xl font-bold font-mono" style={{ color: confidenceColor }}>
              {formatConfidence(report.confidence.score)}
            </div>
            <div className="text-xs text-text-muted">confidence</div>
          </div>
        </div>
        <p className="text-sm text-text-secondary">{report.verdict}</p>
        {report.agentConsensus !== undefined && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <span className="text-xs text-text-muted">Agent consensus:</span>
            <span className="text-xs font-mono text-text-primary">{Math.round(report.agentConsensus * 100)}%</span>
          </div>
        )}
      </Card>

      {/* Scenarios */}
      <Card>
        <CardHeader><CardTitle>Scenarios</CardTitle></CardHeader>
        <div className="space-y-3">
          {[
            { key: "base", label: "Base Case", icon: Minus, color: "#635BFF" },
            { key: "bull", label: "Bull Case", icon: TrendingUp, color: "#10B981" },
            { key: "bear", label: "Bear Case", icon: TrendingDown, color: "#EF4444" },
          ].map(({ key, label, icon: Icon, color }) => {
            const scenario = report.scenarios[key as keyof typeof report.scenarios];
            return (
              <div key={key} className="p-3 rounded-lg bg-white/2 border border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                  </div>
                  <span className="text-xs font-mono text-text-muted">
                    {Math.round(scenario.probability * 100)}%
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{scenario.description}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Key Drivers + Risk Factors */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Key Drivers</CardTitle></CardHeader>
          <ul className="space-y-1.5">
            {report.keyDrivers.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle className="w-3 h-3 text-success flex-shrink-0 mt-0.5" />
                <span className="text-xs text-text-secondary">{d}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader><CardTitle>Risk Factors</CardTitle></CardHeader>
          <ul className="space-y-1.5">
            {report.riskFactors.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0 mt-0.5" />
                <span className="text-xs text-text-secondary">{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline Outlook</CardTitle>
          <Clock className="w-3.5 h-3.5 text-text-muted" />
        </CardHeader>
        <div className="space-y-2">
          {report.timelineOutlook.map((t, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xs font-mono text-accent w-20 flex-shrink-0">{t.period}</span>
              <span className="text-xs text-text-secondary">{t.outlook}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Dominant narratives */}
      {report.dominantNarratives?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Dominant Narratives</CardTitle></CardHeader>
          <div className="space-y-2">
            {report.dominantNarratives.map((n, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/2">
                <span className="text-xs font-mono text-accent flex-shrink-0">#{i + 1}</span>
                <span className="text-xs text-text-secondary">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
```

**Step 5: Create predict/page.tsx**

```tsx
// frontend/app/predict/page.tsx
"use client";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ConfigPanel } from "@/components/predict/ConfigPanel";
import { PipelinePanel } from "@/components/predict/PipelinePanel";
import { ActivityPanel } from "@/components/predict/ActivityPanel";
import { ResultsView } from "@/components/predict/ResultsView";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { startPrediction, streamPrediction, getPredictionResult } from "@/lib/api";
import { BrainCircuit } from "lucide-react";

export default function PredictPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("general");
  const [timeHorizon, setTimeHorizon] = useState("6 months");
  const { agentCount, rounds } = useSettingsStore();
  const { addEvent, setResult, setPredictionId, setStatus, reset } = usePredictionStore();
  const status = usePredictionStore((s) => s.status);

  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    reset();
    setStatus("running");

    try {
      const { prediction_id } = await startPrediction({
        query,
        domain,
        time_horizon: timeHorizon,
        agent_count: agentCount,
        rounds,
        collect_evidence: true,
      });
      setPredictionId(prediction_id);

      const cleanup = streamPrediction(
        prediction_id,
        (event) => {
          addEvent(event);
          if (event.phase === "report" && event.data) {
            setResult(event.data as Record<string, unknown>);
            setStatus("complete");
            cleanup();
          }
        },
        async () => {
          // Fallback: fetch final result
          try {
            const result = await getPredictionResult(prediction_id);
            if (result?.result) {
              setResult(result.result);
              setStatus("complete");
            }
          } catch {}
        }
      );
    } catch (e) {
      setStatus("error");
    }
  }, [query, domain, timeHorizon, agentCount, rounds, addEvent, setResult, setPredictionId, setStatus, reset]);

  return (
    <div className="h-[calc(100vh-56px)] flex overflow-hidden">
      {/* Left: Config */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-[260px] flex-shrink-0 border-r border-border overflow-y-auto p-4"
      >
        <ConfigPanel
          query={query}
          setQuery={setQuery}
          domain={domain}
          setDomain={setDomain}
          timeHorizon={timeHorizon}
          setTimeHorizon={setTimeHorizon}
          onSubmit={handleSubmit}
          loading={status === "running"}
        />
      </motion.div>

      {/* Center: Pipeline + Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {status === "idle" && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
              <BrainCircuit className="w-10 h-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Ready to predict</h2>
            <p className="text-text-secondary text-sm max-w-sm">
              Enter your question and configure the simulation on the left, then click Run Prediction.
            </p>
          </div>
        )}
        <PipelinePanel />
        <ResultsView />
      </div>

      {/* Right: Activity */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-[320px] flex-shrink-0 border-l border-border overflow-y-auto p-4"
      >
        <ActivityPanel />
      </motion.div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/
git commit -m "feat: add predict workspace with 3-panel layout, pipeline, and results view"
```

---

## Task 14: Graph Explorer Page

**Files:**
- Create: `frontend/app/graph/page.tsx`
- Create: `frontend/components/graph/GraphCanvas.tsx`

**Step 1: Create GraphCanvas.tsx**

```tsx
// frontend/components/graph/GraphCanvas.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  weight: number;
}

const NODE_COLORS: Record<string, string> = {
  Person: "#635BFF",
  Organization: "#10B981",
  Event: "#F59E0B",
  Location: "#60A5FA",
  Concept: "#A78BFA",
  Prediction: "#EC4899",
};

export function GraphCanvas({ nodes, edges, onNodeSelect }: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect: (node: GraphNode | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Simple force-directed simulation
  const posRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    // Initialize positions
    nodes.forEach((n) => {
      if (!posRef.current.has(n.id)) {
        posRef.current.set(n.id, {
          x: W / 2 + (Math.random() - 0.5) * W * 0.8,
          y: H / 2 + (Math.random() - 0.5) * H * 0.8,
          vx: 0,
          vy: 0,
        });
      }
    });

    let tick = 0;
    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Force simulation (simplified)
      if (tick < 200) {
        const positions = posRef.current;
        const nodeArr = nodes.map((n) => ({ ...n, ...positions.get(n.id)! }));

        // Repulsion
        for (let i = 0; i < nodeArr.length; i++) {
          for (let j = i + 1; j < nodeArr.length; j++) {
            const a = nodeArr[i], b = nodeArr[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 2000 / (dist * dist);
            const fx = (dx / dist) * force, fy = (dy / dist) * force;
            const posA = positions.get(a.id)!;
            const posB = positions.get(b.id)!;
            posA.vx -= fx; posA.vy -= fy;
            posB.vx += fx; posB.vy += fy;
          }
        }

        // Attraction (edges)
        edges.forEach((e) => {
          const a = positions.get(e.source_id), b = positions.get(e.target_id);
          if (!a || !b) return;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = dist / 100;
          const fx = (dx / dist) * force * e.weight;
          const fy = (dy / dist) * force * e.weight;
          a.vx += fx * 0.5; a.vy += fy * 0.5;
          b.vx -= fx * 0.5; b.vy -= fy * 0.5;
        });

        // Center attraction
        nodeArr.forEach((n) => {
          const pos = positions.get(n.id)!;
          pos.vx += (W / 2 - pos.x) * 0.005;
          pos.vy += (H / 2 - pos.y) * 0.005;
          pos.vx *= 0.85; pos.vy *= 0.85;
          pos.x = Math.max(20, Math.min(W - 20, pos.x + pos.vx));
          pos.y = Math.max(20, Math.min(H - 20, pos.y + pos.vy));
        });
        tick++;
      }

      // Draw edges
      ctx.globalAlpha = 0.3;
      edges.forEach((e) => {
        const a = posRef.current.get(e.source_id);
        const b = posRef.current.get(e.target_id);
        if (!a || !b) return;
        ctx.strokeStyle = "#635BFF";
        ctx.lineWidth = e.weight * 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Draw nodes
      nodes.forEach((n) => {
        const pos = posRef.current.get(n.id);
        if (!pos) return;
        const color = NODE_COLORS[n.type] || "#635BFF";
        const r = n.type === "Prediction" ? 10 : 7;
        const isHovered = hovered === n.id;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isHovered ? r + 3 : r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = isHovered ? 1 : 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (isHovered || r > 8) {
          ctx.font = "10px Inter, sans-serif";
          ctx.fillStyle = "rgba(248,248,252,0.8)";
          ctx.fillText(n.name.slice(0, 20), pos.x + r + 4, pos.y + 4);
        }
      });

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, hovered]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const node of nodes) {
      const pos = posRef.current.get(node.id);
      if (!pos) continue;
      const dx = mx - pos.x, dy = my - pos.y;
      if (dx * dx + dy * dy < 144) {
        onNodeSelect(node);
        return;
      }
    }
    onNodeSelect(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: string | null = null;
    for (const node of nodes) {
      const pos = posRef.current.get(node.id);
      if (!pos) continue;
      const dx = mx - pos.x, dy = my - pos.y;
      if (dx * dx + dy * dy < 144) { found = node.id; break; }
    }
    setHovered(found);
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    />
  );
}
```

**Step 2: Create graph/page.tsx**

```tsx
// frontend/app/graph/page.tsx
"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getGraphNodes, getGraphEdges, getGraphStats } from "@/lib/api";
import { Network, BarChart3 } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  Person: "#635BFF", Organization: "#10B981", Event: "#F59E0B",
  Location: "#60A5FA", Concept: "#A78BFA", Prediction: "#EC4899",
};

export default function GraphPage() {
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const { data: nodes = [] } = useQuery({ queryKey: ["graph-nodes"], queryFn: () => getGraphNodes() });
  const { data: edges = [] } = useQuery({ queryKey: ["graph-edges"], queryFn: () => getGraphEdges() });
  const { data: stats } = useQuery({ queryKey: ["graph-stats"], queryFn: () => getGraphStats() });

  return (
    <div className="h-[calc(100vh-56px)] flex overflow-hidden">
      {/* Graph canvas */}
      <div className="flex-1 relative bg-[#0a0a0f]">
        <GraphCanvas nodes={nodes} edges={edges} onNodeSelect={setSelected as (n: unknown) => void} />
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Badge variant="accent"><Network className="w-3 h-3 mr-1" />Knowledge Graph</Badge>
          <Badge variant="muted">{nodes.length} nodes · {edges.length} edges</Badge>
        </div>
      </div>

      {/* Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-[320px] flex-shrink-0 border-l border-border overflow-y-auto p-4 space-y-4"
      >
        {/* Legend */}
        <Card>
          <CardHeader><CardTitle>Node Types</CardTitle></CardHeader>
          <div className="space-y-1.5">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-text-secondary">{type}</span>
                {stats?.node_types?.[type] !== undefined && (
                  <span className="ml-auto text-xs font-mono text-text-muted">{stats.node_types[type]}</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Stats */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Graph Stats</CardTitle>
              <BarChart3 className="w-3.5 h-3.5 text-text-muted" />
            </CardHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total nodes</span>
                <span className="font-mono text-text-primary">{stats.node_count}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total edges</span>
                <span className="font-mono text-text-primary">{stats.edge_count}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Selected node */}
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card glow>
              <CardHeader><CardTitle>Selected Node</CardTitle></CardHeader>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Name</div>
                  <div className="text-sm font-medium">{selected.name as string}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Type</div>
                  <Badge variant="accent">{selected.type as string}</Badge>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">ID</div>
                  <div className="text-xs font-mono text-text-muted">{(selected.id as string).slice(0, 16)}...</div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {!selected && nodes.length === 0 && (
          <div className="text-center py-12">
            <Network className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-xs text-text-muted">Run a prediction to build the knowledge graph</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/
git commit -m "feat: add graph explorer page with force-directed canvas visualization"
```

---

## Task 15: Evidence Manager Page

**Files:**
- Create: `frontend/app/evidence/page.tsx`

```tsx
// frontend/app/evidence/page.tsx
"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { collectEvidence } from "@/lib/api";
import { FileSearch, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

const sourceColors: Record<string, string> = {
  arxiv: "#635BFF", hn: "#F59E0B", reddit: "#EF4444",
  web: "#10B981", newsapi: "#60A5FA", gnews: "#A78BFA",
};

export default function EvidencePage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{
    id: string; title: string; url: string; source: string;
    snippet: string; relevance_score: number; credibility_score: number;
    sentiment: number | null; entities: string[];
  }>>([]);
  const [loading, setLoading] = useState(false);

  const handleCollect = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await collectEvidence(query);
      setItems(result.items || []);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Evidence Manager</h1>
            <p className="text-sm text-text-secondary">Collect and browse evidence from all sources</p>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <div className="flex gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search query (e.g., 'AI regulation 2025')"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCollect()}
            />
            <Button onClick={handleCollect} loading={loading} disabled={!query.trim()}>
              Collect Evidence
            </Button>
          </div>
        </Card>

        {/* Items */}
        {items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-text-secondary">{items.length} items collected</span>
              <div className="flex gap-2">
                {["arxiv", "hn", "reddit", "web"].map((src) => {
                  const count = items.filter((i) => i.source === src).length;
                  if (!count) return null;
                  return (
                    <Badge key={src} style={{ background: `${sourceColors[src]}20`, color: sourceColors[src], borderColor: `${sourceColors[src]}30` }}>
                      {src}: {count}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="hover:border-border-strong transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge style={{ background: `${sourceColors[item.source] || "#635BFF"}20`, color: sourceColors[item.source] || "#635BFF", borderColor: `${sourceColors[item.source] || "#635BFF"}30` }}>
                          {item.source}
                        </Badge>
                        {item.entities.slice(0, 3).map((e) => (
                          <Badge key={e} variant="muted">{e}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.sentiment !== null && item.sentiment !== undefined && (
                          item.sentiment > 0.1
                            ? <TrendingUp className="w-3.5 h-3.5 text-success" />
                            : item.sentiment < -0.1
                            ? <TrendingDown className="w-3.5 h-3.5 text-danger" />
                            : <Minus className="w-3.5 h-3.5 text-text-muted" />
                        )}
                        <span className="text-xs font-mono text-accent">
                          {Math.round(item.relevance_score * 100)}% rel
                        </span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors" />
                        </a>
                      </div>
                    </div>
                    <h3 className="text-sm font-medium mb-1.5 line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-text-secondary line-clamp-2">{item.snippet}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="text-center py-20">
            <FileSearch className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-2">No evidence collected yet</p>
            <p className="text-xs text-text-muted">Enter a search query and click Collect Evidence</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/app/evidence/
git commit -m "feat: add evidence manager page"
```

---

## Task 16: History Page

**Files:**
- Create: `frontend/app/history/page.tsx`

```tsx
// frontend/app/history/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getPredictionHistory } from "@/lib/api";
import { formatDate, formatConfidence, getConfidenceColor } from "@/lib/utils";
import { History, Clock, TrendingUp } from "lucide-react";

export default function HistoryPage() {
  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: getPredictionHistory,
  });

  const grouped = predictions.reduce((acc: Record<string, typeof predictions>, p: (typeof predictions)[0]) => {
    const date = p.created_at?.split("T")[0] || p.created_at?.split(" ")[0] || "Unknown";
    if (!acc[date]) acc[date] = [];
    acc[date].push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <History className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prediction History</h1>
            <p className="text-sm text-text-secondary">{predictions.length} total predictions</p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && predictions.length === 0 && (
          <div className="text-center py-20">
            <History className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-2">No predictions yet</p>
            <p className="text-xs text-text-muted">Run your first prediction to see it here</p>
          </div>
        )}

        {Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, preds]) => (
            <motion.div key={date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-medium text-text-muted">{date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {(preds as Array<{ id: string; query: string; domain: string; status: string; confidence: number; headline: string; created_at: string }>).map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="hover:border-border-strong transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge variant={p.status === "complete" ? "success" : p.status === "failed" ? "danger" : "warning"}>
                              {p.status}
                            </Badge>
                            {p.domain && <Badge variant="muted">{p.domain}</Badge>}
                          </div>
                          <p className="text-sm font-medium line-clamp-1">{p.query}</p>
                          {p.headline && (
                            <p className="text-xs text-text-secondary mt-1 line-clamp-1">{p.headline}</p>
                          )}
                        </div>
                        {p.confidence != null && (
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" style={{ color: getConfidenceColor(p.confidence) }} />
                            <span className="text-sm font-bold font-mono" style={{ color: getConfidenceColor(p.confidence) }}>
                              {formatConfidence(p.confidence)}
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
      </motion.div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/app/history/
git commit -m "feat: add prediction history page"
```

---

## Task 17: Settings Page

**Files:**
- Create: `frontend/app/settings/page.tsx`

```tsx
// frontend/app/settings/page.tsx
"use client";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Settings, Key, Cpu, Sliders } from "lucide-react";

export default function SettingsPage() {
  const {
    agentCount, rounds, defaultDomain, defaultTimeHorizon,
    newsApiKey, gNewsApiKey, alphaVantageKey,
    setAgentCount, setRounds, setDefaultDomain, setDefaultTimeHorizon,
    setNewsApiKey, setGNewsApiKey, setAlphaVantageKey,
  } = useSettingsStore();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-text-secondary">Configure simulation defaults and API keys</p>
          </div>
        </div>

        {/* Simulation defaults */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Simulation Defaults</CardTitle>
            <Sliders className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">Agent count</span>
                <span className="text-xs font-mono text-text-primary">{agentCount}</span>
              </div>
              <input type="range" min={4} max={16} value={agentCount} onChange={(e) => setAgentCount(Number(e.target.value))} className="w-full accent-accent" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">Simulation rounds</span>
                <span className="text-xs font-mono text-text-primary">{rounds}</span>
              </div>
              <input type="range" min={2} max={10} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="w-full accent-accent" />
            </div>
          </div>
        </Card>

        {/* API Keys */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Premium Evidence Sources</CardTitle>
            <Key className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <p className="text-xs text-text-secondary mb-4">
            Keyless sources (ArXiv, HN, Reddit) work without any keys. Add premium keys to unlock additional evidence sources.
          </p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">NewsAPI</span>
                <Badge variant={newsApiKey ? "success" : "muted"}>{newsApiKey ? "Active" : "Not set"}</Badge>
              </div>
              <Input
                type="password"
                value={newsApiKey}
                onChange={(e) => setNewsApiKey(e.target.value)}
                placeholder="NEWS_API_KEY"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">GNews</span>
                <Badge variant={gNewsApiKey ? "success" : "muted"}>{gNewsApiKey ? "Active" : "Not set"}</Badge>
              </div>
              <Input
                type="password"
                value={gNewsApiKey}
                onChange={(e) => setGNewsApiKey(e.target.value)}
                placeholder="GNEWS_API_KEY"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">Alpha Vantage</span>
                <Badge variant={alphaVantageKey ? "success" : "muted"}>{alphaVantageKey ? "Active" : "Not set"}</Badge>
              </div>
              <Input
                type="password"
                value={alphaVantageKey}
                onChange={(e) => setAlphaVantageKey(e.target.value)}
                placeholder="ALPHA_VANTAGE_KEY"
              />
            </div>
          </div>
        </Card>

        {/* Model routing info */}
        <Card>
          <CardHeader>
            <CardTitle>Model Routing</CardTitle>
            <Cpu className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <div className="space-y-2">
            {[
              { tier: "fast", color: "#10B981", model: "glm-4-flash", tasks: "Personas, Simulation rounds" },
              { tier: "balanced", color: "#F59E0B", model: "glm-4-air", tasks: "Entity extraction, Evidence, Graph" },
              { tier: "premium", color: "#EF4444", model: "glm-4 / glm-4-plus", tasks: "Synthesis, Confidence, Sentiment" },
            ].map((r) => (
              <div key={r.tier} className="flex items-center gap-3 p-2 rounded-lg bg-white/2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <span className="text-xs font-mono text-text-primary w-32 flex-shrink-0">{r.model}</span>
                <span className="text-xs text-text-muted">{r.tasks}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add frontend/app/settings/
git commit -m "feat: add settings page with simulation defaults and API key management"
```

---

## Task 18: GitHub Setup + Push

**Step 1: Create GitHub repository**

```bash
cd /c/Users/saymyname/Projects/Strat
gh repo create predect --public --description "PREDECT — Swarm Intelligence Prediction Platform" --source=. --remote=origin
```

If repo exists, just add remote:
```bash
git remote add origin https://github.com/$(gh api user -q .login)/predect.git
```

**Step 2: Push to GitHub**

```bash
cd /c/Users/saymyname/Projects/Strat
git branch -M main
git push -u origin main
```

**Step 3: Verify**

```bash
gh repo view --web
```

---

## Task 19: Vercel Deployment

**Step 1: Install Vercel CLI and deploy**

```bash
cd /c/Users/saymyname/Projects/Strat/frontend
npm install -g vercel
```

**Step 2: Create Vercel project config**

Create `frontend/.env.production`:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

**Step 3: Deploy to Vercel**

```bash
cd /c/Users/saymyname/Projects/Strat/frontend
vercel --prod --yes
```

If prompted to configure project:
- Root Directory: `./` (we're already in frontend/)
- Framework: Next.js (auto-detected)
- Build Command: `npm run build`
- Output Directory: `.next`

**Step 4: Set environment variable on Vercel**

```bash
vercel env add NEXT_PUBLIC_API_URL production
# Enter: http://localhost:8000 (update when backend is deployed)
```

**Step 5: Verify deployment URL and commit**

```bash
cd /c/Users/saymyname/Projects/Strat
git add .
git commit -m "feat: add Vercel deployment configuration"
git push origin main
```

---

## Task 20: Backend Startup Script

**Files:**
- Create: `backend/start.sh`
- Create: `README.md` (minimal)

**Step 1: Create start.sh**

```bash
#!/bin/bash
# backend/start.sh
set -e
cd "$(dirname "$0")"
source venv/bin/activate || source venv/Scripts/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Step 2: Create minimal README.md**

```markdown
# PREDECT

Swarm Intelligence Prediction Platform. Feed it reality. It returns the future.

## Quick Start

### Backend
```bash
cd backend
python -m venv venv && source venv/Scripts/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # Add your ZAI_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000
```

**Step 3: Final commit and push**

```bash
cd /c/Users/saymyname/Projects/Strat
git add .
git commit -m "feat: complete PREDECT build — all phases done"
git push origin main
```
