import json
import uuid
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.models.prediction import PredictRequest, PredictionRecord
from backend.db.database import get_connection
from backend.services.evidence_collector import collect_evidence
from backend.services.simulation import run_full_simulation
from backend.services.report_generator import generate_report
from backend.services.graph_service import get_or_create_node, create_edge

router = APIRouter()

_sse_queues: dict = {}


async def run_pipeline(prediction_id: str, request: PredictRequest):
    queue = _sse_queues.get(prediction_id)

    async def emit(event: dict):
        if queue:
            await queue.put(json.dumps(event))

    conn = get_connection()

    try:
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

        await emit({"phase": "graph", "step": 2, "totalSteps": 6, "message": "Building knowledge graph...", "model": "glm-4-air", "task": "graph_construction"})

        pred_node = get_or_create_node("Prediction", request.query[:100])

        entity_names = set()
        for item in evidence_items:
            for entity in item.entities[:3]:
                entity_names.add(entity)

        for entity in list(entity_names)[:20]:
            entity_node = get_or_create_node("Concept", entity)
            create_edge(pred_node.id, entity_node.id, "RELATES_TO", weight=0.8)

        await emit({"phase": "graph", "step": 2, "totalSteps": 6, "message": f"Graph updated with {len(entity_names)} entities"})

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
            agent_count=request.agent_count or 8,
            rounds=request.rounds or 5,
            on_event=emit,
        )

        with conn:
            conn.execute(
                "UPDATE simulations SET agents = ?, rounds = ?, status = ? WHERE id = ?",
                (json.dumps([a.model_dump() for a in agents]), json.dumps([r.model_dump() for r in rounds]), "complete", sim_id),
            )

        await emit({"phase": "analysis", "step": 5, "totalSteps": 6, "message": "Synthesizing prediction...", "model": "glm-4", "task": "prediction_synthesis"})

        report = await generate_report(
            query=request.query,
            domain=request.domain or "general",
            time_horizon=request.time_horizon or "6 months",
            evidence_items=evidence_items,
            agents=agents,
            rounds=rounds,
        )

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
async def stream_prediction(prediction_id: str):
    if prediction_id not in _sse_queues:
        conn = get_connection()
        row = conn.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        conn.close()
        if row and row["status"] == "complete":
            async def done_gen():
                yield "data: [DONE]\n\n"
            return StreamingResponse(done_gen(), media_type="text/event-stream")

    queue = _sse_queues.get(prediction_id)

    async def event_generator():
        if not queue:
            yield "data: [DONE]\n\n"
            return

        while True:
            msg = await queue.get()
            if msg == "[DONE]":
                yield "data: [DONE]\n\n"
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
