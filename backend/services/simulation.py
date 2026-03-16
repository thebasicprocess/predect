import asyncio
import random
from typing import List, Callable, Awaitable
from backend.models.simulation import AgentPersona, RoundEvent
from backend.models.evidence import EvidenceItem
from backend.services.llm_router import llm_call_json_with_usage


async def generate_personas(
    topic: str,
    evidence_items: List[EvidenceItem],
    count: int = 8,
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

    result, tokens = await llm_call_json_with_usage(
        "persona_generation",
        system_prompt="You are a simulation designer creating diverse agent personas for a prediction simulation. Ground agent beliefs in the provided evidence.",
        user_prompt=f"""Topic: {topic}
Key entities from evidence: {entity_str}

Recent evidence headlines:
{evidence_headlines}

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
) -> tuple:
    """Run a single pair interaction; returns (RoundEvent, result_dict, tokens)."""
    result, tokens = await llm_call_json_with_usage(
        "simulation_round",
        system_prompt="You are simulating a conversation between two agents analyzing a prediction topic.",
        user_prompt=f"""Round {round_num}. Topic: {topic}

Agent 1: {agent1.name} ({agent1.role})
Beliefs: {'; '.join(agent1.beliefs[:3])}
Bias: {agent1.behavioral_bias}

Agent 2: {agent2.name} ({agent2.role})
Beliefs: {'; '.join(agent2.beliefs[:3])}
Bias: {agent2.behavioral_bias}

Generate their interaction and belief updates. Write the agent statements as direct first-person quotes — natural, specific, and grounded in their beliefs and bias.

Return JSON: {{
  "interaction_summary": "2-3 sentence summary of the debate",
  "agent1_statement": "Direct quote from Agent 1 making their key point (1-2 sentences, first person)",
  "agent2_statement": "Direct quote from Agent 2 responding with their view (1-2 sentences, first person)",
  "emergent_claims": ["claim1", "claim2"],
  "agent1_belief_update": "new belief to add",
  "agent2_belief_update": "new belief to add"
}}"""
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
    )
    return event, result, tokens


async def run_simulation_round(
    round_num: int,
    agents: List[AgentPersona],
    topic: str,
    on_event: Callable[[dict], Awaitable[None]] = None,
) -> tuple:
    shuffled = agents[:]
    random.shuffle(shuffled)
    pairs = [(shuffled[i], shuffled[i+1]) for i in range(0, len(shuffled)-1, 2)]

    updated_agents = {a.id: a for a in agents}

    # Run all pairs in this round in parallel
    pair_results = await asyncio.gather(
        *[_run_pair(round_num, a1, a2, topic) for a1, a2 in pairs],
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
) -> tuple:
    agents, persona_tokens = await generate_personas(topic, evidence_items, agent_count)

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
    for r in range(1, rounds + 1):
        round_events, agents = await run_simulation_round(r, agents, topic, on_event)
        all_rounds.extend(round_events)

    return agents, all_rounds
