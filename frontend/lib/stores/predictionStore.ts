import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

export interface EvidenceItem {
  id?: string;
  title: string;
  source: string;
  relevance_score: number;
  credibility_score: number;
  sentiment?: number | null;
  entities?: string[];
  url: string;
  snippet?: string;
  published_at?: string;
}

export interface RoundEvent {
  round: number;
  agent1_name: string;
  agent2_name: string;
  interaction_summary: string;
  emergent_claims: string[];
  agent1_statement?: string;
  agent2_statement?: string;
}

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  behavioral_bias: string;
  beliefs: string[];
}

// Snapshot of a session stored in history
export interface PredictionSession {
  sessionId: string;
  query: string;
  domain: string;
  timeHorizon: string;
  status: "idle" | "running" | "complete" | "error";
  predictionId: string | null;
  events: SSEEvent[];
  result: Record<string, unknown> | null;
  progress: number;
  currentPhase: string;
  agents: AgentPersona[];
  roundEvents: RoundEvent[];
  evidence: EvidenceItem[];
  error: string | null;
  createdAt: number;
}

// Re-export for backward compat
export type PredictionState = PredictionSession;

const MAX_SESSIONS = 5;

function makeSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const blankSession = (): Omit<PredictionSession, "sessionId" | "createdAt"> => ({
  query: "",
  domain: "",
  timeHorizon: "",
  predictionId: null,
  status: "idle",
  events: [],
  result: null,
  progress: 0,
  currentPhase: "",
  agents: [],
  roundEvents: [],
  evidence: [],
  error: null,
});

interface PredictionStoreState {
  // ── Active session flat state (backward compat) ──
  predictionId: string | null;
  status: "idle" | "running" | "complete" | "error";
  events: SSEEvent[];
  result: Record<string, unknown> | null;
  progress: number;
  currentPhase: string;
  agents: AgentPersona[];
  roundEvents: RoundEvent[];
  evidence: EvidenceItem[];
  error: string | null;
  query: string;
  domain: string;
  timeHorizon: string;

  // ── Session management ──
  sessions: PredictionSession[];   // all sessions (incl. active)
  activeSessionId: string;

  // ── Existing actions (operate on active flat state) ──
  setPredictionId: (id: string) => void;
  setStatus: (s: "idle" | "running" | "complete" | "error") => void;
  addEvent: (e: SSEEvent) => void;
  /** Session-scoped event update — safe for concurrent predictions */
  addEventToSession: (sessionId: string, e: SSEEvent) => void;
  setResultForSession: (sessionId: string, r: Record<string, unknown>) => void;
  setStatusForSession: (sessionId: string, s: "idle" | "running" | "complete" | "error") => void;
  setResult: (r: Record<string, unknown>) => void;
  setQuery: (q: string) => void;
  setDomain: (d: string) => void;
  setTimeHorizon: (h: string) => void;
  reset: () => void;

  /** Bulk-restore all fields for the active session (used when loading history). */
  restoreFullData: (data: {
    result: Record<string, unknown>;
    agents: AgentPersona[];
    roundEvents: RoundEvent[];
    evidence: EvidenceItem[];
    domain?: string;
    timeHorizon?: string;
  }) => void;

  // ── Session actions ──
  /** Save current active state into sessions[] and reset flat state (start fresh). */
  addSession: (currentQuery: string) => void;
  /** Restore a session from sessions[] back to the flat active state. */
  restoreSession: (sessionId: string) => void;
  /** Remove a session from sessions[]. If it is active, activate the next available one. */
  removeSession: (sessionId: string) => void;
}

const initialSessionId = makeSessionId();

