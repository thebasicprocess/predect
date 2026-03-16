from typing import List
from backend.models.prediction import (
    PredictionReport, Scenarios, ScenarioItem, TimelineItem, ConfidenceBand, PredictedEvent
)
from backend.models.evidence import EvidenceItem
from backend.models.simulation import AgentPersona, RoundEvent
from backend.services.llm_router import llm_call_json_with_usage


def _timeline_periods(time_horizon: str) -> list[str]:
    """Return timeline periods calibrated to the requested time horizon."""
    h = time_horizon.lower().strip()
    if "week" in h:
        return ["2 days", "5 days", "1 week"]
    if h == "1 month":
        return ["1 week", "2 weeks", "1 month"]
    if "3 month" in h:
        return ["2 weeks", "1 month", "3 months"]
    if "6 month" in h:
        return ["1 month", "3 months", "6 months"]
    if "1 year" in h:
        return ["3 months", "6 months", "1 year"]
    # 2+ years
    return ["6 months", "1 year", "2 years"]


def _event_periods(time_horizon: str) -> list[str]:
    """Return 5 predicted event periods calibrated to the requested time horizon."""
    h = time_horizon.lower().strip()
    if "week" in h:
        return ["1 day", "3 days", "5 days", "1 week", "2 weeks"]
    if h == "1 month":
        return ["3 days", "1 week", "2 weeks", "3 weeks", "1 month"]
    if "3 month" in h:
        return ["1 week", "2 weeks", "1 month", "2 months", "3 months"]
    if "6 month" in h:
        return ["2 weeks", "1 month", "2 months", "4 months", "6 months"]
    if "1 year" in h:
        return ["1 month", "3 months", "6 months", "9 months", "1 year"]
    # 2+ years
    return ["3 months", "6 months", "1 year", "18 months", "2 years"]


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

    tl_periods = _timeline_periods(time_horizon)
    ev_periods = _event_periods(time_horizon)
    tl_example = ",\n    ".join(
        [f'{{"period": "{p}", "outlook": "description"}}' for p in tl_periods]
    )
    ev_example = ",\n    ".join([
        f'{{"period": "{p}", "event": "Specific measurable event", "probability": {round(0.75 - i * 0.08, 2)}, "category": "market"}}'
        for i, p in enumerate(ev_periods)
    ])

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
    {tl_example}
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
    {ev_example}
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
