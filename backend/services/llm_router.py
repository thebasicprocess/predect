import os
import json
import re
from openai import AsyncOpenAI
from typing import Optional

ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")
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


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=ZAI_API_KEY,
        base_url=ZAI_BASE_URL,
    )


def get_model_for_task(task: str) -> str:
    return TASK_MODEL_MAP.get(task, "glm-4.5-air")


def get_tier_for_task(task: str) -> str:
    return TASK_TIER.get(task, "balanced")


async def llm_call(
    task: str,
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
    client = get_client()
    model = get_model_for_task(task)

    kwargs = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
    }

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


async def llm_call_json(task: str, system_prompt: str, user_prompt: str) -> dict:
    raw = await llm_call(task, system_prompt, user_prompt, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
        if match:
            return json.loads(match.group(1))
        raise ValueError(f"Could not parse JSON from LLM response: {raw[:200]}")
