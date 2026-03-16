"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ConfigPanel } from "@/components/predict/ConfigPanel";
import { PipelinePanel } from "@/components/predict/PipelinePanel";
import { ActivityPanel } from "@/components/predict/ActivityPanel";
import { ResultsView } from "@/components/predict/ResultsView";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { startPrediction, streamPrediction, getPredictionResult } from "@/lib/api";
import Link from "next/link";
import { BrainCircuit, Network, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Tab = "configure" | "pipeline" | "activity";

const tabs: { id: Tab; label: string }[] = [
  { id: "configure", label: "Configure" },
  { id: "pipeline", label: "Pipeline" },
  { id: "activity", label: "Activity" },
];

function PredictPageInner() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get("view");

  const [query, setQueryLocal] = useState("");
  const [domain, setDomain] = useState("general");
  const [timeHorizon, setTimeHorizon] = useState("6 months");
  const [activeTab, setActiveTab] = useState<Tab>("configure");
  const { agentCount, rounds } = useSettingsStore();

  const {
    addEvent,
    setResult,
    setPredictionId,
    setStatus,
    reset,
    setQuery: setStoreQuery,
    addSession,
    restoreSession,
    removeSession,
  } = usePredictionStore();

  const status = usePredictionStore((s) => s.status);
  const predictionId = usePredictionStore((s) => s.predictionId);
  const sessions = usePredictionStore((s) => s.sessions);
  const activeSessionId = usePredictionStore((s) => s.activeSessionId);

  // Keep local query in sync with the store (for session switching)
  useEffect(() => {
    const unsub = usePredictionStore.subscribe((state) => {
      // When active session changes, sync the local query state
      const activeSession = state.sessions.find(
        (s) => s.sessionId === state.activeSessionId
      );
      if (activeSession) {
        setQueryLocal(activeSession.query);
      }
    });
    return unsub;
  }, []);

  // Keep store query in sync with local query
  const handleSetQuery = useCallback(
    (q: string) => {
      setQueryLocal(q);
      setStoreQuery(q);
    },
    [setStoreQuery]
  );

  // Load a shared/history prediction when ?view=<id> is in the URL
  useEffect(() => {
    if (!viewId) return;
    reset();
    setPredictionId(viewId);
    setStatus("running"); // show loading state briefly
    getPredictionResult(viewId)
      .then((data) => {
        if (data?.result) {
          setResult(data.result);
          setStatus("complete");
          setActiveTab("pipeline");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => setStatus("idle"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  // Auto-switch to pipeline tab when prediction starts running
  useEffect(() => {
    if (status === "running") {
      setActiveTab("pipeline");
    }
  }, [status]);

  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    reset();
    setStatus("running");

    try {
      const { prediction_id } = await startPrediction({
        query,
        domain,
        time_horizon: timeHorizon,
        agent_count: agentCount,
        rounds,
        collect_evidence: true,
      });
      setPredictionId(prediction_id);

      const cleanup = streamPrediction(
        prediction_id,
        (event) => {
          addEvent(event);
          if (event.phase === "report" && event.data) {
            setResult(event.data as Record<string, unknown>);
            setStatus("complete");
            cleanup();
          }
        },
        async () => {
          try {
            const result = await getPredictionResult(prediction_id);
            if (result?.result) {
              setResult(result.result);
              setStatus("complete");
            }
          } catch {
            // ignore
          }
        }
      );
    } catch {
      setStatus("error");
    }
  }, [
    query,
    domain,
    timeHorizon,
    agentCount,
    rounds,
    addEvent,
    setResult,
    setPredictionId,
    setStatus,
    reset,
  ]);

  // Keyboard shortcut: Cmd+Enter or Ctrl+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (query.trim() && status !== "running") {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [query, status, handleSubmit]);

  const handleAddSession = useCallback(() => {
    addSession(query);
    setQueryLocal("");
    setActiveTab("configure");
  }, [addSession, query]);

  const handleRestoreSession = useCallback(
    (sessionId: string) => {
      restoreSession(sessionId);
      setActiveTab("configure");
    },
    [restoreSession]
  );

  // Session tab bar — shared between desktop and mobile
  const sessionTabBar = sessions.length > 1 ? (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-bg-base/80 overflow-x-auto flex-shrink-0">
      {sessions.map((session, i) => (
        <button
          key={session.sessionId}
          onClick={() => handleRestoreSession(session.sessionId)}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all",
            session.sessionId === activeSessionId
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-text-muted hover:text-text-secondary hover:bg-white/4 border border-transparent"
          )}
        >
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full flex-shrink-0",
              session.status === "running"
                ? "bg-warning animate-pulse"
                : session.status === "complete"
                ? "bg-success"
                : session.status === "error"
                ? "bg-danger"
                : "bg-text-muted"
            )}
          />
          <span>
            {session.query
              ? session.query.slice(0, 28) + (session.query.length > 28 ? "…" : "")
              : `Session ${i + 1}`}
          </span>
          {sessions.length > 1 && (
            <span
              role="button"
              aria-label="Close session"
              onClick={(e) => {
                e.stopPropagation();
                removeSession(session.sessionId);
              }}
              className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity leading-none cursor-pointer"
            >
              ×
            </span>
          )}
        </button>
      ))}
      <button
        onClick={handleAddSession}
        title="New prediction"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-white/4 transition-colors flex-shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  return (
    <>
      {/* ── Desktop layout (md+): 3-column, unchanged ── */}
      <div className="hidden md:flex flex-col h-[calc(100vh-56px)] overflow-hidden">
        {sessionTabBar}

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Config */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-[260px] flex-shrink-0 border-r border-border overflow-y-auto p-4"
          >
            <ConfigPanel
              query={query}
              setQuery={handleSetQuery}
              domain={domain}
              setDomain={setDomain}
              timeHorizon={timeHorizon}
              setTimeHorizon={setTimeHorizon}
              onSubmit={handleSubmit}
              loading={status === "running"}
            />
            {status === "complete" && (
              <button
                onClick={handleAddSession}
                className="w-full mt-3 py-2 text-xs text-text-muted hover:text-text-primary border border-border rounded-lg transition-colors"
              >
                + Start New Prediction
              </button>
            )}
          </motion.div>

          {/* Center: Pipeline + Results */}
          <div className="flex-1 overflow-y-auto p-6">
            {status === "idle" && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
                  <BrainCircuit className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Ready to predict</h2>
                <p className="text-text-secondary text-sm max-w-sm">
                  Enter your question and configure the simulation on the left, then
                  click Run Prediction.
                </p>
              </div>
            )}
            <PipelinePanel />
            <ResultsView />
            {status === "complete" && predictionId && (
              <div className="mt-4 text-center">
                <Link href={`/graph?prediction_id=${predictionId}`}>
                  <Button variant="outline" size="sm">
                    <Network className="w-3.5 h-3.5" />
                    View Knowledge Graph
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Right: Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-[320px] flex-shrink-0 border-l border-border overflow-y-auto p-4"
          >
            <ActivityPanel />
          </motion.div>
        </div>
      </div>

      {/* ── Mobile layout (< md): tabbed ── */}
      <div className="flex flex-col md:hidden h-[calc(100vh-56px)]">
        {sessionTabBar}

        {/* Tab bar */}
        <div className="flex border-b border-border bg-bg-base flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-text-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "configure" && (
            <div className="p-4">
              <ConfigPanel
                query={query}
                setQuery={handleSetQuery}
                domain={domain}
                setDomain={setDomain}
                timeHorizon={timeHorizon}
                setTimeHorizon={setTimeHorizon}
                onSubmit={handleSubmit}
                loading={status === "running"}
              />
              {status === "complete" && (
                <button
                  onClick={handleAddSession}
                  className="w-full mt-3 py-2 text-xs text-text-muted hover:text-text-primary border border-border rounded-lg transition-colors"
                >
                  + Start New Prediction
                </button>
              )}
            </div>
          )}

          {activeTab === "pipeline" && (
            <div className="p-4">
              {status === "idle" && (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                    <BrainCircuit className="w-8 h-8 text-accent" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Ready to predict</h2>
                  <p className="text-text-secondary text-sm max-w-xs">
                    Configure your question in the Configure tab, then click Run Prediction.
                  </p>
                </div>
              )}
              <PipelinePanel />
              <ResultsView />
              {status === "complete" && predictionId && (
                <div className="mt-4 text-center">
                  <Link href={`/graph?prediction_id=${predictionId}`}>
                    <Button variant="outline" size="sm">
                      <Network className="w-3.5 h-3.5" />
                      View Knowledge Graph
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="p-4">
              <ActivityPanel />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function PredictPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-56px)] text-text-muted text-sm">
        Loading...
      </div>
    }>
      <PredictPageInner />
    </Suspense>
  );
}
