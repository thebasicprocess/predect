import asyncio
import os
import json
import re
from openai import AsyncOpenAI
from typing import Optional, Tuple

ZAI_BASE_URL = os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4/")

TASK_MODEL_MAP = {
    "persona_generation": "glm-4.5-air",
    "simulation_round": "glm-4.5-air",
    "quick_query": "glm-4.5-air",
    "entity_extraction": "glm-4.5",
    "graph_construction": "glm-4.5",
    "evidence_summarization": "glm-4.5",
    "prediction_synthesis": "glm-4.7",
    "financial_analysis": "glm-4.7",
    "confidence_scoring": "glm-4.7",
    "public_opinion_analysis": "glm-5",
    "creative_prediction": "glm-5",
}

TASK_TIER = {
    "persona_generation": "fast",
    "simulation_round": "fast",
    "quick_query": "fast",
    "entity_extraction": "balanced",
    "graph_construction": "balanced",
    "evidence_summarization": "balanced",
    "prediction_synthesis": "premium",
    "financial_analysis": "premium",
    "confidence_scoring": "premium",
    "public_opinion_analysis": "premium",
    "creative_prediction": "premium",
}

# Lower temperature = more deterministic / calibrated.
# Creative/diverse tasks use higher temps; structured JSON tasks use lower.
TASK_TEMPERATURE: dict[str, float] = {
    "persona_generation": 0.85,       # diversity of personas
    "simulation_round": 0.75,         # varied debates
    "quick_query": 0.5,
    "entity_extraction": 0.2,         # deterministic JSON extraction
    "graph_construction": 0.2,        # deterministic JSON
    "evidence_summarization": 0.2,    # scoring should be stable
    "prediction_synthesis": 0.45,     # calibrated, factual output
    "financial_analysis": 0.4,
    "confidence_scoring": 0.3,        # confidence needs to be stable
    "public_opinion_analysis": 0.5,
    "creative_prediction": 0.8,
}


_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=os.getenv("ZAI_API_KEY", ""),
            base_url=os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4/"),
        )
    return _client


def get_model_for_task(task: str) -> str:
    return TASK_MODEL_MAP.get(task, "glm-4.5-air")


def get_tier_for_task(task: str) -> str:
    return TASK_TIER.get(task, "balanced")


def get_temperature_for_task(task: str) -> float:
    return TASK_TEMPERATURE.get(task, 0.7)


async def llm_call_with_usage(
    task: str,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
    temperature: float | None = None,
) -> Tuple[str, int]:
    """Returns (content, total_tokens)."""
    client = get_client()
    model = get_model_for_task(task)
    temp = temperature if temperature is not None else get_temperature_for_task(task)

    kwargs = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temp,
    }

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    last_err = None
    for attempt in range(3):
        try:
            response = await client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content or ""
            tokens = response.usage.total_tokens if response.usage else 0
            if content.strip():
                return content, tokens
            if attempt < 2:
                await asyncio.sleep(1)
        except Exception as e:
            last_err = e
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
    if last_err:
        raise last_err
    raise ValueError(f"LLM returned empty content after 3 attempts for task={task}")


async def llm_call(
    task: str,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
    temperature: float | None = None,
) -> str:
    content, _ = await llm_call_with_usage(task, system_prompt, user_prompt, json_mode, temperature)
    return content


def _repair_json(raw: str) -> str:
    """Strip common LLM JSON artifacts: trailing commas, BOM, control chars."""
    # Remove trailing commas before ] or }
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    # Remove BOM
    raw = raw.lstrip("\ufeff")
    return raw


def _extract_json(raw: str) -> dict:
    """Try multiple strategies to extract a JSON object from raw text."""
    candidates = []
    # 1. Raw response
    candidates.append(raw)
    # 2. Markdown code block
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
    if match:
        candidates.append(match.group(1))
    # 3. First {...} block (handles "Here is the JSON: {...}")
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        candidates.append(match.group(0))

    for candidate in candidates:
        for text in (candidate, _repair_json(candidate)):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass
    raise ValueError(f"Could not parse JSON from LLM response: {raw[:300]}")


async def llm_call_json(task: str, system_prompt: str, user_prompt: str) -> dict:
    raw = await llm_call(task, system_prompt, user_prompt, json_mode=True)
    return _extract_json(raw)


async def llm_call_json_with_usage(task: str, system_prompt: str, user_prompt: str, temperature: float | None = None) -> Tuple[dict, int]:
    """Returns (parsed_dict, total_tokens)."""
    raw, tokens = await llm_call_with_usage(task, system_prompt, user_prompt, json_mode=True, temperature=temperature)
    return _extract_json(raw), tokens
