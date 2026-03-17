"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Lightbulb, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfigPanelProps {
  query: string;
  setQuery: (q: string) => void;
  domain: string;
  setDomain: (d: string) => void;
  timeHorizon: string;
  setTimeHorizon: (t: string) => void;
  collectEvidence: boolean;
  setCollectEvidence: (v: boolean) => void;
  onSubmit: () => void;
  loading: boolean;
}

const MAX_CHARS = 500;

const DOMAIN_EXAMPLES: Record<string, string[]> = {
  general: [
    "Will inflation return to 2% target by end of 2025?",
    "What are the chances of a global recession in 2025?",
    "How will AI regulation evolve globally in the next year?",
    "Will remote work remain dominant through 2026?",
  ],
  finance: [
    "Will the Fed cut rates more than 3 times in 2025?",
    "Can the S&P 500 reach new all-time highs by Q3?",
    "Will Bitcoin surpass $100k before year-end?",
    "Is a housing market correction likely in 2025?",
  ],
  technology: [
    "Will GPT-5 or Claude 4 dominate enterprise AI in 2025?",
    "Can open-source LLMs match frontier model performance?",
    "Will Nvidia maintain GPU market dominance through 2026?",
    "How will quantum computing advance in the next 2 years?",
  ],
  politics: [
    "How will US-China trade relations evolve in 2025?",
    "Will AI regulation pass in the EU before 2026?",
    "What outcome is likely in the next UK general election?",
    "Will NATO expand further in Eastern Europe?",
  ],
  science: [
    "Will mRNA vaccines replace traditional flu shots by 2027?",
    "How close are we to a viable nuclear fusion reactor?",
    "Will CRISPR gene editing reach mainstream medicine by 2026?",
    "What breakthroughs in battery technology can we expect?",
  ],
  sports: [
    "Which team will win the next FIFA World Cup?",
    "Will LeBron James retire before the 2026 season?",
    "Can Novak Djokovic break more Grand Slam records?",
    "Will esports viewership surpass traditional sports by 2030?",
  ],
  crypto: [
    "Will Ethereum successfully scale to mainstream adoption?",
    "Can DeFi recover from regulatory pressure in 2025?",
    "Will Bitcoin ETF inflows sustain the bull market?",
    "Which layer-2 protocol will dominate by end of 2025?",
  ],
  climate: [
    "Will global emissions peak before 2030?",
    "Can renewable energy provide 50% of global power by 2030?",
    "Will carbon capture technology become cost-effective by 2028?",
    "How will climate migration reshape geopolitics by 2035?",
  ],
};

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
  collectEvidence,
  setCollectEvidence,
  onSubmit,
  loading,
}: ConfigPanelProps) {
  const { agentCount, rounds, setAgentCount, setRounds } = useSettingsStore();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    return /Mac|iPhone|iPad/.test(window.navigator.userAgent);
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

  const handleExampleClick = (example: string) => {
    setQuery(example);
    textareaRef.current?.focus();
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
          ref={textareaRef}
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
          {/* Evidence toggle */}
          <button
            type="button"
            onClick={() => setCollectEvidence(!collectEvidence)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
              collectEvidence
                ? "border-success/30 bg-success/6 text-success"
                : "border-border bg-white/3 text-text-muted hover:border-border-strong"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${collectEvidence ? "bg-success" : "bg-white/20"}`} />
              <span className="text-xs font-medium">Collect evidence</span>
            </div>
            <span className="text-[10px] font-mono">
              {collectEvidence ? "ON · ~5–8 min" : "OFF · ~2–3 min"}
            </span>
          </button>
        </div>
      </Card>

      {!query && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-accent" />
              <CardTitle>Example Questions</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-1">
            {(DOMAIN_EXAMPLES[domain] ?? DOMAIN_EXAMPLES.general).map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left text-[10px] px-2.5 py-1.5 rounded-lg bg-white/3 border border-border hover:bg-white/6 hover:border-border-strong transition-colors text-text-muted hover:text-text-secondary leading-snug"
              >
                → {example}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
