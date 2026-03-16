import json
import uuid
import asyncio
import logging
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from backend.models.prediction import PredictRequest, PredictionRecord
from backend.db.database import get_connection
from backend.services.evidence_collector import collect_evidence
from backend.services.simulation import run_full_simulation
from backend.services.report_generator import generate_report
from backend.services.graph_service import get_or_create_node, create_edge, register_node_for_prediction
from backend.services.llm_router import llm_call_json_with_usage

router = APIRouter()

_sse_queues: dict = {}


async def run_pipeline(prediction_id: str, request: PredictRequest):
    queue = _sse_queues.get(prediction_id)

    async def emit(event: dict):
        if queue:
            await queue.put(json.dumps(event))

    conn = get_connection()

    try:
        await emit({"phase": "evidence", "step": 1, "totalSteps": 6, "message": "Collecting evidence...", "model": "glm-4.5", "task": "evidence_summarization"})

        evidence_items = []
        if request.collect_evidence:
            evidence_items = await collect_evidence(
                request.query,
                max_items=15,
                news_api_key=request.news_api_key or None,
                gnews_api_key=request.gnews_api_key or None,
            )

        evidence_id = str(uuid.uuid4())
        with conn:
            conn.execute(
                "INSERT INTO evidence_bundles (id, prediction_id, query, items) VALUES (?, ?, ?, ?)",
                (evidence_id, prediction_id, request.query, json.dumps([e.model_dump() for e in evidence_items])),
            )

        await emit({
            "phase": "evidence",
            "step": 1,
            "totalSteps": 6,
            "message": f"Collected {len(evidence_items)} evidence items",
            "data": {
                "count": len(evidence_items),
                "items": [
                    {
                        "id": str(i),
                        "title": e.title,
                        "source": e.source,
                        "relevance_score": e.relevance_score,
                        "credibility_score": e.credibility_score,
                        "sentiment": e.sentiment,
                        "entities": e.entities or [],
                        "url": e.url,
                        "snippet": e.snippet[:300] if e.snippet else "",
                        "published_at": e.published_at,
                    }
                    for i, e in enumerate(evidence_items)
                ]
            }
        })

        await emit({"phase": "graph", "step": 2, "totalSteps": 6, "message": "Building knowledge graph...", "model": "glm-4.5", "task": "graph_construction"})

        pred_node = get_or_create_node("Prediction", request.query[:100])
        register_node_for_prediction(prediction_id, pred_node.id)

        # Collect raw entities from evidence
        entity_names = set()
        for item in evidence_items:
            for entity in item.entities[:3]:
                entity_names.add(entity)

        entity_list = list(entity_names)[:25]

        # Use LLM to classify entities into typed nodes with relationships
        graph_result = {"entities": []}
        if entity_list:
            try:
                graph_result, _ = await llm_call_json_with_usage(
                    "graph_construction",
                    system_prompt="You are a knowledge graph builder. Classify entities into typed nodes and identify relationships. Output valid JSON only.",
                    user_prompt=f"""Query: {request.query}
Entities found in evidence: {', '.join(entity_list)}

Classify each entity and identify relationships between them.

Return JSON:
{{
  "entities": [
    {{"name": "Entity Name", "type": "Person|Organization|Event|Location|Concept", "relationship_to_query": "INVOLVES|AFFECTS|CAUSES|MENTIONS|RELATES_TO"}}
  ],
  "entity_edges": [
    {{"source": "Entity A", "target": "Entity B", "relationship": "AFFILIATED_WITH|CAUSES|SUPPORTS|OPPOSES|LOCATED_IN|PART_OF"}}
  ]
}}

Types: Person (named individual), Organization (company/gov/group), Event (incident/happening), Location (place/region), Concept (idea/term/trend)""",
                )
            except Exception:
                graph_result = {"entities": [{"name": e, "type": "Concept", "relationship_to_query": "RELATES_TO"} for e in entity_list]}

        classified = graph_result.get("entities", [])
        entity_edges = graph_result.get("entity_edges", [])

        # Fallback if LLM returned nothing
        if not classified:
            classified = [{"name": e, "type": "Concept", "relationship_to_query": "RELATES_TO"} for e in entity_list]

        # Create entity nodes
        node_name_map: dict = {}
        for entry in classified[:20]:
            name = entry.get("name", "")
            etype = entry.get("type", "Concept")
            rel = entry.get("relationship_to_query", "RELATES_TO")
            if not name:
                continue
            if etype not in ("Person", "Organization", "Event", "Location", "Concept", "Prediction"):
                etype = "Concept"
            entity_node = get_or_create_node(etype, name)
            register_node_for_prediction(prediction_id, entity_node.id)
            create_edge(pred_node.id, entity_node.id, rel, weight=0.8)
            node_name_map[name] = entity_node.id

        # Create entity-to-entity edges
        for ee in entity_edges[:15]:
            src_name = ee.get("source", "")
            tgt_name = ee.get("target", "")
            rel = ee.get("relationship", "RELATES_TO")
            if src_name in node_name_map and tgt_name in node_name_map:
                try:
                    create_edge(node_name_map[src_name], node_name_map[tgt_name], rel, weight=0.6)
                except Exception:
                    pass

        await emit({"phase": "graph", "step": 2, "totalSteps": 6, "message": f"Graph built with {len(classified)} classified entities", "model": "glm-4.5", "task": "graph_construction"})

        await emit({"phase": "agents", "step": 3, "totalSteps": 6, "message": "Generating agent personas...", "model": "glm-4.5-air", "task": "persona_generation"})

        sim_id = str(uuid.uuid4())
        with conn:
            conn.execute(
                "INSERT INTO simulations (id, prediction_id, agents, rounds, status) VALUES (?, ?, ?, ?, ?)",
                (sim_id, prediction_id, "[]", "[]", "running"),
            )

        agents, rounds = await run_full_simulation(
            topic=request.query,
            evidence_items=evidence_items,
            agent_count=request.agent_count or 8,
            rounds=request.rounds or 5,
            on_event=emit,
        )

        with conn:
            conn.execute(
                "UPDATE simulations SET agents = ?, rounds = ?, status = ? WHERE id = ?",
                (json.dumps([a.model_dump() for a in agents]), json.dumps([r.model_dump() for r in rounds]), "complete", sim_id),
            )

        await emit({"phase": "analysis", "step": 5, "totalSteps": 6, "message": "Synthesizing prediction...", "model": "glm-4.7", "task": "prediction_synthesis"})

        report, synthesis_tokens = await generate_report(
            query=request.query,
            domain=request.domain or "general",
            time_horizon=request.time_horizon or "6 months",
            evidence_items=evidence_items,
            agents=agents,
            rounds=rounds,
        )

        await emit({
            "phase": "report",
            "step": 6,
            "totalSteps": 6,
            "message": "Prediction complete!",
            "model": "glm-4.7",
            "task": "prediction_synthesis",
            "tokens": synthesis_tokens,
            "data": report.model_dump(),
        })

        with conn:
            conn.execute(
                "UPDATE predictions SET status = ?, confidence = ?, result = ? WHERE id = ?",
                ("complete", report.confidence.score, json.dumps(report.model_dump()), prediction_id),
            )

    except Exception as e:
        import traceback
        logger.error(f"Pipeline failed for {prediction_id}: {e}\n{traceback.format_exc()}")
        print(f"[PIPELINE ERROR] {prediction_id}: {e}\n{traceback.format_exc()}", flush=True)
        await emit({"phase": "error", "step": -1, "message": str(e)})
        with conn:
            conn.execute("UPDATE predictions SET status = ? WHERE id = ?", ("failed", prediction_id))

    finally:
        conn.close()
        if queue:
            await queue.put("[DONE]")


