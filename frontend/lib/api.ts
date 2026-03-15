const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PredictRequest {
  query: string;
  domain?: string;
  time_horizon?: string;
  agent_count?: number;
  rounds?: number;
  collect_evidence?: boolean;
}

export interface SSEEvent {
  phase: string;
  step: number;
  totalSteps?: number;
  message: string;
  model?: string;
  task?: string;
  tokens?: number;
  data?: Record<string, unknown>;
}

export async function startPrediction(req: PredictRequest): Promise<{ prediction_id: string }> {
  const res = await fetch(`${API_URL}/api/predict/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to start prediction: ${res.statusText}`);
  return res.json();
}

export function streamPrediction(
  predictionId: string,
  onEvent: (e: SSEEvent) => void,
  onDone: () => void
): () => void {
  const es = new EventSource(`${API_URL}/api/predict/${predictionId}/stream`);

  es.onmessage = (e) => {
    if (e.data === "[DONE]") {
      es.close();
      onDone();
      return;
    }
    try {
      const event = JSON.parse(e.data) as SSEEvent;
      onEvent(event);
    } catch {}
  };

  es.onerror = () => {
    es.close();
    onDone();
  };

  return () => es.close();
}

export async function getPredictionResult(id: string) {
  const res = await fetch(`${API_URL}/api/predict/${id}/result`);
  if (!res.ok) throw new Error("Failed to get result");
  return res.json();
}

export async function getPredictionHistory() {
  const res = await fetch(`${API_URL}/api/predict/history`);
  if (!res.ok) return [];
  return res.json();
}

export async function collectEvidence(query: string, predictionId?: string) {
  const res = await fetch(`${API_URL}/api/evidence/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, prediction_id: predictionId, max_items: 20 }),
  });
  if (!res.ok) throw new Error("Evidence collection failed");
  return res.json();
}

export async function getGraphNodes(limit = 500) {
  const res = await fetch(`${API_URL}/api/graph/nodes?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGraphEdges(limit = 1000) {
  const res = await fetch(`${API_URL}/api/graph/edges?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGraphStats() {
  const res = await fetch(`${API_URL}/api/graph/stats`);
  if (!res.ok) return null;
  return res.json();
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
