from pydantic import BaseModel
from typing import Optional, List


class EvidenceItem(BaseModel):
    id: str
    title: str
    url: str
    source: str
    snippet: str
    full_text: Optional[str] = None
    relevance_score: float = 0.0
    credibility_score: float = 0.5
    sentiment: Optional[float] = None
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
