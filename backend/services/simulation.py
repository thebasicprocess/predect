import asyncio
import random
from typing import List, Callable, Awaitable
from backend.models.simulation import AgentPersona, RoundEvent
from backend.models.evidence import EvidenceItem
from backend.services.llm_router import llm_call_json_with_usage

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

    result, tokens = await llm_call_json_with_usage(
        "persona_generation",
        system_prompt="You are a simulation designer creating diverse agent personas for a prediction simulation. Ground agent beliefs in the provided evidence.",
        user_prompt=f"""Topic: {topic}
Key entities from evidence: {entity_str}

Recent evidence headlines:
{evidence_headlines}

Domain context: {domain_hint}

Generate {count} diverse agent personas. Each should represent a different perspective, background, or stakeholder type related to the topic. Ground their beliefs in the evidence provided.

Return JSON: {{"agents": [{{"id": "agent_1", "name": "string", "role": "string", "beliefs": ["specific belief grounded in evidence1", "belief2", "belief3"], "behavioral_bias": "string"}}]}}

Make agents diverse: experts, skeptics, optimists, domain insiders, public voices, international perspectives. Each agent should have 3 specific beliefs referencing real aspects of the topic."""
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
) -> tuple:
    """Run a single pair interaction; returns (RoundEvent, result_dict, tokens)."""
    prior_context = ""
    if prior_claims and round_num > 1:
        top_claims = prior_claims[:6]
        prior_context = f"\nClaims that emerged in prior rounds:\n" + "\n".join(f"- {c}" for c in top_claims) + "\n"

    # Show the most recent 3 beliefs so evolved thinking carries through rounds
    a1_beliefs = agent1.beliefs[-3:] if agent1.beliefs else agent1.beliefs
    a2_beliefs = agent2.beliefs[-3:] if agent2.beliefs else agent2.beliefs

    result, tokens = await llm_call_json_with_usage(
        "simulation_round",
        system_prompt="You are simulating a debate between expert agents analyzing a prediction topic. Make statements specific, grounded in mechanisms and data, not vague assertions.",
        user_prompt=f"""Round {round_num}. Topic: {topic}
{prior_context}
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
        *[_run_pair(round_num, a1, a2, topic, prior_claims) for a1, a2 in pairs],
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

    all_rounds = []
    accumulated_claims: list[str] = []
    for r in range(1, rounds + 1):
        round_events, agents = await run_simulation_round(
            r, agents, topic, on_event,
            prior_claims=accumulated_claims[-8:] if accumulated_claims else None,
        )
        all_rounds.extend(round_events)
        # Accumulate unique emergent claims for the next round's context
        for ev in round_events:
            for claim in ev.emergent_claims:
                if claim not in accumulated_claims:
                    accumulated_claims.append(claim)

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