export const usePredictionStore = create<PredictionStoreState>()(
  persist(
  (set) => ({
  // Active flat state
  ...blankSession(),

  // Session list starts with a single entry representing the active session
  sessions: [
    {
      sessionId: initialSessionId,
      createdAt: Date.now(),
      ...blankSession(),
    },
  ],
  activeSessionId: initialSessionId,

  // ── Existing actions ──
  setPredictionId: (id) =>
    set((state) => ({
      predictionId: id,
      sessions: state.sessions.map((s) =>
        s.sessionId === state.activeSessionId ? { ...s, predictionId: id } : s
      ),
    })),

  setStatus: (status) =>
    set((state) => ({
      status,
      sessions: state.sessions.map((s) =>
        s.sessionId === state.activeSessionId ? { ...s, status } : s
      ),
    })),

  addEvent: (e) =>
    set((state) => {
      const newProgress = e.totalSteps
        ? Math.round((e.step / e.totalSteps) * 100)
        : state.progress;
      const newAgents =
        (e.phase === "agents" || e.phase === "agents_final") && e.data?.agents
          ? (e.data.agents as AgentPersona[])
          : state.agents;
      const newRoundEvents =
        e.phase === "simulation" && e.data
          ? [
              ...state.roundEvents,
              {
                round: e.data.round as number,
                agent1_name: e.data.agent1_name as string,
                agent2_name: e.data.agent2_name as string,
                interaction_summary: e.data.interaction_summary as string,
                emergent_claims: (e.data.emergent_claims as string[]) || [],
                agent1_statement:
                  (e.data.agent1_statement as string) || undefined,
                agent2_statement:
                  (e.data.agent2_statement as string) || undefined,
              },
            ]
          : state.roundEvents;
      const newEvidence =
        e.phase === "evidence" && e.data?.items
          ? (e.data.items as EvidenceItem[])
          : state.evidence;
      const newEvents = [...state.events, e];

      return {
        events: newEvents,
        progress: newProgress,
        currentPhase: e.phase,
        agents: newAgents,
        roundEvents: newRoundEvents,
        evidence: newEvidence,
        sessions: state.sessions.map((s) =>
          s.sessionId === state.activeSessionId
            ? {
                ...s,
                events: newEvents,
                progress: newProgress,
                currentPhase: e.phase,
                agents: newAgents,
                roundEvents: newRoundEvents,
                evidence: newEvidence,
              }
            : s
        ),
      };
    }),

  setResult: (result) =>
    set((state) => ({
      result,
      status: "complete",
      sessions: state.sessions.map((s) =>
        s.sessionId === state.activeSessionId
          ? { ...s, result, status: "complete" }
          : s
      ),
    })),

  addEventToSession: (sessionId, e) =>
    set((state) => {
      const session = state.sessions.find((s) => s.sessionId === sessionId);
      if (!session) return {};
      const newProgress = e.step && e.totalSteps ? Math.round((e.step / e.totalSteps) * 100) : session.progress;
      const newAgents = (e.phase === "agents" || e.phase === "agents_final") && e.data?.agents ? (e.data.agents as AgentPersona[]) : session.agents;
      const newRoundEvents = e.phase === "simulation" && e.data
        ? [...session.roundEvents, { round: e.data.round as number, agent1_name: e.data.agent1_name as string, agent2_name: e.data.agent2_name as string, interaction_summary: e.data.interaction_summary as string, emergent_claims: (e.data.emergent_claims as string[]) || [], agent1_statement: (e.data.agent1_statement as string) || undefined, agent2_statement: (e.data.agent2_statement as string) || undefined }]
        : session.roundEvents;
      const newEvidence = e.phase === "evidence" && e.data?.items ? (e.data.items as EvidenceItem[]) : session.evidence;
      const newEvents = [...session.events, e];
      const updatedSession = { ...session, events: newEvents, progress: newProgress, currentPhase: e.phase, agents: newAgents, roundEvents: newRoundEvents, evidence: newEvidence };
      const isActive = sessionId === state.activeSessionId;
      return {
        ...(isActive ? { events: newEvents, progress: newProgress, currentPhase: e.phase, agents: newAgents, roundEvents: newRoundEvents, evidence: newEvidence } : {}),
        sessions: state.sessions.map((s) => s.sessionId === sessionId ? updatedSession : s),
      };
    }),

  setResultForSession: (sessionId, result) =>
    set((state) => {
      const isActive = sessionId === state.activeSessionId;
      return {
        ...(isActive ? { result, status: "complete" as const } : {}),
        sessions: state.sessions.map((s) => s.sessionId === sessionId ? { ...s, result, status: "complete" as const } : s),
      };
    }),

  setStatusForSession: (sessionId, status) =>
    set((state) => {
      const isActive = sessionId === state.activeSessionId;
      return {
        ...(isActive ? { status } : {}),
        sessions: state.sessions.map((s) => s.sessionId === sessionId ? { ...s, status } : s),
      };
    }),

  setQuery: (query) =>
    set((state) => ({
      query,
      sessions: state.sessions.map((s) =>
        s.sessionId === state.activeSessionId ? { ...s, query } : s
      ),
    })),

  setDomain: (domain) =>
    set((state) => ({
      domain,
      sessions: state.sessions.map((s) =>
        s.sessionId === state.activeSessionId ? { ...s, domain } : s
      ),
    })),

  setTimeHorizon: (timeHorizon) =>
    set((state) => ({
      timeHorizon,
      sessions: state.sessions.map((s) =>
        s.sessionId === state.activeSessionId ? { ...s, timeHorizon } : s
      ),
    })),

  reset: () =>
    set((state) => {
      const blank = blankSession();
      return {
        ...blank,
        query: state.query, // preserve query text on reset
        sessions: state.sessions.map((s) =>
          s.sessionId === state.activeSessionId
            ? { ...s, ...blank, query: state.query }
            : s
        ),
      };
    }),

  restoreFullData: ({ result, agents, roundEvents, evidence, domain, timeHorizon }) =>
    set((state) => ({
      result,
      agents,
      roundEvents,
      evidence,
      ...(domain !== undefined ? { domain } : {}),
      ...(timeHorizon !== undefined ? { timeHorizon } : {}),
      sessions: state.sessions.map((s) =>
        s.sessionId === state.activeSessionId
          ? {
              ...s,
              result,
              agents,
              roundEvents,
              evidence,
              ...(domain !== undefined ? { domain } : {}),
              ...(timeHorizon !== undefined ? { timeHorizon } : {}),
            }
          : s
      ),
    })),

  // ── Session actions ──
  addSession: (currentQuery) =>
    set((state) => {
      // Sync current flat state into the active session entry first
      const syncedSessions = state.sessions.map((s) =>
        s.sessionId === state.activeSessionId
          ? {
              ...s,
              query: currentQuery || state.query,
              domain: state.domain,
              timeHorizon: state.timeHorizon,
              predictionId: state.predictionId,
              status: state.status,
              events: state.events,
              result: state.result,
              progress: state.progress,
              currentPhase: state.currentPhase,
              agents: state.agents,
              roundEvents: state.roundEvents,
              evidence: state.evidence,
              error: state.error,
            }
          : s
      );

      // Enforce max sessions: drop oldest non-running session if needed
      let trimmed = syncedSessions;
      if (trimmed.length >= MAX_SESSIONS) {
        const oldestNonRunningIdx = trimmed.findIndex(
          (s) => s.status !== "running"
        );
        if (oldestNonRunningIdx !== -1) {
          trimmed = trimmed.filter((_, i) => i !== oldestNonRunningIdx);
        } else {
          // All running — replace oldest
          trimmed = trimmed.slice(1);
        }
      }

      const newSessionId = makeSessionId();
      const blank = blankSession();
      const newSession: PredictionSession = {
        sessionId: newSessionId,
        createdAt: Date.now(),
        ...blank,
      };

      return {
        ...blank,
        sessions: [...trimmed, newSession],
        activeSessionId: newSessionId,
      };
    }),

  restoreSession: (sessionId) =>
    set((state) => {
      if (sessionId === state.activeSessionId) return state;

      // Sync current flat state back into active session
      const syncedSessions = state.sessions.map((s) =>
        s.sessionId === state.activeSessionId
          ? {
              ...s,
              query: state.query,
              domain: state.domain,
              timeHorizon: state.timeHorizon,
              predictionId: state.predictionId,
              status: state.status,
              events: state.events,
              result: state.result,
              progress: state.progress,
              currentPhase: state.currentPhase,
              agents: state.agents,
              roundEvents: state.roundEvents,
              evidence: state.evidence,
              error: state.error,
            }
          : s
      );

      const target = syncedSessions.find((s) => s.sessionId === sessionId);
      if (!target) return state;

      return {
        activeSessionId: sessionId,
        sessions: syncedSessions,
        // Restore flat state from the target session
        query: target.query,
        domain: target.domain,
        timeHorizon: target.timeHorizon,
        predictionId: target.predictionId,
        status: target.status,
        events: target.events,
        result: target.result,
        progress: target.progress,
        currentPhase: target.currentPhase,
        agents: target.agents,
        roundEvents: target.roundEvents,
        evidence: target.evidence,
        error: target.error,
      };
    }),

  removeSession: (sessionId) =>
    set((state) => {
      if (state.sessions.length <= 1) return state; // never remove the last session

      const remaining = state.sessions.filter((s) => s.sessionId !== sessionId);

      // If we removed the active session, activate the last remaining one
      if (sessionId === state.activeSessionId) {
        const next = remaining[remaining.length - 1];
        return {
          activeSessionId: next.sessionId,
          sessions: remaining,
          query: next.query,
          domain: next.domain,
          timeHorizon: next.timeHorizon,
          predictionId: next.predictionId,
          status: next.status,
          events: next.events,
          result: next.result,
          progress: next.progress,
          currentPhase: next.currentPhase,
          agents: next.agents,
          roundEvents: next.roundEvents,
          evidence: next.evidence,
          error: next.error,
        };
      }

      return { sessions: remaining };
    }),
  }),
  {
    name: "predect-sessions-v1",
    storage: createJSONStorage(() => {
      if (typeof window === "undefined") {
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
      }
      return localStorage;
    }),
    // Only persist completed/error sessions; strip large event arrays
    partialize: (state) => ({
      sessions: state.sessions
        .filter((s) => s.status === "complete" || s.status === "error")
        .slice(0, MAX_SESSIONS)
        .map((s) => ({ ...s, events: [] })),
    }),
    // On hydration: restore completed sessions as background history,
    // always start with a fresh blank active session
    merge: (persistedState: unknown, currentState: PredictionStoreState) => {
      const persisted = persistedState as { sessions?: PredictionSession[] } | null;
      const restoredSessions = (persisted?.sessions ?? []).slice(0, MAX_SESSIONS - 1);
      const newSessionId = makeSessionId();
      const newSession: PredictionSession = {
        sessionId: newSessionId,
        createdAt: Date.now(),
        ...blankSession(),
      };
      return {
        ...currentState,
        sessions: [...restoredSessions, newSession],
        activeSessionId: newSessionId,
      };
    },
  }
));
