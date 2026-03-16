"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfigPanelProps {
  query: string;
  setQuery: (q: string) => void;
  domain: string;
  setDomain: (d: string) => void;
  timeHorizon: string;
  setTimeHorizon: (t: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

const MAX_CHARS = 500;

const domains = [
  "general",
  "finance",
  "technology",
  "politics",
  "science",
  "sports",
  "crypto",
  "climate",
];
const horizons = [
  "1 week",
  "1 month",
  "3 months",
  "6 months",
  "1 year",
  "2+ years",
];

const placeholderExamples = [
  "What will happen with Bitcoin in the next 3 months?",
  "Will the Fed cut interest rates before Q3?",
  "What's the likelihood of a recession in 2025?",
  "How will AI regulation evolve in Europe?",
  "Will Nvidia maintain its GPU market dominance?",
  "What happens to housing prices if rates drop 1%?",
  "Can Tesla recover its market share by year-end?",
  "Will open-source LLMs match GPT-5 performance?",
];

export function ConfigPanel({
  query,
  setQuery,
  domain,
  setDomain,
  timeHorizon,
  setTimeHorizon,
  onSubmit,
  loading,
}: ConfigPanelProps) {
  const { agentCount, rounds, setAgentCount, setRounds } = useSettingsStore();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate placeholder every 3s when query is empty
  useEffect(() => {
    if (query) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % placeholderExamples.length);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [query]);

  const isMac = useMemo(() => {
    if (typeof window === "undefined") return true;
    return /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
  }, []);

  const charsUsed = query.length;
  const charsLeft = MAX_CHARS - charsUsed;
  const isNearLimit = charsLeft <= 50;
  const isAtLimit = charsLeft <= 0;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_CHARS) {
      setQuery(e.target.value);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold">Configuration</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
          {/* Character counter — only shows when typing */}
          {charsUsed > 0 && (
            <span
              className={cn(
                "text-[11px] font-mono tabular-nums transition-colors",
                isAtLimit
                  ? "text-danger"
                  : isNearLimit
                  ? "text-warning"
                  : "text-text-muted"
              )}
            >
              {charsLeft} left
            </span>
          )}
        </CardHeader>
        <Textarea
          value={query}
          onChange={handleChange}
          placeholder={placeholderExamples[placeholderIdx]}
          rows={4}
          className="mb-3"
          maxLength={MAX_CHARS}
        />
        <div className="flex flex-col gap-1.5">
          <Button
            onClick={onSubmit}
            loading={loading}
            disabled={!query.trim() || isAtLimit}
            className="w-full"
          >
            {loading ? "Running..." : "Run Prediction"}
          </Button>
          <div className="flex items-center justify-between px-0.5">
            <p className="text-[10px] text-text-muted font-mono select-none">{isMac ? "⌘↵" : "Ctrl+↵"} to run</p>
            {!loading && query.trim() && (
              <p className="text-[10px] text-text-muted select-none">
                ~{Math.max(1, Math.round((agentCount * rounds) / 10))}–{Math.max(2, Math.round((agentCount * rounds) / 6))} min
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domain</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-1.5">
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className={`text-xs px-2 py-1.5 rounded-md border transition-colors capitalize ${
                domain === d
                  ? "bg-accent/15 border-accent/30 text-accent"
                  : "border-border text-text-muted hover:border-border-strong hover:text-text-secondary"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time Horizon</CardTitle>
        </CardHeader>
        <div className="space-y-1.5">
          {horizons.map((h) => (
            <button
              key={h}
              onClick={() => setTimeHorizon(h)}
              className={`w-full text-left text-xs px-3 py-1.5 rounded-md border transition-colors ${
                timeHorizon === h
                  ? "bg-accent/15 border-accent/30 text-accent"
                  : "border-transparent text-text-muted hover:border-border hover:text-text-secondary"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulation</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Agents</span>
              <span className="text-xs font-mono text-accent">
                {agentCount}
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={16}
              value={agentCount}
              onChange={(e) => setAgentCount(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-text-muted">4 · Fast</span>
              <span className="text-[10px] text-text-muted">16 · Thorough</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Rounds</span>
              <span className="text-xs font-mono text-accent">
                {rounds}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-text-muted">2 · Quick</span>
              <span className="text-[10px] text-text-muted">10 · Deep</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
