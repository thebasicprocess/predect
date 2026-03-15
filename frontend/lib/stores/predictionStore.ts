import { create } from "zustand";

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

export interface PredictionState {
  predictionId: string | null;
  status: "idle" | "running" | "complete" | "error";
  events: SSEEvent[];
  result: Record<string, unknown> | null;
  progress: number;
  currentPhase: string;
  agents: unknown[];
  roundEvents: unknown[];
  error: string | null;

  setPredictionId: (id: string) => void;
  setStatus: (s: PredictionState["status"]) => void;
  addEvent: (e: SSEEvent) => void;
  setResult: (r: Record<string, unknown>) => void;
  reset: () => void;
}

export const usePredictionStore = create<PredictionState>((set) => ({
  predictionId: null,
  status: "idle",
  events: [],
  result: null,
  progress: 0,
  currentPhase: "",
  agents: [],
  roundEvents: [],
  error: null,

  setPredictionId: (id) => set({ predictionId: id }),
  setStatus: (status) => set({ status }),
  addEvent: (e) =>
    set((state) => ({
      events: [...state.events, e],
      progress: e.totalSteps
        ? Math.round((e.step / e.totalSteps) * 100)
        : state.progress,
      currentPhase: e.phase,
      agents:
        e.phase === "agents" && e.data?.agents
          ? (e.data.agents as unknown[])
          : state.agents,
      roundEvents:
        e.phase === "simulation" && e.data
          ? [...state.roundEvents, e.data]
          : state.roundEvents,
    })),
  setResult: (result) => set({ result, status: "complete" }),
  reset: () =>
    set({
      predictionId: null,
      status: "idle",
      events: [],
      result: null,
      progress: 0,
      currentPhase: "",
      agents: [],
      roundEvents: [],
      error: null,
    }),
}));
