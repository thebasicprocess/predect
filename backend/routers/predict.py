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
        # Step 0: Query refinement — make vague questions specific and falsifiable
        working_query = request.query
        try:
            refine_result, _ = await llm_call_json_with_usage(
                "quick_query",
                system_prompt="You are a prediction analyst. Reframe vague questions into specific, falsifiable predictions. Preserve the original intent.",
                user_prompt=f"""Query: {request.query}
Domain: {request.domain}
Time Horizon: {request.time_horizon}

Reframe this as a specific, measurable prediction if it's vague. If it's already specific, return it unchanged.
Do NOT change the substance — only add specificity (e.g., add a threshold, metric, entity name, or percentage).

Return JSON: {{"refined_query": "...", "was_refined": true/false}}""",
            )
            refined = refine_result.get("refined_query", "").strip()
            was_refined = refine_result.get("was_refined", False)
            if refined and was_refined and len(refined) > 20:
                working_query = refined
                await emit({
                    "phase": "evidence",
                    "step": 1,
                    "totalSteps": 6,
                    "message": f"Query refined: {refined[:120]}",
                    "model": "glm-4.5-air",
                    "task": "quick_query",
                    "data": {"refined_query": refined, "original_query": request.query},
                })
        except Exception:
            pass  # refinement is optional — use original query on failure

        await emit({"phase": "evidence", "step": 1, "totalSteps": 6, "message": "Collecting evidence...", "model": "glm-4.5", "task": "evidence_summarization"})

        evidence_items = []
        if request.collect_evidence:
            evidence_items = await collect_evidence(
                working_query,
                max_items=20,
                news_api_key=request.news_api_key or None,
                gnews_api_key=request.gnews_api_key or None,
                alpha_vantage_key=request.alpha_vantage_key or None,
                domain=request.domain or "general",
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

        pred_node = get_or_create_node("Prediction", working_query[:100])
        register_node_for_prediction(prediction_id, pred_node.id)

        # Collect raw entities from evidence
        entity_names = set()
        for item in evidence_items:
            for entity in item.entities[:5]:
                entity_names.add(entity)

        entity_list = list(entity_names)[:35]

        # Use LLM to classify entities into typed nodes with relationships
        graph_result = {"entities": []}
        if entity_list:
            try:
                domain_type_hint = {
                    "finance": "In finance/markets: policy decisions/rate changes/earnings = Event; companies/banks/funds = Organization; price movements/metrics = Concept",
                    "technology": "In tech: product launches/releases = Event; companies/platforms = Organization; technologies/frameworks/protocols = Concept",
                    "politics": "In politics: elections/votes/treaties = Event; parties/governments/agencies = Organization; policies/ideologies = Concept",
                    "science": "In science: studies/trials/discoveries = Event; institutions/journals = Organization; theories/methods/diseases = Concept",
                    "crypto": "In crypto: protocol upgrades/hacks/launches = Event; exchanges/DAOs/projects = Organization; tokens/chains/metrics = Concept",
                    "climate": "In climate: extreme weather events/summits = Event; agencies/NGOs/companies = Organization; emissions metrics/technologies = Concept",
                }.get(request.domain or "general", "Use best judgement for entity classification")
                graph_result, _ = await llm_call_json_with_usage(
                    "graph_construction",
                    system_prompt="You are a knowledge graph builder. Classify entities into precise typed nodes and identify relationships. Prefer specific types over generic Concept. Output valid JSON only.",
                    user_prompt=f"""Query: {working_query}
Domain: {request.domain or "general"}
Entities found in evidence: {', '.join(entity_list)}

Domain classification hint: {domain_type_hint}

Classify each entity precisely and identify key relationships.

Return JSON:
{{
  "entities": [
    {{"name": "Entity Name", "type": "Person|Organization|Event|Location|Concept", "relationship_to_query": "INVOLVES|AFFECTS|CAUSES|MENTIONS|RELATES_TO"}}
  ],
  "entity_edges": [
    {{"source": "Entity A", "target": "Entity B", "relationship": "AFFILIATED_WITH|CAUSES|SUPPORTS|OPPOSES|LOCATED_IN|PART_OF|REGULATES|COMPETES_WITH"}}
  ]
}}

Types: Person (named individual), Organization (company/gov/group/party), Event (specific incident/decision/release), Location (place/region/country), Concept (metric/trend/idea/technology)
Prefer Event for specific dated occurrences, Organization for named groups, Person for named individuals.""",
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
            topic=working_query,
            evidence_items=evidence_items,
            agent_count=request.agent_count or 8,
            rounds=request.rounds or 5,
            on_event=emit,
            domain=request.domain or "general",
        )

        with conn:
            conn.execute(
                "UPDATE simulations SET agents = ?, rounds = ?, status = ? WHERE id = ?",
                (json.dumps([a.model_dump() for a in agents]), json.dumps([r.model_dump() for r in rounds]), "complete", sim_id),
            )

        # Enrich graph with agent nodes and debate edges
        try:
            agent_node_map: dict = {}
            for agent in agents:
                agent_node = get_or_create_node("Agent", agent.name[:80])
                register_node_for_prediction(prediction_id, agent_node.id)
                create_edge(agent_node.id, pred_node.id, "ANALYZES", weight=0.7)
                agent_node_map[agent.name] = agent_node.id

            # Count how many times each pair debated; stronger pair = higher edge weight
            debate_counts: dict[tuple[str, str], int] = {}
            for ev in rounds:
                key = tuple(sorted([ev.agent1_name, ev.agent2_name]))
                debate_counts[key] = debate_counts.get(key, 0) + 1  # type: ignore[arg-type]
            for (n1, n2), count in debate_counts.items():
                if n1 in agent_node_map and n2 in agent_node_map:
                    create_edge(agent_node_map[n1], agent_node_map[n2], "DEBATED", weight=round(min(count / 5, 1.0), 2))
        except Exception as _ae:
            logger.warning("Agent graph enrichment failed: %s", _ae)

        await emit({"phase": "analysis", "step": 5, "totalSteps": 6, "message": "Synthesizing prediction...", "model": "glm-4.7", "task": "prediction_synthesis"})

        report, synthesis_tokens = await generate_report(
            query=working_query,
            domain=request.domain or "general",
            time_horizon=request.time_horizon or "6 months",
            evidence_items=evidence_items,
            agents=agents,
            rounds=rounds,
            on_event=emit,
        )

        # Enrich graph with prediction report insights
        try:
            for driver in report.keyDrivers[:5]:
                if driver:
                    d_node = get_or_create_node("KeyDriver", driver[:100])
                    register_node_for_prediction(prediction_id, d_node.id)
                    create_edge(pred_node.id, d_node.id, "DRIVEN_BY", weight=0.9)
            for risk in report.riskFactors[:4]:
                if risk:
                    r_node = get_or_create_node("RiskFactor", risk[:100])
                    register_node_for_prediction(prediction_id, r_node.id)
                    create_edge(pred_node.id, r_node.id, "RISKS", weight=0.85)
            for camp in (report.narrativeCamps or [])[:4]:
                if camp.narrative:
                    n_node = get_or_create_node("Narrative", camp.narrative[:100])
                    register_node_for_prediction(prediction_id, n_node.id)
                    create_edge(pred_node.id, n_node.id, "NARRATIVE", weight=round(max(0.1, camp.support_count / 10), 2))
        except Exception as _ge:
            logger.warning("Graph enrichment failed: %s", _ge)

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
