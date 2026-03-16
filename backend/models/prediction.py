from pydantic import BaseModel
from typing import Optional, List


class ScenarioItem(BaseModel):
    description: str
    probability: float


class Scenarios(BaseModel):
    base: ScenarioItem
    bull: ScenarioItem
    bear: ScenarioItem


class TimelineItem(BaseModel):
    period: str
    outlook: str


class PredictedEvent(BaseModel):
    period: str
    event: str
    probability: float
    category: str = "general"


class ConfidenceBand(BaseModel):
    score: float
    band: List[float]
    color: str


class NarrativeCamp(BaseModel):
    narrative: str
    sentiment: float = 0.0  # -1 bearish to +1 bullish
    support_count: int = 0
    supporting_claims: List[str] = []
    key_agents: List[str] = []


class PredictionReport(BaseModel):
    headline: str
    verdict: str
    confidence: ConfidenceBand
    scenarios: Scenarios
    keyDrivers: List[str]
    riskFactors: List[str]
    timelineOutlook: List[TimelineItem]
    agentConsensus: float
    dominantNarratives: List[str]
    predictedEvents: List[PredictedEvent] = []
    narrativeCamps: List[NarrativeCamp] = []


class PredictRequest(BaseModel):
    query: str
    domain: Optional[str] = "general"
    time_horizon: Optional[str] = "6 months"
    agent_count: Optional[int] = 8
    rounds: Optional[int] = 5
    collect_evidence: Optional[bool] = True
    news_api_key: Optional[str] = None
    gnews_api_key: Optional[str] = None


class PredictionRecord(BaseModel):
    id: str
    query: str
    domain: Optional[str]
    time_horizon: Optional[str]
    status: str
    confidence: Optional[float]
    result: Optional[PredictionReport]
    created_at: str
