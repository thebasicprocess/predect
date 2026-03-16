from typing import List
from backend.models.prediction import (
    PredictionReport, Scenarios, ScenarioItem, TimelineItem, ConfidenceBand, PredictedEvent
)
from backend.models.evidence import EvidenceItem
from backend.models.simulation import AgentPersona, RoundEvent
from backend.services.llm_router import llm_call_json_with_usage


async def generate_report(
    query: str,
    domain: str,
    time_horizon: str,
    evidence_items: List[EvidenceItem],
    agents: List[AgentPersona],
    rounds: List[RoundEvent],
) -> tuple:
    """Returns (PredictionReport, total_tokens)."""
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

    # Consensus = 1 - uniqueness. If all claims repeat (agents agree), consensus is high.
    # If every claim is unique (divergent views), consensus is low.
    uniqueness = len(set(all_claims)) / max(len(all_claims), 1)
    agent_consensus = round(max(0.05, 1.0 - uniqueness), 3)

    # First call: main report (no predictedEvents — kept separate to avoid LLM ignoring it)
    result, tokens1 = await llm_call_json_with_usage(
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

    # Second call: dedicated predicted events (wrapped in object for reliable json_mode)
    headline = result.get("headline", f"Prediction for: {query}")
    events_result, tokens2 = await llm_call_json_with_usage(
        "prediction_synthesis",
        system_prompt="You are a prediction specialist. Output valid JSON only.",
        user_prompt=f"""Based on this prediction, generate 5 concrete predicted events.

Query: {query}
Domain: {domain}
Time Horizon: {time_horizon}
Headline: {headline}

Return JSON in this exact format:
{{
  "events": [
    {{"period": "1 month", "event": "Specific measurable event", "probability": 0.78, "category": "market"}},
    {{"period": "2 months", "event": "Another concrete event", "probability": 0.65, "category": "technical"}},
    {{"period": "3 months", "event": "Mid-term milestone", "probability": 0.55, "category": "regulatory"}},
    {{"period": "6 months", "event": "Longer term development", "probability": 0.45, "category": "political"}},
    {{"period": "12 months", "event": "Long-range outcome", "probability": 0.35, "category": "social"}}
  ]
}}

category must be one of: market, regulatory, technical, political, social""",
    )
    events_data = events_result.get("events", [])

    score = float(result.get("confidence_score", 0.65))
    score = max(0.0, min(1.0, score))
    band_low = max(0.0, score - 0.15)
    band_high = min(1.0, score + 0.15)
    # Derive color from score — do not trust LLM to return correct hex
    if score >= 0.7:
        color = "#10B981"  # green
    elif score >= 0.45:
        color = "#F59E0B"  # amber
    else:
        color = "#EF4444"  # red

    scenarios_data = result.get("scenarios", {})

    report = PredictionReport(
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
        predictedEvents=[PredictedEvent(**e) for e in events_data],
    )
    return report, tokens1 + tokens2
