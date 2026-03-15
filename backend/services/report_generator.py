from typing import List
from backend.models.prediction import (
    PredictionReport, Scenarios, ScenarioItem, TimelineItem, ConfidenceBand
)
from backend.models.evidence import EvidenceItem
from backend.models.simulation import AgentPersona, RoundEvent
from backend.services.llm_router import llm_call_json


async def generate_report(
    query: str,
    domain: str,
    time_horizon: str,
    evidence_items: List[EvidenceItem],
    agents: List[AgentPersona],
    rounds: List[RoundEvent],
) -> PredictionReport:
    all_claims = []
    for r in rounds:
        all_claims.extend(r.emergent_claims)

    all_beliefs = []
    for a in agents:
        all_beliefs.extend(a.beliefs[-2:])

    evidence_summary = "\n".join([
        f"- [{item.source}] {item.title}: {item.snippet[:200]}"
        for item in evidence_items[:10]
    ])

    claims_summary = "\n".join([f"- {c}" for c in set(all_claims[:20])])
    beliefs_summary = "\n".join([f"- {b}" for b in set(all_beliefs[:20])])

    agent_consensus = min(0.9, len(set(all_claims)) / max(len(all_claims), 1))

    result = await llm_call_json(
        "prediction_synthesis",
        system_prompt="""You are a world-class analyst synthesizing evidence and simulation data into a structured prediction report.
Be specific, data-driven, and calibrated. Output valid JSON only.""",
        user_prompt=f"""Query: {query}
Domain: {domain}
Time Horizon: {time_horizon}

Evidence Summary:
{evidence_summary}

Simulation Emergent Claims:
{claims_summary}

Agent Final Beliefs:
{beliefs_summary}

Generate a comprehensive prediction report as JSON:
{{
  "headline": "Bold 1-sentence prediction headline",
  "verdict": "2-3 sentence verdict with specific details",
  "confidence_score": 0.0,
  "confidence_color": "#hex",
  "scenarios": {{
    "base": {{"description": "Most likely scenario (2-3 sentences)", "probability": 0.5}},
    "bull": {{"description": "Optimistic scenario (2-3 sentences)", "probability": 0.25}},
    "bear": {{"description": "Pessimistic scenario (2-3 sentences)", "probability": 0.25}}
  }},
  "keyDrivers": ["driver1", "driver2", "driver3", "driver4"],
  "riskFactors": ["risk1", "risk2", "risk3"],
  "timelineOutlook": [
    {{"period": "1 month", "outlook": "description"}},
    {{"period": "3 months", "outlook": "description"}},
    {{"period": "6 months", "outlook": "description"}}
  ],
  "dominantNarratives": ["narrative1", "narrative2", "narrative3"]
}}"""
    )

    score = float(result.get("confidence_score", 0.65))
    band_low = max(0.0, score - 0.15)
    band_high = min(1.0, score + 0.15)
    color = result.get("confidence_color", "#635BFF")

    scenarios_data = result.get("scenarios", {})

    return PredictionReport(
        headline=result.get("headline", f"Prediction for: {query}"),
        verdict=result.get("verdict", "Analysis complete."),
        confidence=ConfidenceBand(score=score, band=[band_low, band_high], color=color),
        scenarios=Scenarios(
            base=ScenarioItem(**scenarios_data.get("base", {"description": "Base case", "probability": 0.5})),
            bull=ScenarioItem(**scenarios_data.get("bull", {"description": "Bull case", "probability": 0.25})),
            bear=ScenarioItem(**scenarios_data.get("bear", {"description": "Bear case", "probability": 0.25})),
        ),
        keyDrivers=result.get("keyDrivers", []),
        riskFactors=result.get("riskFactors", []),
        timelineOutlook=[TimelineItem(**t) for t in result.get("timelineOutlook", [])],
        agentConsensus=agent_consensus,
        dominantNarratives=result.get("dominantNarratives", []),
    )
