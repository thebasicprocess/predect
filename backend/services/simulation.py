import asyncio
import random
from typing import List, Callable, Awaitable
from backend.models.simulation import AgentPersona, RoundEvent
from backend.models.evidence import EvidenceItem
from backend.services.llm_router import llm_call_json_with_usage

DOMAIN_DEBATE_HINTS: dict = {
    "finance": "Reference specific financial metrics: price targets, P/E ratios, yield spreads, earnings growth rates, GDP forecasts. Cite central bank policy, macro trends, and sector flows.",
    "technology": "Reference adoption curves, benchmark performance, developer ecosystem size, API pricing, regulatory timelines. Cite specific product launches or technical limitations.",
    "politics": "Reference polling averages, electoral history, legislative vote counts, approval ratings. Cite specific policy positions, coalitions, and historical precedents.",
    "science": "Reference study sample sizes, confidence intervals, replication rates, funding levels. Cite specific journals, clinical trial phases, or peer review status.",
    "sports": "Reference win rates, player statistics, injury reports, salary caps, coaching records. Cite head-to-head matchup history and current form.",
    "crypto": "Reference on-chain metrics, TVL, trading volumes, network hash rates, regulatory filings. Cite specific protocol upgrades or security audits.",
    "climate": "Reference temperature anomalies, CO2 ppm levels, IPCC scenario ranges, renewable capacity additions. Cite specific policy mechanisms and carbon pricing.",
    "general": "Reference specific data points, historical precedents, and causal mechanisms. Avoid vague assertions.",
}

DOMAIN_PERSONA_HINTS: dict = {
    "finance": "Include personas such as: hedge fund manager, retail investor, central bank analyst, macro economist, bearish short-seller, fintech entrepreneur, pension fund manager.",
    "technology": "Include personas such as: software engineer, venture capitalist, AI researcher, tech policy regulator, enterprise CTO, open-source maintainer, tech journalist.",
    "politics": "Include personas such as: political analyst, policy advisor, grassroots activist, foreign policy expert, investigative journalist, opposition leader, diplomat.",
    "science": "Include personas such as: research scientist, science communicator, ethics board member, industry R&D lead, government science advisor, skeptic researcher.",
    "sports": "Include personas such as: sports analyst, athlete, team coach, sports economist, fan advocate, sports journalist, data scientist.",
    "crypto": "Include personas such as: DeFi developer, crypto trader, blockchain skeptic, institutional crypto analyst, regulatory lawyer, NFT creator, HODLer.",
    "climate": "Include personas such as: climate scientist, environmental activist, fossil fuel industry rep, green tech entrepreneur, policy economist, IPCC analyst.",
    "general": "Make agents diverse: domain experts, skeptics, optimists, insiders, public voices, international perspectives.",
}


