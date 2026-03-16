from typing import List, Callable, Awaitable
from backend.models.prediction import (
    PredictionReport, Scenarios, ScenarioItem, TimelineItem, ConfidenceBand, PredictedEvent, NarrativeCamp
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
    on_event: Callable[[dict], Awaitable[None]] | None = None,
) -> tuple:
    """Returns (PredictionReport, total_tokens)."""
    all_claims = []
    for r in rounds:
        all_claims.extend(r.emergent_claims)

    all_beliefs = []
    for a in agents:
        all_beliefs.extend(a.beliefs[-4:])

    # Use up to 20 evidence items, include credibility and sentiment context
    evidence_summary = "\n".join([
        f"- [{item.source}] (rel:{round(item.relevance_score, 2)}, cred:{round(item.credibility_score or 0.5, 2)}) {item.title}: {item.snippet[:250]}"
        for item in evidence_items[:20]
    ])

    # Sort claims by frequency — recurring claims carry more weight
    claim_freq: dict[str, int] = {}
    for c in all_claims:
        claim_freq[c] = claim_freq.get(c, 0) + 1
    sorted_claims = sorted(claim_freq.keys(), key=lambda c: claim_freq[c], reverse=True)
    claims_summary = "\n".join([
        f"- [{claim_freq[c]}x] {c}" if claim_freq[c] > 1 else f"- {c}"
        for c in sorted_claims[:20]
    ])
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
    if on_event:
        await on_event({"phase": "analysis", "step": 5, "totalSteps": 6, "message": "Synthesizing prediction report...", "model": "glm-4.7", "task": "prediction_synthesis", "tokens": 0})
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
    if on_event:
        await on_event({"phase": "analysis", "step": 5, "totalSteps": 6, "message": "Predicting timeline events...", "model": "glm-4.7", "task": "prediction_synthesis", "tokens": tokens1})
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

    # Third call: narrative camp analysis using glm-5
    if on_event:
        await on_event({"phase": "analysis", "step": 5, "totalSteps": 6, "message": "Analyzing opinion landscape...", "model": "glm-5", "task": "public_opinion_analysis", "tokens": tokens2})
    all_claims_for_narrative = sorted_claims[:30]
    agent_names_roles = [f"{a.name} ({a.role})" for a in agents[:8]]
    narrative_camps: list[NarrativeCamp] = []
    tokens3 = 0
    if all_claims_for_narrative:
        try:
            narrative_result, tokens3 = await llm_call_json_with_usage(
                "public_opinion_analysis",
                system_prompt="You are an expert at identifying competing narratives and opinion camps. Analyze debate claims and cluster them into distinct narrative factions. Output valid JSON only.",
                user_prompt=f"""Query: {query}
Domain: {domain}

Emergent claims from agent simulation (ordered by frequency):
{chr(10).join(f"- {c}" for c in all_claims_for_narrative)}

Agent participants: {", ".join(agent_names_roles)}

Cluster these claims into 3-4 distinct narrative camps. Each camp represents a coherent viewpoint or faction that emerged from the debate.

Return JSON:
{{
  "camps": [
    {{
      "narrative": "Short label for this narrative camp (5-8 words)",
      "sentiment": 0.7,
      "support_count": 5,
      "supporting_claims": ["claim text 1", "claim text 2", "claim text 3"],
      "key_agents": ["Agent Name 1", "Agent Name 2"]
    }}
  ]
}}

Rules:
- sentiment: float -1 (very bearish/pessimistic) to +1 (very bullish/optimistic) relative to the query outcome
- support_count: number of claims that belong to this camp
- supporting_claims: 2-4 representative verbatim claims from the list above
- key_agents: 1-2 agent names from the participants list who represent this camp's view
- Order camps by support_count descending (most supported first)""",
            )
            for camp_data in narrative_result.get("camps", [])[:4]:
                narrative_camps.append(NarrativeCamp(
                    narrative=camp_data.get("narrative", ""),
                    sentiment=float(camp_data.get("sentiment", 0.0)),
                    support_count=int(camp_data.get("support_count", 0)),
                    supporting_claims=camp_data.get("supporting_claims", [])[:4],
                    key_agents=camp_data.get("key_agents", [])[:2],
                ))
        except Exception:
            pass  # narrative camps are optional enrichment

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
        narrativeCamps=narrative_camps,
    )
    return report, tokens1 + tokens2 + tokens3
