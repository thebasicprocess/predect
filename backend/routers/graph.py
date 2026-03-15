import json
from fastapi import APIRouter
from backend.services.graph_service import get_all_nodes, get_all_edges, get_graph_stats
from backend.db.database import get_connection

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
    return {
        "id": row["id"],
        "type": row["type"],
        "name": row["name"],
        "properties": json.loads(row["properties"] or "{}"),
        "created_at": row["created_at"],
    }


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
