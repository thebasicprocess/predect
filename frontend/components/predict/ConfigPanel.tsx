"use client";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SlidersHorizontal } from "lucide-react";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold">Configuration</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
        </CardHeader>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What will happen with..."
          rows={4}
          className="mb-3"
        />
        <Button
          onClick={onSubmit}
          loading={loading}
          disabled={!query.trim()}
          className="w-full"
        >
          Run Prediction
        </Button>
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
              <span className="text-xs font-mono text-text-primary">
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
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">Rounds</span>
              <span className="text-xs font-mono text-text-primary">
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
          </div>
        </div>
      </Card>
    </div>
  );
}