@router.post("/run")
async def run_prediction(request: PredictRequest):
    prediction_id = str(uuid.uuid4())
    conn = get_connection()
    with conn:
        conn.execute(
            "INSERT INTO predictions (id, query, domain, time_horizon, status) VALUES (?, ?, ?, ?, ?)",
            (prediction_id, request.query, request.domain, request.time_horizon, "running"),
        )
    conn.close()

    queue = asyncio.Queue()
    _sse_queues[prediction_id] = queue
    asyncio.create_task(run_pipeline(prediction_id, request))

    return {"prediction_id": prediction_id, "status": "running"}


@router.get("/{prediction_id}/stream")
async def stream_prediction(request: Request, prediction_id: str):
    if prediction_id not in _sse_queues:
        conn = get_connection()
        row = conn.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        conn.close()
        if row and row["status"] == "complete":
            async def done_gen():
                yield {"data": "[DONE]"}
            return EventSourceResponse(done_gen())

    queue = _sse_queues.get(prediction_id)

    async def event_generator():
        if not queue:
            yield {"data": "[DONE]"}
            return

        while True:
            if await request.is_disconnected():
                _sse_queues.pop(prediction_id, None)
                break
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30)
            except asyncio.TimeoutError:
                yield {"data": "ping"}
                continue
            if msg == "[DONE]":
                yield {"data": "[DONE]"}
                _sse_queues.pop(prediction_id, None)
                break
            yield {"data": msg}

    return EventSourceResponse(event_generator())


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


