"use client";
import { useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Zap } from "lucide-react";
import { usePredictionStore, EvidenceItem, AgentPersona, RoundEvent } from "@/lib/stores/predictionStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

const phases = [
  { id: "evidence", label: "Evidence" },
  { id: "graph", label: "Graph" },
  { id: "agents", label: "Agents" },
  { id: "simulation", label: "Debate" },
  { id: "analysis", label: "Synthesis" },
  { id: "report", label: "Report" },
];

const agentColors = [
  "#635BFF",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#60A5FA",
  "#A78BFA",
  "#EC4899",
  "#F97316",
];

const sourceColors: Record<string, string> = {
  arxiv: "#635BFF",
  hn: "#F59E0B",
  reddit: "#EF4444",
  web: "#10B981",
  newsapi: "#60A5FA",
  gnews: "#A78BFA",
  google_news: "#10B981",
  wikipedia: "#60A5FA",
  alpha_vantage: "#22D3EE",
};

// ── Compact phase stepper ──────────────────────────────────────────────────────

function CompactStepper({
  currentPhase,
  status,
}: {
  currentPhase: string;
  status: string;
}) {
  const normalizePhase = (p: string) =>
    p === "agents_final" ? "simulation" : p;
  const phaseOrder = phases.map((p) => p.id);
  const normalized = normalizePhase(currentPhase);
  const currentIdx = phaseOrder.indexOf(normalized);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {phases.map((phase, i) => {
        const isDone =
          status === "complete" ||
          (currentIdx > 0 && i < currentIdx);
        const isActive = normalized === phase.id && status === "running";
        const isPending = !isDone && !isActive;

        return (
          <div key={phase.id} className="flex items-center gap-1">
            <div className="flex items-center gap-1">
              {/* dot */}
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300",
                  isDone && "bg-success",
                  isActive && "bg-accent animate-pulse",
                  isPending && "bg-bg-hover"
                )}
              />
              {/* label — only for done/active phases */}
              {(isDone || isActive) && (
                <span
                  className={cn(
                    "text-[10px] font-mono",
                    isDone && "text-success/80",
                    isActive && "text-accent font-semibold"
                  )}
                >
                  {phase.label}
                </span>
              )}
            </div>
            {/* connector line between dots */}
            {i < phases.length - 1 && (
              <div
                className={cn(
                  "w-3 h-px flex-shrink-0",
                  i < currentIdx ? "bg-success/40" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section A: Evidence ────────────────────────────────────────────────────────

function EvidenceSection({ evidence }: { evidence: EvidenceItem[] }) {
  // Count by source
  const sourceCounts = evidence.reduce<Record<string, number>>((acc, item) => {
    acc[item.source] = (acc[item.source] ?? 0) + 1;
    return acc;
  }, {});

  const visible = evidence.slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Evidence Collected
          </h3>
          <span className="text-xs font-mono text-text-muted">
            · {evidence.length} sources
          </span>
        </div>
        {/* Source breakdown badges */}
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {Object.entries(sourceCounts).slice(0, 5).map(([src, count]) => (
            <span
              key={src}
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                background: `${sourceColors[src] ?? "#635BFF"}20`,
                color: sourceColors[src] ?? "#635BFF",
              }}
            >
              {src.replace(/_/g, " ")} {String(count)}
            </span>
          ))}
        </div>
      </div>

      {/* Grid of evidence cards */}
      <div className="grid grid-cols-2 gap-2">
        <AnimatePresence>
          {visible.map((item, i) => (
            <motion.div
              key={item.url + i}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-bg-card border border-border group"
            >
              {/* Source + link row */}
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    background: `${sourceColors[item.source] ?? "#635BFF"}20`,
                    color: sourceColors[item.source] ?? "#635BFF",
                  }}
                >
                  {item.source.replace(/_/g, " ").toUpperCase()}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  aria-label={`Open source: ${item.title}`}
                >
                  <ExternalLink className="w-3 h-3 text-text-muted" />
                </a>
              </div>

              {/* Title */}
              <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                {item.title}
              </p>

              {/* Scores + sentiment */}
              <div className="flex items-center gap-2">
                {/* Relevance + credibility bars side by side */}
                <div className="flex flex-col gap-0.5 flex-shrink-0 w-14">
                  <div className="h-0.5 w-full rounded-full bg-bg-hover overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round(item.relevance_score * 100)}%` }}
                    />
                  </div>
                  <div className="h-0.5 w-full rounded-full bg-bg-hover overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#10B981]"
                      style={{ width: `${Math.round(item.credibility_score * 100)}%` }}
                    />
                  </div>
                </div>
                {/* Sentiment dot */}
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background:
                      (item.sentiment ?? 0) > 0.1
                        ? "#10B981"
                        : (item.sentiment ?? 0) < -0.1
                        ? "#EF4444"
                        : "#6B7280",
                  }}
                  title={`Sentiment: ${item.sentiment != null ? item.sentiment.toFixed(2) : "n/a"}`}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {evidence.length > 8 && (
        <p className="text-[11px] text-text-muted mt-2 text-center">
          +{evidence.length - 8} more sources collected
        </p>
      )}
    </motion.div>
  );
}

// ── Section B: Agents ──────────────────────────────────────────────────────────

function AgentsSection({ agents }: { agents: AgentPersona[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Agent Swarm</h3>
        <span className="text-xs font-mono text-text-muted">· {agents.length} agents</span>
      </div>

      {/* Horizontal scrolling row */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        <AnimatePresence>
          {agents.map((agent, i) => {
            const color = agentColors[i % agentColors.length];
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]"
              >
                {/* Avatar with colored ring */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: `${color}20`,
                    color,
                    boxShadow: `0 0 0 2px ${color}60`,
                  }}
                >
                  {agent.name[0]}
                </div>
                {/* Name */}
                <span className="text-[10px] font-medium text-text-primary text-center leading-tight line-clamp-1 w-full">
                  {agent.name}
                </span>
                {/* Role */}
                <span className="text-[9px] text-text-muted text-center leading-tight line-clamp-1 w-full">
                  {agent.role}
                </span>
                {/* Bias badge */}
                {agent.behavioral_bias && (
                  <span
                    className="text-[8px] font-mono font-semibold px-1 py-0.5 rounded text-center leading-tight line-clamp-1 w-full"
                    style={{ background: `${color}15`, color }}
                  >
                    {agent.behavioral_bias}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Section C: Live Debate ─────────────────────────────────────────────────────

function LiveDebateSection({
  roundEvents,
  totalRounds,
  agentColorMap,
}: {
  roundEvents: RoundEvent[];
  totalRounds: number;
  agentColorMap: Map<string, string>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new round events come in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [roundEvents]);

  const maxRound = Math.max(...roundEvents.map((e) => e.round));
  const roundProgress = Math.min(maxRound / Math.max(totalRounds, 1), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Agent Debate</h3>
          <span className="text-xs font-mono text-text-muted">
            · Round {maxRound}/{totalRounds}
          </span>
        </div>
        {/* Mini round progress bar */}
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 h-1 rounded-full bg-bg-hover overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.round(roundProgress * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {Math.round(roundProgress * 100)}%
          </span>
        </div>
      </div>

      {/* Chat view — newest at bottom, auto-scroll */}
      <div
        ref={scrollRef}
        className="space-y-4 max-h-[400px] overflow-y-auto scroll-smooth"
        style={{ scrollBehavior: "smooth" }}
      >
        <AnimatePresence>
          {roundEvents.map((ev, i) => {
            const color1 = agentColorMap.get(ev.agent1_name) ?? agentColors[0];
            const color2 = agentColorMap.get(ev.agent2_name) ?? agentColors[1];
            const hasStatements = Boolean(ev.agent1_statement && ev.agent2_statement);

            return (
              <motion.div
                key={`${ev.round}-${ev.agent1_name}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="space-y-2"
              >
                {/* Round number pill + participants */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-2.5 h-2.5 text-accent" />
                    </div>
                    <span className="text-[10px] font-mono text-accent font-semibold">
                      R{ev.round}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted font-medium truncate">
                    {ev.agent1_name} × {ev.agent2_name}
                  </span>
                </div>

                {/* Chat bubbles */}
                {hasStatements && (
                  <div className="space-y-2 ml-1">
                    {/* Agent 1 — left bubble */}
                    <div className="flex items-start gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: `${color1}25`, color: color1 }}
                      >
                        {ev.agent1_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-text-muted mb-0.5">{ev.agent1_name}</div>
                        <div
                          className="p-2 rounded-lg rounded-tl-none bg-bg-hover"
                          style={{ borderLeft: `2px solid ${color1}50` }}
                        >
                          <p className="text-[11px] text-text-secondary leading-relaxed italic">
                            &ldquo;{ev.agent1_statement}&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Agent 2 — right bubble */}
                    <div className="flex items-start gap-2 flex-row-reverse">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: `${color2}25`, color: color2 }}
                      >
                        {ev.agent2_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-text-muted mb-0.5 text-right">{ev.agent2_name}</div>
                        <div
                          className="p-2 rounded-lg rounded-tr-none bg-bg-card"
                          style={{ borderRight: `2px solid ${color2}50` }}
                        >
                          <p className="text-[11px] text-text-secondary leading-relaxed italic">
                            &ldquo;{ev.agent2_statement}&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Key disagreement banner */}
                {ev.key_disagreement && (
                  <div className="ml-5 flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-warning/6 border border-warning/15">
                    <span className="text-[8px] font-mono text-warning/70 flex-shrink-0 mt-0.5 uppercase tracking-wide">
                      Dispute
                    </span>
                    <p className="text-[10px] text-warning/90 leading-snug">
                      {ev.key_disagreement}
                    </p>
                  </div>
                )}

                {/* Summary */}
                <div className="ml-5 p-2 rounded-lg bg-bg-card border border-border">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    {ev.interaction_summary}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Main LiveRunView ───────────────────────────────────────────────────────────

export function LiveRunView() {
  const { status, currentPhase, evidence, agents, roundEvents } =
    usePredictionStore();
  const { rounds: totalRounds } = useSettingsStore();

  // Build a stable name → color map from agents array
  const agentColorMap = useMemo(
    () => new Map<string, string>(agents.map((a, i) => [a.name, agentColors[i % agentColors.length]])),
    [agents]
  );

  return (
    <div className="space-y-4">
      {/* Compact progress stepper */}
      <div className="glass rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-primary">Pipeline</span>
          {status === "running" && (
            <span className="text-[10px] font-mono text-accent animate-pulse">
              Running…
            </span>
          )}
        </div>
        <CompactStepper currentPhase={currentPhase} status={status} />
      </div>

      {/* Section A: Evidence */}
      <AnimatePresence>
        {evidence.length > 0 && (
          <EvidenceSection evidence={evidence} />
        )}
      </AnimatePresence>

      {/* Section B: Agents */}
      <AnimatePresence>
        {agents.length > 0 && (
          <AgentsSection agents={agents} />
        )}
      </AnimatePresence>

      {/* Section C: Live Debate */}
      <AnimatePresence>
        {roundEvents.length > 0 && (
          <LiveDebateSection
            roundEvents={roundEvents}
            totalRounds={totalRounds}
            agentColorMap={agentColorMap}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
