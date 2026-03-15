from fastapi import APIRouter
from backend.services.llm_router import TASK_MODEL_MAP, TASK_TIER, get_model_for_task
from backend.db.database import get_connection

router = APIRouter()


@router.post("/plan")
async def plan(body: dict):
    task = body.get("task", "quick_query")
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