@router.get("/stats")
async def get_stats():
    conn = get_connection()
    try:
        def safe_count(query: str, params: tuple = ()) -> int:
            try:
                row = conn.execute(query, params).fetchone()
                return row[0] if row and row[0] is not None else 0
            except Exception:
                return 0

        total_predictions = safe_count("SELECT COUNT(*) FROM predictions")
        completed_predictions = safe_count(
            "SELECT COUNT(*) FROM predictions WHERE status = 'complete'"
        )

        avg_confidence: float | None = None
        try:
            row = conn.execute(
                "SELECT AVG(confidence) FROM predictions WHERE status = 'complete' AND confidence IS NOT NULL"
            ).fetchone()
            if row and row[0] is not None:
                avg_confidence = round(float(row[0]), 4)
        except Exception:
            pass

        domains: dict = {}
        try:
            rows = conn.execute(
                "SELECT domain, COUNT(*) FROM predictions"
                " WHERE status = 'complete' AND domain IS NOT NULL"
                " GROUP BY domain"
            ).fetchall()
            domains = {row[0]: row[1] for row in rows}
        except Exception:
            pass

        total_graph_nodes = safe_count("SELECT COUNT(*) FROM nodes")
        total_graph_edges = safe_count("SELECT COUNT(*) FROM edges")

        return {
            "total_predictions": total_predictions,
            "completed_predictions": completed_predictions,
            "avg_confidence": avg_confidence,
            "domains": domains,
            "total_graph_nodes": total_graph_nodes,
            "total_graph_edges": total_graph_edges,
        }
    finally:
        conn.close()


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


@router.get("/{prediction_id}/result/full")
async def get_result_full(prediction_id: str):
    """Returns the full prediction data including agents, round events, and evidence items."""
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        if not row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Prediction not found")

        result = json.loads(row["result"]) if row["result"] else None

        # Load simulation data (agents + rounds)
        sim_row = conn.execute(
            "SELECT * FROM simulations WHERE prediction_id = ? ORDER BY created_at DESC LIMIT 1",
            (prediction_id,)
        ).fetchone()
        agents = json.loads(sim_row["agents"]) if sim_row and sim_row["agents"] else []
        rounds = json.loads(sim_row["rounds"]) if sim_row and sim_row["rounds"] else []

        # Load evidence items
        ev_row = conn.execute(
            "SELECT * FROM evidence_bundles WHERE prediction_id = ? ORDER BY created_at DESC LIMIT 1",
            (prediction_id,)
        ).fetchone()
        evidence = json.loads(ev_row["items"]) if ev_row and ev_row["items"] else []

        return {
            "id": row["id"],
            "query": row["query"],
            "domain": row["domain"],
            "time_horizon": row["time_horizon"],
            "status": row["status"],
            "confidence": row["confidence"],
            "result": result,
            "created_at": row["created_at"],
            "agents": agents,
            "rounds": rounds,
            "evidence": evidence,
        }
    finally:
        conn.close()


@router.delete("/{prediction_id}")
async def delete_prediction(prediction_id: str):
    """Delete a prediction and all related data."""
    conn = get_connection()
    try:
        row = conn.execute("SELECT id FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        if not row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Prediction not found")
        conn.execute("DELETE FROM simulations WHERE prediction_id = ?", (prediction_id,))
        conn.execute("DELETE FROM evidence_bundles WHERE prediction_id = ?", (prediction_id,))
        conn.execute("DELETE FROM prediction_node_map WHERE prediction_id = ?", (prediction_id,))
        conn.execute("DELETE FROM predictions WHERE id = ?", (prediction_id,))
        conn.commit()
        return {"deleted": prediction_id}
    finally:
        conn.close()
