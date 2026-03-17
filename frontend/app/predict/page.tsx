"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ConfigPanel } from "@/components/predict/ConfigPanel";
import { PipelinePanel } from "@/components/predict/PipelinePanel";
import { LiveRunView } from "@/components/predict/LiveRunView";
import { ActivityPanel } from "@/components/predict/ActivityPanel";
import { ResultsView } from "@/components/predict/ResultsView";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { startPrediction, streamPrediction, getPredictionResult, getPredictionResultFull, getPredictionHistory } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrainCircuit, Network, Plus, AlertCircle, RefreshCw, History, ChevronRight, Link2, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Tab = "configure" | "pipeline" | "activity";

const tabs: { id: Tab; label: string }[] = [
  { id: "configure", label: "Configure" },
  { id: "pipeline", label: "Pipeline" },
  { id: "activity", label: "Activity" },
];

interface HistoryItem {
  id: string;
  query: string;
  domain: string;
  time_horizon: string;
  status: "complete" | "failed" | "running";
  confidence: number | null;
  headline: string | null;
  created_at: string;
}

function PredictPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewId = searchParams.get("view");
  const queryParam = searchParams.get("query");
  const domainParam = searchParams.get("domain");
  const timeHorizonParam = searchParams.get("time_horizon");

  const { agentCount, rounds, newsApiKey, gNewsApiKey, alphaVantageKey, defaultDomain, defaultTimeHorizon } = useSettingsStore();

  const [query, setQueryLocal] = useState(queryParam ? decodeURIComponent(queryParam) : "");
  const [domain, setDomain] = useState(domainParam || defaultDomain || "general");
  const [timeHorizon, setTimeHorizon] = useState(timeHorizonParam || defaultTimeHorizon || "6 months");
  const [collectEvidence, setCollectEvidence] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("configure");
  const [recentPredictions, setRecentPredictions] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);

  const {
    setResult,
    setPredictionId,
    setStatus,
    reset,
    setQuery: setStoreQuery,
    setDomain: setStoreDomain,
    setTimeHorizon: setStoreTimeHorizon,
    addSession,
    restoreSession,
    removeSession,
    addEventToSession,
    setResultForSession,
    setStatusForSession,
    restoreFullData,
  } = usePredictionStore();

  const status = usePredictionStore((s) => s.status);
  const predictionId = usePredictionStore((s) => s.predictionId);
  const sessions = usePredictionStore((s) => s.sessions);
  const activeSessionId = usePredictionStore((s) => s.activeSessionId);

  // Keep local query/domain/timeHorizon in sync with the store (for session switching)
  useEffect(() => {
    const unsub = usePredictionStore.subscribe((state) => {
      const activeSession = state.sessions.find(
        (s) => s.sessionId === state.activeSessionId
      );
      if (activeSession) {
        setQueryLocal(activeSession.query);
        if (activeSession.domain) setDomain(activeSession.domain);
        if (activeSession.timeHorizon) setTimeHorizon(activeSession.timeHorizon);
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

  const handleSetDomain = useCallback(
    (d: string) => {
      setDomain(d);
      setStoreDomain(d);
    },
    [setStoreDomain]
  );

  const handleSetTimeHorizon = useCallback(
    (h: string) => {
      setTimeHorizon(h);
      setStoreTimeHorizon(h);
    },
    [setStoreTimeHorizon]
  );

  // Load a shared/history prediction when ?view=<id> is in the URL
  useEffect(() => {
    if (!viewId) return;
    reset();
    setPredictionId(viewId);
    setStatus("running"); // show loading state briefly
    getPredictionResultFull(viewId)
      .then((data) => {
        if (data?.result) {
          if (data.query) handleSetQuery(data.query);
          if (data.domain) handleSetDomain(data.domain);
          if (data.time_horizon) handleSetTimeHorizon(data.time_horizon);
          setResult(data.result);
          restoreFullData({
            result: data.result,
            agents: data.agents || [],
            roundEvents: data.rounds || [],
            evidence: data.evidence || [],
            domain: data.domain,
            timeHorizon: data.time_horizon,
          });
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
    // Capture the session ID at submission time so concurrent predictions stay isolated
    const submittedSessionId = usePredictionStore.getState().activeSessionId;

    try {
      const { prediction_id } = await startPrediction({
        query,
        domain,
        time_horizon: timeHorizon,
        agent_count: agentCount,
        rounds,
        collect_evidence: collectEvidence,
        news_api_key: newsApiKey || null,
        gnews_api_key: gNewsApiKey || null,
        alpha_vantage_key: alphaVantageKey || null,
      });
      setPredictionId(prediction_id);

      const cleanup = streamPrediction(
        prediction_id,
        (event) => {
          addEventToSession(submittedSessionId, event);
          if (event.phase === "report" && event.data) {
            setResultForSession(submittedSessionId, event.data as Record<string, unknown>);
            setStatusForSession(submittedSessionId, "complete");
            cleanup();
          } else if (event.phase === "error") {
            setStatusForSession(submittedSessionId, "error");
            cleanup();
          }
        },
        async () => {
          try {
            const result = await getPredictionResult(prediction_id);
            if (result?.result) {
              setResultForSession(submittedSessionId, result.result);
              setStatusForSession(submittedSessionId, "complete");
            } else if (result?.status === "failed") {
              setStatusForSession(submittedSessionId, "error");
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
    collectEvidence,
    newsApiKey,
    gNewsApiKey,
    alphaVantageKey,
    setPredictionId,
    setStatus,
    reset,
    addEventToSession,
    setResultForSession,
    setStatusForSession,
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

  // Load recent predictions for the idle state; refresh after each completion
  const loadRecentPredictions = useCallback(() => {
    getPredictionHistory()
      .then((data) => {
        const completed = (data as HistoryItem[]).filter((p) => p.status === "complete").slice(0, 10);
        setRecentPredictions(completed);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRecentPredictions();
  }, [loadRecentPredictions]);

  useEffect(() => {
    if (status === "complete") {
      loadRecentPredictions();
    }
  }, [status, loadRecentPredictions]);

  const handleCopyLink = useCallback(() => {
    if (!predictionId) return;
    const url = `${window.location.origin}/predict?view=${predictionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [predictionId]);

  const handleAddSession = useCallback(() => {
    addSession(query);
    setQueryLocal("");
    setActiveTab("configure");
  }, [addSession, query]);

  const handleRestoreSession = useCallback(
    (sessionId: string) => {
      restoreSession(sessionId);
      const restored = usePredictionStore.getState().sessions.find((s) => s.sessionId === sessionId);
      if (restored?.domain) setDomain(restored.domain);
      if (restored?.timeHorizon) setTimeHorizon(restored.timeHorizon);
      // On mobile, switch to pipeline tab when restoring a complete session so results are visible
      setActiveTab(restored?.status === "complete" ? "pipeline" : "configure");
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
              setDomain={handleSetDomain}
              timeHorizon={timeHorizon}
              setTimeHorizon={handleSetTimeHorizon}
              collectEvidence={collectEvidence}
              setCollectEvidence={setCollectEvidence}
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
              <div className="h-full flex flex-col">
                {query.trim() ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <motion.div
                      className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6"
                      animate={{ boxShadow: ["0 0 0px rgba(99,91,255,0)", "0 0 24px rgba(99,91,255,0.3)", "0 0 0px rgba(99,91,255,0)"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <BrainCircuit className="w-10 h-10 text-accent" />
                    </motion.div>
                    <h2 className="text-2xl font-bold mb-2">Ready to run</h2>
                    <p className="text-text-secondary text-sm max-w-sm mb-1 line-clamp-2">
                      &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-text-muted text-xs">
                      Click <span className="text-accent font-medium">Run Prediction</span> or press <span className="font-mono text-accent">⌘↵</span>
                    </p>
                  </div>
                ) : recentPredictions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
                      <BrainCircuit className="w-10 h-10 text-accent" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Ready to predict</h2>
                    <p className="text-text-secondary text-sm max-w-sm">
                      Enter your question and configure the simulation on the left, then
                      click Run Prediction.
                    </p>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-text-muted" />
                        <span className="text-sm font-medium text-text-secondary">Recent Predictions</span>
                      </div>
                      <Link href="/history" className="text-xs text-accent hover:text-accent/80 transition-colors">
                        View all →
                      </Link>
                    </div>
                    <div className="grid gap-2">
                      {recentPredictions.map((p) => {
                        const pct = p.confidence != null ? Math.round(p.confidence * 100) : null;
                        const color =
                          pct == null ? "var(--text-muted)"
                          : pct >= 70 ? "#10B981"
                          : pct >= 45 ? "#F59E0B"
                          : "#EF4444";
                        return (
                          <motion.button
                            key={p.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => router.push(`/predict?view=${p.id}`)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-border-strong hover:bg-white/4 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary line-clamp-1 group-hover:text-accent transition-colors">
                                  {p.query}
                                </p>
                                {p.headline && (
                                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{p.headline}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] font-mono text-text-muted capitalize">{p.domain}</span>
                                  <span className="text-[10px] text-text-muted opacity-40">·</span>
                                  <span className="text-[10px] font-mono text-text-muted">{p.time_horizon}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {pct != null && (
                                  <span className="text-sm font-bold font-mono" style={{ color }}>{pct}%</span>
                                )}
                                <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="text-center mt-8">
                      <Link href="/history" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors border border-border hover:border-accent/30 px-3 py-1.5 rounded-lg">
                        <History className="w-3.5 h-3.5" />
                        Full prediction history
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
            {status === "running" ? (
              <LiveRunView />
            ) : (
              <PipelinePanel />
            )}
            {status === "error" && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6 text-danger" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">Prediction Failed</h3>
                <p className="text-xs text-text-muted mb-4 max-w-xs">
                  The prediction pipeline encountered an error. Try again with a different query or fewer agents.
                </p>
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-accent/15 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            )}
            {viewId && status === "complete" && (
              <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-accent/5 border border-accent/15 text-xs text-text-muted">
                <Link2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span>Shared prediction — <button onClick={handleAddSession} className="text-accent hover:underline">start your own</button></span>
              </div>
            )}
            <ResultsView />
            {status === "complete" && predictionId && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Link href={`/graph?prediction_id=${predictionId}`}>
                  <Button variant="outline" size="sm">
                    <Network className="w-3.5 h-3.5" />
                    View Knowledge Graph
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Share2 className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Share"}
                </Button>
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
                setDomain={handleSetDomain}
                timeHorizon={timeHorizon}
                setTimeHorizon={handleSetTimeHorizon}
                collectEvidence={collectEvidence}
                setCollectEvidence={setCollectEvidence}
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
                recentPredictions.length > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-xs font-medium text-text-secondary">Recent Predictions</span>
                      </div>
                      <Link href="/history" className="text-xs text-accent hover:text-accent/80 transition-colors">
                        View all →
                      </Link>
                    </div>
                    <div className="grid gap-2">
                      {recentPredictions.map((p) => {
                        const pct = p.confidence != null ? Math.round(p.confidence * 100) : null;
                        const color =
                          pct == null ? "var(--text-muted)"
                          : pct >= 70 ? "#10B981"
                          : pct >= 45 ? "#F59E0B"
                          : "#EF4444";
                        return (
                          <button
                            key={p.id}
                            onClick={() => router.push(`/predict?view=${p.id}`)}
                            className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-border-strong hover:bg-white/4 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-primary line-clamp-1">{p.query}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] font-mono text-text-muted capitalize">{p.domain}</span>
                                  <span className="text-[10px] text-text-muted opacity-40">·</span>
                                  <span className="text-[10px] font-mono text-text-muted">{p.time_horizon}</span>
                                </div>
                              </div>
                              {pct != null && (
                                <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color }}>{pct}%</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-16">
                    <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                      <BrainCircuit className="w-8 h-8 text-accent" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Ready to predict</h2>
                    <p className="text-text-secondary text-sm max-w-xs">
                      Configure your question in the Configure tab, then click Run Prediction.
                    </p>
                  </div>
                )
              )}
              {status === "running" ? (
                <LiveRunView />
              ) : (
                <PipelinePanel />
              )}
              {status === "error" && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center mb-3">
                    <AlertCircle className="w-5 h-5 text-danger" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Prediction Failed</h3>
                  <p className="text-xs text-text-muted mb-3 max-w-[200px]">Try again with fewer agents or a simpler query.</p>
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/15 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                </div>
              )}
              {viewId && status === "complete" && (
                <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-accent/5 border border-accent/15 text-xs text-text-muted">
                  <Link2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span>Shared prediction — <button onClick={handleAddSession} className="text-accent hover:underline">start your own</button></span>
                </div>
              )}
              <ResultsView />
              {status === "complete" && predictionId && (
                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                  <Link href={`/graph?prediction_id=${predictionId}`}>
                    <Button variant="outline" size="sm">
                      <Network className="w-3.5 h-3.5" />
                      View Knowledge Graph
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Share2 className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Share"}
                  </Button>
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
