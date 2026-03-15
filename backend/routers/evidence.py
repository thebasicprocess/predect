import json
import uuid
from fastapi import APIRouter
from backend.models.evidence import CollectRequest
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
