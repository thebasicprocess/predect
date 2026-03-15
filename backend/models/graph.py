from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class Node(BaseModel):
    id: str
    type: str
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
