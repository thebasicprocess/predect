const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PredictRequest {
  query: string;
  domain?: string;
  time_horizon?: string;
  agent_count?: number;
  rounds?: number;
  collect_evidence?: boolean;
  news_api_key?: string | null;
  gnews_api_key?: string | null;
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

export async function getPredictionResultFull(id: string) {
  const res = await fetch(`${API_URL}/api/predict/${id}/result/full`);
  if (!res.ok) throw new Error("Failed to get full result");
  return res.json();
}

export async function getPredictionHistory() {
  const res = await fetch(`${API_URL}/api/predict/history`);
  if (!res.ok) return [];
  return res.json();
}

export async function deletePrediction(id: string) {
  const res = await fetch(`${API_URL}/api/predict/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete prediction");
  return res.json();
}

export async function collectEvidence(
  query: string,
  predictionId?: string,
  apiKeys?: { newsApiKey?: string; gNewsApiKey?: string; alphaVantageKey?: string }
) {
  const res = await fetch(`${API_URL}/api/evidence/collect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      prediction_id: predictionId,
      max_items: 20,
      news_api_key: apiKeys?.newsApiKey || null,
      gnews_api_key: apiKeys?.gNewsApiKey || null,
      alpha_vantage_key: apiKeys?.alphaVantageKey || null,
    }),
  });
  if (!res.ok) throw new Error("Evidence collection failed");
  return res.json();
}

export async function getGraphNodes(limit = 500, predictionId?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (predictionId) params.set("prediction_id", predictionId);
  const res = await fetch(`${API_URL}/api/graph/nodes?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGraphEdges(limit = 1000, predictionId?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (predictionId) params.set("prediction_id", predictionId);
  const res = await fetch(`${API_URL}/api/graph/edges?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGraphStats() {
  const res = await fetch(`${API_URL}/api/graph/stats`);
  if (!res.ok) return null;
  return res.json();
}

export async function getNodePredictions(nodeId: string): Promise<Array<{
  id: string;
  query: string;
  domain: string | null;
  time_horizon: string | null;
  status: string;
  confidence: number | null;
  headline: string | null;
  created_at: string;
}>> {
  const res = await fetch(`${API_URL}/api/graph/node/${nodeId}/predictions`);
  if (!res.ok) return [];
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

export async function getPredictStats() {
  try {
    const res = await fetch(`${API_URL}/api/predict/stats`);
    if (!res.ok) return null;
    return res.json() as Promise<{
      total_predictions: number;
      completed_predictions: number;
      avg_confidence: number | null;
      domains: Record<string, number>;
      total_graph_nodes: number;
      total_graph_edges: number;
    }>;
  } catch {
    return null;
  }
}