async def generate_personas(
    topic: str,
    evidence_items: List[EvidenceItem],
    count: int = 8,
    domain: str = "general",
) -> tuple:
    """Returns (agents, tokens)."""
    entities = []
    for item in evidence_items[:10]:
        entities.extend(item.entities[:3])
    entity_str = ", ".join(set(entities[:20])) if entities else "various stakeholders"

    # Include top evidence headlines to ground agent beliefs in real sources
    evidence_headlines = "\n".join([
        f"- [{item.source}] {item.title}" for item in evidence_items[:8]
    ]) if evidence_items else "No specific evidence available."

    domain_hint = DOMAIN_PERSONA_HINTS.get(domain, DOMAIN_PERSONA_HINTS["general"])

    # Derive required archetypes from count (always include contrarian + enthusiast pair)
    half = max(1, count // 2)
    archetype_hint = (
        f"REQUIRED diversity — your {count} agents MUST include:\n"
        f"- At least 1 strong contrarian/skeptic who argues AGAINST the mainstream view\n"
        f"- At least 1 committed enthusiast/bull who argues FOR the primary outcome\n"
        f"- At least 1 domain expert or insider with specific technical knowledge\n"
        f"- At least 1 international/outsider perspective\n"
        f"- Remaining {max(0, count - 4)} agents: diverse stakeholders, affected parties, or analysts"
    )

    result, tokens = await llm_call_json_with_usage(
        "persona_generation",
        system_prompt="You are a simulation designer creating adversarial agent personas for a prediction debate. Diversity of opinion is critical — avoid groupthink. Ground beliefs in provided evidence.",
        user_prompt=f"""Topic: {topic}
Key entities from evidence: {entity_str}

Recent evidence headlines:
{evidence_headlines}

Domain context: {domain_hint}

{archetype_hint}

Generate {count} agent personas with meaningfully different viewpoints that will generate productive debate.

Return JSON: {{"agents": [{{"id": "agent_1", "name": "string", "role": "string", "beliefs": ["specific belief grounded in evidence1", "belief2", "belief3"], "behavioral_bias": "optimistic|pessimistic|contrarian|cautious|data-driven|ideological|pragmatic"}}]}}

Each agent needs 3 beliefs that directly reference evidence above. Contrarian agents should hold genuinely opposing views, not strawmen."""
    )

    agents = []
    for i, a in enumerate(result.get("agents", [])[:count]):
        agents.append(AgentPersona(
            id=a.get("id", f"agent_{i}"),
            name=a.get("name", f"Agent {i}"),
            role=a.get("role", "Analyst"),
            beliefs=a.get("beliefs", []),
            behavioral_bias=a.get("behavioral_bias", "neutral"),
        ))
    return agents, tokens


async def _run_pair(
    round_num: int,
    agent1: AgentPersona,
    agent2: AgentPersona,
    topic: str,
    prior_claims: list[str] | None = None,
    evidence_snippets: list[str] | None = None,
    domain: str = "general",
) -> tuple:
    """Run a single pair interaction; returns (RoundEvent, result_dict, tokens)."""
    prior_context = ""
    if prior_claims and round_num > 1:
        top_claims = prior_claims[:6]
        claims_label = "Key recurring claims (MUST react to at least one of these):" if round_num <= 2 else "Still-contested claims (focus on resolving these, don't repeat settled points):"
        prior_context = f"\n{claims_label}\n" + "\n".join(f"- {c}" for c in top_claims) + "\n"
        if round_num >= 3:
            prior_context += "\nThis is a late round — dig deeper, challenge assumptions, and move beyond surface-level disagreements.\n"

    # Round 1: inject key evidence snippets so agents can cite concrete data
    evidence_context = ""
    if evidence_snippets and round_num == 1:
        evidence_context = "\nKey evidence (cite these in arguments):\n" + "\n".join(f"- {s}" for s in evidence_snippets[:5]) + "\n"

    # Show the most recent 3 beliefs so evolved thinking carries through rounds
    a1_beliefs = agent1.beliefs[-3:] if agent1.beliefs else agent1.beliefs
    a2_beliefs = agent2.beliefs[-3:] if agent2.beliefs else agent2.beliefs

    domain_hint = DOMAIN_DEBATE_HINTS.get(domain, DOMAIN_DEBATE_HINTS["general"])
    # Later rounds use lower temperature: encourages analytical depth over creative variance
    round_temp = max(0.4, 0.75 - (round_num - 1) * 0.07)
    result, tokens = await llm_call_json_with_usage(
        "simulation_round",
        system_prompt=f"You are simulating a debate between expert agents analyzing a prediction topic. Make statements specific, grounded in mechanisms and data, not vague assertions. {domain_hint}",
        temperature=round_temp,
        user_prompt=f"""Round {round_num}. Topic: {topic}
{prior_context}{evidence_context}
Agent 1: {agent1.name} ({agent1.role})
Current beliefs: {'; '.join(a1_beliefs)}
Bias: {agent1.behavioral_bias}

Agent 2: {agent2.name} ({agent2.role})
Current beliefs: {'; '.join(a2_beliefs)}
Bias: {agent2.behavioral_bias}

Simulate their debate. Statements must be specific and grounded in mechanisms, data, or causal logic — not vague assertions. If prior claims exist, agents must react to them specifically.

Return JSON: {{
  "interaction_summary": "2-3 sentence summary",
  "key_disagreement": "Core point of contention in one sentence",
  "agent1_statement": "Direct first-person quote from Agent 1 making a specific, mechanistic argument (1-2 sentences)",
  "agent2_statement": "Direct first-person quote from Agent 2 responding with a specific counterpoint (1-2 sentences)",
  "emergent_claims": ["Specific falsifiable claim 1", "Specific falsifiable claim 2"],
  "agent1_belief_update": "new concrete belief grounded in this exchange",
  "agent2_belief_update": "new concrete belief grounded in this exchange",
  "agent1_conviction_change": 0.0,
  "agent2_conviction_change": 0.0
}}

agent1_conviction_change and agent2_conviction_change must be floats from -0.3 to 0.3 (positive = more confident after the exchange, negative = less confident)."""
    )
    event = RoundEvent(
        round=round_num,
        agent1_id=agent1.id,
        agent2_id=agent2.id,
        agent1_name=agent1.name,
        agent2_name=agent2.name,
        interaction_summary=result.get("interaction_summary", ""),
        emergent_claims=result.get("emergent_claims", []),
        agent1_statement=result.get("agent1_statement") or None,
        agent2_statement=result.get("agent2_statement") or None,
        key_disagreement=result.get("key_disagreement") or None,
        belief_shifts={
            agent1.id: result.get("agent1_conviction_change", 0.0),
            agent2.id: result.get("agent2_conviction_change", 0.0),
        },
    )
    return event, result, tokens


async def run_simulation_round(
    round_num: int,
    agents: List[AgentPersona],
    topic: str,
    on_event: Callable[[dict], Awaitable[None]] = None,
    prior_claims: list[str] | None = None,
    evidence_snippets: list[str] | None = None,
    domain: str = "general",
) -> tuple:
    shuffled = agents[:]
    random.shuffle(shuffled)
    # If odd number of agents, pair the leftover with a random earlier agent
    if len(shuffled) % 2 == 1:
        partner = random.choice(shuffled[:-1])
        shuffled.append(partner)
    pairs = [(shuffled[i], shuffled[i+1]) for i in range(0, len(shuffled)-1, 2)]

    updated_agents = {a.id: a for a in agents}

    # Run all pairs in this round in parallel, sharing prior round context
    pair_results = await asyncio.gather(
        *[_run_pair(round_num, a1, a2, topic, prior_claims, evidence_snippets, domain) for a1, a2 in pairs],
        return_exceptions=True,
    )

    events = []
    for (agent1, agent2), outcome in zip(pairs, pair_results):
        if isinstance(outcome, Exception):
            continue  # skip failed pairs

        event, result, tokens = outcome
        events.append(event)

        if result.get("agent1_belief_update"):
            updated_agents[agent1.id].beliefs.append(result["agent1_belief_update"])
            updated_agents[agent1.id].memory.append(f"R{round_num}: {result['agent1_belief_update']}")
        if result.get("agent2_belief_update"):
            updated_agents[agent2.id].beliefs.append(result["agent2_belief_update"])
            updated_agents[agent2.id].memory.append(f"R{round_num}: {result['agent2_belief_update']}")

        if on_event:
            await on_event({
                "phase": "simulation",
                "step": 4,
                "totalSteps": 6,
                "message": f"Round {round_num}: {agent1.name} × {agent2.name}",
                "model": "glm-4.5-air",
                "task": "simulation_round",
                "tokens": tokens,
                "data": event.model_dump(),
            })

    return events, list(updated_agents.values())


async def run_full_simulation(
    topic: str,
    evidence_items: List[EvidenceItem],
    agent_count: int = 8,
    rounds: int = 5,
    on_event: Callable[[dict], Awaitable[None]] = None,
    domain: str = "general",
) -> tuple:
    agents, persona_tokens = await generate_personas(topic, evidence_items, agent_count, domain)

    if on_event:
        await on_event({
            "phase": "agents",
            "step": 3,
            "totalSteps": 6,
            "message": f"Generated {len(agents)} agent personas",
            "model": "glm-4.5-air",
            "task": "persona_generation",
            "tokens": persona_tokens,
            "data": {"agents": [a.model_dump() for a in agents]},
        })

    # Prepare compact evidence snippets for round 1 context injection
    ev_snippets: list[str] = []
    for item in sorted(evidence_items[:10], key=lambda x: x.relevance_score, reverse=True)[:5]:
        snippet = (item.snippet or "")[:200].strip()
        if snippet:
            ev_snippets.append(f"[{item.source}] {item.title}: {snippet}")

    all_rounds = []
    claim_freq: dict[str, int] = {}  # track how often each claim recurs across rounds
    for r in range(1, rounds + 1):
        # Pass top-8 claims sorted by frequency so agents address the most contested topics
        top_prior_claims: list[str] | None = None
        if claim_freq:
            top_prior_claims = sorted(claim_freq.keys(), key=lambda c: claim_freq[c], reverse=True)[:8]
        round_events, agents = await run_simulation_round(
            r, agents, topic, on_event,
            prior_claims=top_prior_claims,
            evidence_snippets=ev_snippets if r == 1 else None,
            domain=domain,
        )
        all_rounds.extend(round_events)
        # Track claim frequency across all rounds (count duplicates)
        for ev in round_events:
            for claim in ev.emergent_claims:
                claim_freq[claim] = claim_freq.get(claim, 0) + 1

    # Emit final agent state so frontend has updated beliefs from all simulation rounds
    if on_event:
        await on_event({
            "phase": "agents_final",
            "step": 4,
            "totalSteps": 6,
            "message": f"Simulation complete — agents updated",
            "model": "glm-4.5-air",
            "task": "simulation_round",
            "data": {"agents": [a.model_dump() for a in agents]},
        })

    return agents, all_rounds
