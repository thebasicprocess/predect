"use client";
import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ConfigPanel } from "@/components/predict/ConfigPanel";
import { PipelinePanel } from "@/components/predict/PipelinePanel";
import { ActivityPanel } from "@/components/predict/ActivityPanel";
import { ResultsView } from "@/components/predict/ResultsView";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { startPrediction, streamPrediction, getPredictionResult } from "@/lib/api";
import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "configure" | "pipeline" | "activity";

const tabs: { id: Tab; label: string }[] = [
  { id: "configure", label: "Configure" },
  { id: "pipeline", label: "Pipeline" },
  { id: "activity", label: "Activity" },
];

export default function PredictPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("general");
  const [timeHorizon, setTimeHorizon] = useState("6 months");
  const [activeTab, setActiveTab] = useState<Tab>("configure");
  const { agentCount, rounds } = useSettingsStore();
  const { addEvent, setResult, setPredictionId, setStatus, reset } =
    usePredictionStore();
  const status = usePredictionStore((s) => s.status);

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

  return (
    <>
      {/* ── Desktop layout (md+): 3-column, unchanged ── */}
      <div className="hidden md:flex h-[calc(100vh-56px)] overflow-hidden">
        {/* Left: Config */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[260px] flex-shrink-0 border-r border-border overflow-y-auto p-4"
        >
          <ConfigPanel
            query={query}
            setQuery={setQuery}
            domain={domain}
            setDomain={setDomain}
            timeHorizon={timeHorizon}
            setTimeHorizon={setTimeHorizon}
            onSubmit={handleSubmit}
            loading={status === "running"}
          />
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

      {/* ── Mobile layout (< md): tabbed ── */}
      <div className="flex flex-col md:hidden h-[calc(100vh-56px)]">
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
                setQuery={setQuery}
                domain={domain}
                setDomain={setDomain}
                timeHorizon={timeHorizon}
                setTimeHorizon={setTimeHorizon}
                onSubmit={handleSubmit}
                loading={status === "running"}
              />
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
