import json
import uuid
from typing import List
from backend.db.database import get_connection
from backend.models.graph import Node, Edge, GraphStats


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
    # Insert and re-fetch to get the canonical ID even under concurrent access
    node_id = str(uuid.uuid4())
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO nodes (id, type, name, properties) VALUES (?, ?, ?, ?)",
            (node_id, type, name, "{}"),
        )
    row = conn.execute(
        "SELECT * FROM nodes WHERE name = ? AND type = ?", (name, type)
    ).fetchone()
    conn.close()
    if row:
        return Node(
            id=row["id"],
            type=row["type"],
            name=row["name"],
            properties=json.loads(row["properties"] or "{}"),
            created_at=row["created_at"],
        )
    return Node(id=node_id, type=type, name=name)


def create_edge(source_id: str, target_id: str, relationship: str, weight: float = 1.0) -> Edge:
    conn = get_connection()
    edge_id = str(uuid.uuid4())
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO edges (id, source_id, target_id, relationship, weight) VALUES (?, ?, ?, ?, ?)",
            (edge_id, source_id, target_id, relationship, weight),
        )
    row = conn.execute(
        "SELECT * FROM edges WHERE source_id = ? AND target_id = ? AND relationship = ?",
        (source_id, target_id, relationship),
    ).fetchone()
    conn.close()
    if row:
        return Edge(
            id=row["id"],
            source_id=row["source_id"],
            target_id=row["target_id"],
            relationship=row["relationship"],
            weight=row["weight"],
            properties=json.loads(row["properties"] or "{}"),
            created_at=row["created_at"],
        )
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


def register_node_for_prediction(prediction_id: str, node_id: str) -> None:
    conn = get_connection()
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO prediction_node_map (prediction_id, node_id) VALUES (?, ?)",
            (prediction_id, node_id),
        )
    conn.close()


def get_nodes_for_prediction(prediction_id: str, limit: int = 500) -> List[Node]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT n.* FROM nodes n
           JOIN prediction_node_map m ON n.id = m.node_id
           WHERE m.prediction_id = ?
           ORDER BY n.created_at DESC LIMIT ?""",
        (prediction_id, limit),
    ).fetchall()
    conn.close()
    return [Node(id=r["id"], type=r["type"], name=r["name"], properties=json.loads(r["properties"] or "{}"), created_at=r["created_at"]) for r in rows]


def get_edges_for_prediction(prediction_id: str, limit: int = 1000) -> List[Edge]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT e.* FROM edges e
           JOIN prediction_node_map m1 ON e.source_id = m1.node_id AND m1.prediction_id = ?
           JOIN prediction_node_map m2 ON e.target_id = m2.node_id AND m2.prediction_id = ?
           ORDER BY e.created_at DESC LIMIT ?""",
        (prediction_id, prediction_id, limit),
    ).fetchall()
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
