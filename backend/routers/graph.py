import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from backend.services.graph_service import get_all_nodes, get_all_edges, get_graph_stats, get_nodes_for_prediction, get_edges_for_prediction
from backend.db.database import get_connection

router = APIRouter()


@router.get("/nodes")
async def nodes(limit: int = 500, prediction_id: Optional[str] = None):
    if prediction_id:
        return [n.model_dump() for n in get_nodes_for_prediction(prediction_id, limit)]
    return [n.model_dump() for n in get_all_nodes(limit)]


@router.get("/edges")
async def edges(limit: int = 1000, prediction_id: Optional[str] = None):
    if prediction_id:
        return [e.model_dump() for e in get_edges_for_prediction(prediction_id, limit)]
    return [e.model_dump() for e in get_all_edges(limit)]


@router.get("/node/{node_id}")
async def get_node(node_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Node not found")
    return {
        "id": row["id"],
        "type": row["type"],
        "name": row["name"],
        "properties": json.loads(row["properties"] or "{}"),
        "created_at": row["created_at"],
    }


@router.get("/node/{node_id}/predictions")
async def node_predictions(node_id: str):
    """Return the predictions that reference this node, ordered most recent first."""
    conn = get_connection()
    rows = conn.execute(
        """SELECT p.id, p.query, p.domain, p.time_horizon, p.status, p.confidence, p.created_at,
                  p.result
           FROM predictions p
           JOIN prediction_node_map m ON p.id = m.prediction_id
           WHERE m.node_id = ?
           ORDER BY p.created_at DESC
           LIMIT 20""",
        (node_id,),
    ).fetchall()
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
