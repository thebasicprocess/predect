from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class AgentPersona(BaseModel):
    id: str
    name: str
    role: str
    beliefs: List[str]
    memory: List[str] = []
    behavioral_bias: str


class RoundEvent(BaseModel):
    round: int
    agent1_id: str
    agent2_id: str
    agent1_name: str
    agent2_name: str
    interaction_summary: str
    emergent_claims: List[str]
    belief_shifts: Dict[str, Any] = {}
    agent1_statement: Optional[str] = None
    agent2_statement: Optional[str] = None


class SimulationState(BaseModel):
    id: str
    prediction_id: Optional[str]
    agents: List[AgentPersona]
    rounds: List[RoundEvent] = []
    status: str = "pending"
    created_at: Optional[str] = None
