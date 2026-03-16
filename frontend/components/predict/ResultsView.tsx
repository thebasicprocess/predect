"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { usePredictionStore, type AgentPersona, type RoundEvent } from "@/lib/stores/predictionStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { getConfidenceColor } from "@/lib/utils";
import { ConfidenceGauge } from "@/components/predict/ConfidenceGauge";
import { TimelineChart } from "@/components/predict/TimelineChart";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Share2,
  Check,
  ExternalLink,
  FileSearch,
  Download,
  Users,
  Link2,
  FileText,
  Search,
  X,
} from "lucide-react";

interface NarrativeCamp {
  narrative: string;
  sentiment: number;
  support_count: number;
  supporting_claims: string[];
  key_agents: string[];
}

interface PredictionResult {
  headline: string;
  verdict: string;
  confidence: { score: number; band: number[]; color: string };
  scenarios: {
    base: { description: string; probability: number };
    bull: { description: string; probability: number };
    bear: { description: string; probability: number };
  };
  keyDrivers: string[];
  riskFactors: string[];
  timelineOutlook: Array<{ period: string; outlook: string }>;
  agentConsensus: number;
  dominantNarratives: string[];
  predictedEvents?: Array<{
    period: string;
    event: string;
    probability: number;
    category: string;
  }>;
  narrativeCamps?: NarrativeCamp[];
  strongest_counter_argument?: string;
  wildcard_factor?: string;
}


const SOURCE_COLORS: Record<string, string> = {
  arxiv: "#635BFF",
  hn: "#F59E0B",
  reddit: "#EF4444",
  google_news: "#10B981",
  wikipedia: "#60A5FA",
  newsapi: "#A78BFA",
  alpha_vantage: "#22D3EE",
  gnews: "#EC4899",
  web: "#F97316",
};

const AGENT_COLORS = ["#635BFF", "#10B981", "#F59E0B", "#EF4444", "#60A5FA", "#A78BFA", "#EC4899", "#F97316"];

export function ResultsView() {
  const { result, status, predictionId, agents, roundEvents, evidence, query, domain, timeHorizon } = usePredictionStore();
  const [activeTab, setActiveTab] = useState("report");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [simViewMode, setSimViewMode] = useState<"rounds" | "agents">("rounds");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [evidenceSort, setEvidenceSort] = useState<"relevance" | "credibility" | "date">("relevance");
  const [evidenceFilter, setEvidenceFilter] = useState("");

  // Claim frequency across all rounds (for "recurring" indicators)
  const claimFreqMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of roundEvents) {
      for (const c of r.emergent_claims) {
        map.set(c, (map.get(c) ?? 0) + 1);
      }
    }
    return map;
  }, [roundEvents]);

  // Consensus progression: per round, fraction of claims that recur in other rounds
  const consensusProgression = useMemo(() => {
    return roundEvents
      .filter((_, i, arr) => {
        // Get unique round numbers
        const seen = new Set<number>();
        return !seen.has(arr[i].round) && seen.add(arr[i].round);
      })
      .reduce((acc: Array<{round: number; score: number}>, _, __, arr) => {
        const rounds = Array.from(new Set(arr.map(r => r.round))).sort((a, b) => a - b);
        for (const rNum of rounds) {
          if (acc.find(a => a.round === rNum)) continue;
          const roundClaims = roundEvents.filter(r => r.round === rNum).flatMap(r => r.emergent_claims);
          if (roundClaims.length === 0) { acc.push({ round: rNum, score: 0 }); continue; }
          const recurring = roundClaims.filter(c => (claimFreqMap.get(c) ?? 0) > 1).length;
          acc.push({ round: rNum, score: recurring / roundClaims.length });
        }
        return acc;
      }, []);
  }, [roundEvents, claimFreqMap]);

  // Agent-centric view: group round events by agent
  const agentRoundMap = useMemo(() => {
    const map = new Map<string, RoundEvent[]>();
    for (const ev of roundEvents) {
      if (!map.has(ev.agent1_name)) map.set(ev.agent1_name, []);
      if (!map.has(ev.agent2_name)) map.set(ev.agent2_name, []);
      map.get(ev.agent1_name)!.push(ev);
      map.get(ev.agent2_name)!.push(ev);
    }
    return map;
  }, [roundEvents]);

  // Evidence source breakdown
  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of evidence) {
      map.set(item.source, (map.get(item.source) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [evidence]);

  // Sorted + filtered evidence list
  const sortedEvidence = useMemo(() => {
    const q = evidenceFilter.trim().toLowerCase();
    let copy = q
      ? evidence.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.snippet ?? "").toLowerCase().includes(q) ||
            e.source.toLowerCase().includes(q)
        )
      : [...evidence];
    if (evidenceSort === "credibility") {
      copy.sort((a, b) => (b.credibility_score ?? 0) - (a.credibility_score ?? 0));
    } else if (evidenceSort === "date") {
      copy.sort((a, b) => {
        const da = a.published_at ? new Date(a.published_at).getTime() : 0;
        const db = b.published_at ? new Date(b.published_at).getTime() : 0;
        return db - da;
      });
    } else {
      copy.sort((a, b) => b.relevance_score - a.relevance_score);
    }
    return copy;
  }, [evidence, evidenceSort, evidenceFilter]);

  // Unique round count
  const totalRounds = useMemo(() => new Set(roundEvents.map((r) => r.round)).size, [roundEvents]);

  if (status !== "complete" || !result) return null;

  const report = result as unknown as PredictionResult;
  const confidenceColor = getConfidenceColor(report.confidence.score);

  const tabs = [
    { id: "report", label: "Report" },
    { id: "scenarios", label: "Scenarios" },
    { id: "drivers", label: "Drivers" },
    { id: "timeline", label: "Timeline" },
    { id: "simulation", label: roundEvents.length > 0 ? `Simulation (${roundEvents.length})` : "Simulation" },
    { id: "narratives", label: "Narratives" },
    { id: "evidence", label: evidence.length > 0 ? `Sources (${evidence.length})` : "Sources" },
    { id: "agents", label: agents.length > 0 ? `Agents (${agents.length})` : "Agents" },
  ];

  const handleShare = async () => {
    const url = `${window.location.origin}/predict?view=${predictionId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers that block clipboard without user gesture
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportJson = () => {
    const data = {
      query,
      report,
      evidence,
      agents,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `predect-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!report) return;
    const conf = report.confidence as { score?: number } | undefined;
    const score = conf?.score ?? 0;
    const scenarios = report.scenarios as { base?: { description: string; probability: number }; bull?: { description: string; probability: number }; bear?: { description: string; probability: number } } | undefined;
    const drivers = (report.keyDrivers as string[]) ?? [];
    const risks = (report.riskFactors as string[]) ?? [];
    const timeline = (report.timelineOutlook as { period: string; outlook: string }[]) ?? [];
    const events = (report.predictedEvents as { period: string; event: string; probability: number; category: string }[]) ?? [];
    const narratives = (report.dominantNarratives as string[]) ?? [];

    const lines: string[] = [
      `# ${report.headline ?? "Prediction Report"}`,
      ``,
      query ? `**Query:** ${query}` : "",
      `**Confidence:** ${Math.round(score * 100)}%`,
      ``,
      `## Verdict`,
      `${report.verdict ?? ""}`,
      ``,
    ];

    if (scenarios) {
      lines.push(`## Scenarios`);
      if (scenarios.base) lines.push(``, `### Base Case (${Math.round((scenarios.base.probability ?? 0) * 100)}%)`, scenarios.base.description ?? "");
      if (scenarios.bull) lines.push(``, `### Bull Case (${Math.round((scenarios.bull.probability ?? 0) * 100)}%)`, scenarios.bull.description ?? "");
      if (scenarios.bear) lines.push(``, `### Bear Case (${Math.round((scenarios.bear.probability ?? 0) * 100)}%)`, scenarios.bear.description ?? "");
      lines.push(``);
    }

    if (drivers.length) {
      lines.push(`## Key Drivers`, drivers.map((d) => `- ${d}`).join("\n"), ``);
    }
    if (risks.length) {
      lines.push(`## Risk Factors`, risks.map((r) => `- ${r}`).join("\n"), ``);
    }
    if (timeline.length) {
      lines.push(`## Timeline Outlook`, ...timeline.map((t) => `**${t.period}:** ${t.outlook}`), ``);
    }
    if (events.length) {
      lines.push(`## Predicted Events`);
      events.forEach((e, i) => {
        lines.push(`${i + 1}. **${e.period}** (${Math.round(e.probability * 100)}%): ${e.event}`);
      });
      lines.push(``);
    }
    if (narratives.length) {
      lines.push(`## Dominant Narratives`, narratives.map((n) => `- ${n}`).join("\n"), ``);
    }

    lines.push(`---`, `*Generated by PREDECT · Z.AI GLM Swarm Intelligence*`);

    const md = lines.filter((l) => l !== undefined).join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `predect-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Headline + Confidence — always visible, not in tabs */}
      <Card glow>
        {query && (
          <p className="text-[11px] text-text-muted font-mono mb-3 leading-snug line-clamp-2 opacity-70">
            &ldquo;{query}&rdquo;
          </p>
        )}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="success">Prediction Complete</Badge>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
                title="Copy share link"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-success" />
                    <span className="text-success">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3 h-3" />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>
            <h2 className="text-xl font-bold leading-tight">{report.headline}</h2>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyLink}
                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                title="Copy link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-success" /> : <Link2 className="w-4 h-4" />}
              </button>
              <button
                onClick={handleExportJson}
                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportMarkdown}
                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                title="Export as Markdown"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
            <ConfidenceGauge
              score={report.confidence.score}
              color={confidenceColor}
            />
          </div>
        </div>
        <p className="text-sm text-text-secondary">{report.verdict}</p>
        {report.agentConsensus !== undefined && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <span className="text-xs text-text-muted">Agent consensus:</span>
            <span className="text-xs font-mono text-text-primary">
              {Math.round(report.agentConsensus * 100)}%
            </span>
          </div>
        )}
      </Card>

      {(domain || timeHorizon || agents.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {domain && <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-border text-text-muted capitalize">{domain}</span>}
          {timeHorizon && <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-border text-text-muted">{timeHorizon}</span>}
          {agents.length > 0 && <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-border text-text-muted">{agents.length} agents</span>}
          {roundEvents.length > 0 && <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-border text-text-muted">{new Set(roundEvents.map(r => r.round)).size} rounds</span>}
        </div>
      )}

      {/* Tab bar */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="space-y-4"
      >
        {/* Report tab */}
        {activeTab === "report" && (
          <div className="space-y-3">
            {/* Confidence band */}
            {Array.isArray(report.confidence.band) && report.confidence.band.length === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Confidence Interval</CardTitle>
                </CardHeader>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono text-text-muted w-8">{Math.round(report.confidence.band[0] * 100)}%</span>
                  <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden relative">
                    <div
                      className="absolute top-0 h-full rounded-full opacity-30"
                      style={{
                        left: `${report.confidence.band[0] * 100}%`,
                        right: `${(1 - report.confidence.band[1]) * 100}%`,
                        background: confidenceColor,
                      }}
                    />
                    <motion.div
                      className="absolute top-0 h-full w-0.5 rounded-full"
                      style={{
                        left: `${report.confidence.score * 100}%`,
                        background: confidenceColor,
                        boxShadow: `0 0 6px ${confidenceColor}`,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    />
                  </div>
                  <span className="text-xs font-mono text-text-muted w-8 text-right">{Math.round(report.confidence.band[1] * 100)}%</span>
                </div>
                <p className="text-[10px] text-text-muted mt-2">
                  Point estimate: <span className="font-mono" style={{ color: confidenceColor }}>{Math.round(report.confidence.score * 100)}%</span>
                  {" · "}range: <span className="font-mono">{Math.round(report.confidence.band[0] * 100)}%–{Math.round(report.confidence.band[1] * 100)}%</span>
                </p>
                <p className="text-[10px] mt-1.5 font-medium" style={{ color: confidenceColor }}>
                  {report.confidence.score >= 0.7
                    ? "Strong consensus — evidence and agents strongly agree"
                    : report.confidence.score >= 0.45
                    ? "Moderate confidence — some conflicting signals present"
                    : "Low confidence — high uncertainty, significantly conflicting views"}
                </p>
              </Card>
            )}

            {/* Scenario probability summary */}
            <Card>
              <CardHeader>
                <CardTitle>Scenario Probabilities</CardTitle>
              </CardHeader>
              <div className="space-y-2.5 mt-1">
                {(
                  [
                    { key: "base", label: "Base Case", color: "#635BFF", icon: Minus },
                    { key: "bull", label: "Bull Case", color: "#10B981", icon: TrendingUp },
                    { key: "bear", label: "Bear Case", color: "#EF4444", icon: TrendingDown },
                  ] as const
                ).map(({ key, label, color, icon: Icon }) => {
                  const scenario = report.scenarios[key];
                  const pct = Math.round(scenario.probability * 100);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                        <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
                        <span className="text-xs text-text-muted">{label}</span>
                      </div>
                      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                        />
                      </div>
                      <span className="text-xs font-mono w-8 text-right flex-shrink-0" style={{ color }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Key stats row */}
            <div className="grid grid-cols-2 gap-3">
              {report.agentConsensus !== undefined && (
                <div className="p-3 rounded-xl bg-white/2 border border-border text-center">
                  <div className="text-xl font-bold font-mono" style={{ color: confidenceColor }}>
                    {Math.round(report.agentConsensus * 100)}%
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">Agent Consensus</div>
                </div>
              )}
              {report.keyDrivers?.length > 0 && (
                <div className="p-3 rounded-xl bg-white/2 border border-border text-center">
                  <div className="text-xl font-bold font-mono text-accent">{report.keyDrivers.length}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Key Drivers</div>
                </div>
              )}
              {report.riskFactors?.length > 0 && (
                <div className="p-3 rounded-xl bg-white/2 border border-border text-center">
                  <div className="text-xl font-bold font-mono text-warning">{report.riskFactors.length}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Risk Factors</div>
                </div>
              )}
              {evidence.length > 0 && (
                <div className="p-3 rounded-xl bg-white/2 border border-border text-center">
                  <div className="text-xl font-bold font-mono text-success">{evidence.length}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Sources</div>
                </div>
              )}
              {agents.length > 0 && (
                <div className="p-3 rounded-xl bg-white/2 border border-border text-center">
                  <div className="text-xl font-bold font-mono" style={{ color: "#635BFF" }}>{agents.length}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Agents</div>
                </div>
              )}
              {totalRounds > 0 && (
                <div className="p-3 rounded-xl bg-white/2 border border-border text-center">
                  <div className="text-xl font-bold font-mono" style={{ color: "#F59E0B" }}>{totalRounds}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Rounds</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scenarios tab */}
        {activeTab === "scenarios" && (
          <Card>
            <CardHeader>
              <CardTitle>Scenarios</CardTitle>
            </CardHeader>
            {/* Stacked proportion bar */}
            <div className="mb-4">
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {([
                  { key: "base", color: "#635BFF" },
                  { key: "bull", color: "#10B981" },
                  { key: "bear", color: "#EF4444" },
                ] as const).map(({ key, color }) => {
                  const pct = Math.round(report.scenarios[key].probability * 100);
                  return (
                    <motion.div
                      key={key}
                      className="h-full rounded-sm"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      title={`${key}: ${pct}%`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                {([
                  { key: "base", label: "Base", color: "#635BFF" },
                  { key: "bull", label: "Bull", color: "#10B981" },
                  { key: "bear", label: "Bear", color: "#EF4444" },
                ] as const).map(({ key, label, color }) => (
                  <span key={key} className="text-[10px] font-mono" style={{ color }}>
                    {label} {Math.round(report.scenarios[key].probability * 100)}%
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {(
                [
                  { key: "base", label: "Base Case", icon: Minus, color: "#635BFF" },
                  { key: "bull", label: "Bull Case", icon: TrendingUp, color: "#10B981" },
                  { key: "bear", label: "Bear Case", icon: TrendingDown, color: "#EF4444" },
                ] as const
              ).map(({ key, label, icon: Icon, color }) => {
                const scenario = report.scenarios[key];
                return (
                  <div
                    key={key}
                    className="p-3 rounded-lg bg-white/2 border border-border"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                        <span
                          className="text-xs font-semibold"
                          style={{ color }}
                        >
                          {label}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-text-muted">
                        {Math.round(scenario.probability * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {scenario.description}
                    </p>
                    <div className="mt-2">
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(scenario.probability * 100)}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Devil's Advocate card — counter-argument and wildcard */}
        {activeTab === "report" && (report.strongest_counter_argument || report.wildcard_factor) && (
          <Card>
            <CardHeader>
              <CardTitle>Devil&apos;s Advocate</CardTitle>
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            </CardHeader>
            <div className="space-y-3">
              {report.strongest_counter_argument && (
                <div>
                  <p className="text-[10px] font-semibold text-warning mb-1 uppercase tracking-wide">Strongest Counter-Argument</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{report.strongest_counter_argument}</p>
                </div>
              )}
              {report.wildcard_factor && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted mb-1 uppercase tracking-wide">Wildcard Factor</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{report.wildcard_factor}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Drivers tab */}
        {activeTab === "drivers" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Key Drivers</CardTitle>
              </CardHeader>
              <ul className="space-y-1.5">
                {report.keyDrivers.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-text-secondary">{d}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Risk Factors</CardTitle>
              </CardHeader>
              <ul className="space-y-1.5">
                {report.riskFactors.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-text-secondary">{r}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* Timeline tab */}
        {activeTab === "timeline" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Timeline Outlook</CardTitle>
                <Clock className="w-3.5 h-3.5 text-text-muted" />
              </CardHeader>
              <TimelineChart items={report.timelineOutlook} />
            </Card>

            {(report.predictedEvents?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Predicted Events Timeline</CardTitle>
                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                </CardHeader>
                <div className="space-y-2.5">
                  {report.predictedEvents!.map((ev, i) => {
                    const prob = ev.probability;
                    const color =
                      prob >= 0.7
                        ? "#10B981"
                        : prob >= 0.5
                        ? "#F59E0B"
                        : "#EF4444";
                    const catColors: Record<string, string> = {
                      market: "#635BFF",
                      regulatory: "#F59E0B",
                      technical: "#10B981",
                      political: "#EF4444",
                      social: "#EC4899",
                      general: "#60A5FA",
                    };
                    const catColor = catColors[ev.category] || "#60A5FA";
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-3"
                      >
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full ring-2 ring-[#0a0a0f] mt-0.5"
                            style={{ background: color }}
                          />
                          {i < report.predictedEvents!.length - 1 && (
                            <div
                              className="w-px flex-1 mt-1 min-h-[20px]"
                              style={{ background: "rgba(255,255,255,0.08)" }}
                            />
                          )}
                        </div>
                        <div className="flex-1 pb-2.5">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-mono text-text-muted">
                              {ev.period}
                            </span>
                            <div
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                background: `${catColor}15`,
                                color: catColor,
                              }}
                            >
                              {ev.category}
                            </div>
                            <span
                              className="ml-auto text-[10px] font-mono"
                              style={{ color }}
                            >
                              {Math.round(prob * 100)}%
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-snug">
                            {ev.event}
                          </p>
                          <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(prob * 100)}%` }}
                              transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.06 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}

        {/* Simulation tab */}
        {activeTab === "simulation" && (
          <div className="space-y-3">
            {roundEvents.length > 0 ? (
              <>
                {/* Consensus progression mini chart */}
                {consensusProgression.length > 1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Consensus Progression</CardTitle>
                      <span className="text-[10px] font-mono text-text-muted">across {consensusProgression.length} rounds</span>
                    </CardHeader>
                    <div className="mt-2">
                      <div className="flex items-end gap-1 h-14">
                        {consensusProgression.map(({ round, score }) => (
                          <div key={round} className="flex-1 flex flex-col items-center gap-1">
                            <motion.div
                              className="w-full rounded-t"
                              style={{ background: score > 0.5 ? "#10B981" : score > 0.25 ? "#F59E0B" : "#635BFF" }}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(4, score * 100)}%` }}
                              transition={{ duration: 0.6, delay: round * 0.08, ease: "easeOut" }}
                            />
                            <span className="text-[9px] font-mono text-text-muted">R{round}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[9px] text-text-muted mt-1">
                        <span>Divergent</span>
                        <span className="text-text-muted">Claim convergence per round</span>
                        <span>Consensus</span>
                      </div>
                    </div>
                  </Card>
                )}

                {/* View toggle */}
                <div className="flex items-center gap-1.5 p-1 bg-white/4 rounded-lg w-fit">
                  <button
                    onClick={() => setSimViewMode("rounds")}
                    className={`text-[11px] px-3 py-1.5 rounded-md transition-all ${simViewMode === "rounds" ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text-secondary"}`}
                  >
                    By Round
                  </button>
                  <button
                    onClick={() => setSimViewMode("agents")}
                    className={`text-[11px] px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${simViewMode === "agents" ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text-secondary"}`}
                  >
                    <Users className="w-3 h-3" />
                    By Agent
                  </button>
                </div>

                {simViewMode === "rounds" ? (
                  // ── Round-first view ──
                  roundEvents.map((round, i) => {
                    const color1 = AGENT_COLORS[(agents as AgentPersona[]).findIndex((a) => a.name === round.agent1_name) % AGENT_COLORS.length] || AGENT_COLORS[0];
                    const color2 = AGENT_COLORS[(agents as AgentPersona[]).findIndex((a) => a.name === round.agent2_name) % AGENT_COLORS.length] || AGENT_COLORS[1];
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <Card>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/6 text-text-muted">
                              Round {round.round}
                            </span>
                            <span className="text-[11px] font-semibold" style={{ color: color1 }}>{round.agent1_name}</span>
                            <span className="text-[10px] text-text-muted">×</span>
                            <span className="text-[11px] font-semibold" style={{ color: color2 }}>{round.agent2_name}</span>
                          </div>
                          {round.interaction_summary && (
                            <p className="text-xs text-text-secondary mb-2 leading-relaxed">{round.interaction_summary}</p>
                          )}
                          {(round as RoundEvent & { key_disagreement?: string }).key_disagreement && (
                            <div className="flex items-start gap-1.5 mb-3 px-2 py-1.5 rounded-lg bg-warning/6 border border-warning/15">
                              <span className="text-[9px] font-mono text-warning/70 flex-shrink-0 mt-0.5 uppercase tracking-wide">Dispute</span>
                              <p className="text-[11px] text-warning/90 leading-snug">{(round as RoundEvent & { key_disagreement?: string }).key_disagreement}</p>
                            </div>
                          )}
                          {(round.agent1_statement || round.agent2_statement) && (
                            <div className="space-y-2 mb-3">
                              {round.agent1_statement && (
                                <div className="flex gap-2">
                                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold" style={{ background: `${color1}25`, color: color1 }}>
                                    {round.agent1_name[0]}
                                  </div>
                                  <div className="text-[11px] text-text-secondary italic leading-relaxed border-l-2 pl-2" style={{ borderColor: `${color1}40` }}>
                                    &ldquo;{round.agent1_statement}&rdquo;
                                  </div>
                                </div>
                              )}
                              {round.agent2_statement && (
                                <div className="flex gap-2">
                                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold" style={{ background: `${color2}25`, color: color2 }}>
                                    {round.agent2_name[0]}
                                  </div>
                                  <div className="text-[11px] text-text-secondary italic leading-relaxed border-l-2 pl-2" style={{ borderColor: `${color2}40` }}>
                                    &ldquo;{round.agent2_statement}&rdquo;
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {round.emergent_claims?.length > 0 && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-[10px] text-text-muted mb-1.5 font-medium">Emergent claims · {round.emergent_claims.length}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {round.emergent_claims.map((claim, ci) => {
                                  const freq = claimFreqMap.get(claim) ?? 1;
                                  return (
                                    <span
                                      key={ci}
                                      className="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1"
                                      style={freq > 1
                                        ? { background: "rgba(99,91,255,0.12)", borderColor: "rgba(99,91,255,0.3)", color: "#635BFF" }
                                        : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(248,248,252,0.5)" }
                                      }
                                    >
                                      {freq > 1 && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" title="Recurring claim" />}
                                      {claim}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })
                ) : (
                  // ── Agent-first view ──
                  Array.from(agentRoundMap.entries()).map(([agentName, agentRounds], ai) => {
                    const agentData = (agents as AgentPersona[]).find(a => a.name === agentName);
                    const color = AGENT_COLORS[ai % AGENT_COLORS.length];
                    return (
                      <motion.div key={agentName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ai * 0.06 }}>
                        <Card>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${color}25`, color }}>
                              {agentName[0]}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-text-primary">{agentName}</div>
                              {agentData && <div className="text-[11px] text-text-muted">{agentData.role}</div>}
                            </div>
                            <div className="text-[10px] font-mono text-text-muted">{agentRounds.length} rounds</div>
                          </div>
                          {/* Conviction trend mini-chart */}
                          {agentData && agentRounds.some(r => r.belief_shifts?.[agentData.id] !== undefined) && (() => {
                            const changes = agentRounds
                              .map(r => r.belief_shifts?.[agentData.id] ?? 0)
                              .filter((_, i) => agentRounds[i].belief_shifts?.[agentData.id] !== undefined);
                            const total = changes.reduce((s, v) => s + v, 0);
                            const totalColor = total > 0.05 ? "#10B981" : total < -0.05 ? "#EF4444" : "#6B7280";
                            return (
                              <div className="mb-3 flex items-center gap-2">
                                <div className="flex items-end gap-0.5 h-6 flex-1">
                                  {agentRounds.map((r, ri) => {
                                    const delta = r.belief_shifts?.[agentData.id] ?? 0;
                                    const barColor = delta > 0 ? "#10B981" : delta < 0 ? "#EF4444" : "#6B7280";
                                    const barH = Math.max(2, Math.abs(delta) / 0.3 * 18);
                                    return (
                                      <div key={ri} className="flex-1 flex flex-col items-center justify-end" title={`R${r.round}: ${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`}>
                                        <div className="w-full rounded-sm" style={{ height: barH, background: barColor, opacity: 0.8 }} />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0">
                                  <span className="text-[9px] font-mono" style={{ color: totalColor }}>
                                    {total > 0 ? "+" : ""}{(total * 100).toFixed(0)}%
                                  </span>
                                  <span className="text-[8px] text-text-muted">conviction</span>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="space-y-2.5 max-h-64 overflow-y-auto">
                            {agentRounds.map((ev, ri) => {
                              const isAgent1 = ev.agent1_name === agentName;
                              const statement = isAgent1 ? ev.agent1_statement : ev.agent2_statement;
                              const opponent = isAgent1 ? ev.agent2_name : ev.agent1_name;
                              if (!statement) return null;
                              return (
                                <div key={ri} className="pl-2 border-l-2" style={{ borderColor: `${color}30` }}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/6 text-text-muted">R{ev.round}</span>
                                    <span className="text-[10px] text-text-muted">vs {opponent}</span>
                                  </div>
                                  <p className="text-[11px] text-text-secondary italic leading-relaxed">&ldquo;{statement}&rdquo;</p>
                                </div>
                              );
                            })}
                          </div>
                          {agentData?.beliefs && agentData.beliefs.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-border">
                              <p className="text-[10px] text-text-muted mb-1.5 font-medium">Final beliefs after simulation</p>
                              <div className="space-y-1">
                                {agentData.beliefs.slice(-3).map((belief, bi) => (
                                  <div key={bi} className="flex items-start gap-1.5">
                                    <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                                    <p className="text-[11px] text-text-muted leading-relaxed">{belief}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </>
            ) : (
              <div className="text-center py-12 text-text-muted">
                <p className="text-xs">Simulation data not available for this prediction.</p>
              </div>
            )}
          </div>
        )}

        {/* Narratives tab */}
        {activeTab === "narratives" && (
          <div className="space-y-3">
            {/* Opinion landscape — narrative camps from glm-5 analysis */}
            {(report.narrativeCamps?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Opinion Landscape</CardTitle>
                  <span className="text-[10px] font-mono text-text-muted">{report.narrativeCamps!.length} camps · glm-5 analysis</span>
                </CardHeader>
                {/* Sentiment bar showing camp balance */}
                <div className="mt-2 mb-4">
                  <div className="flex h-2 rounded-full overflow-hidden gap-px">
                    {report.narrativeCamps!.map((camp, i) => {
                      const campColors = ["#635BFF", "#10B981", "#EF4444", "#F59E0B", "#EC4899"];
                      const color = campColors[i % campColors.length];
                      const total = report.narrativeCamps!.reduce((s, c) => s + Math.max(c.support_count, 1), 0);
                      const pct = Math.round((Math.max(camp.support_count, 1) / total) * 100);
                      return (
                        <motion.div
                          key={i}
                          className="h-full rounded-sm"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.1 }}
                          title={`${camp.narrative}: ${pct}%`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-text-muted">Bearish</span>
                    <span className="text-[9px] text-text-muted">Camp share by claim support</span>
                    <span className="text-[9px] text-text-muted">Bullish</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {report.narrativeCamps!.map((camp, i) => {
                    const campColors = ["#635BFF", "#10B981", "#EF4444", "#F59E0B", "#EC4899"];
                    const color = campColors[i % campColors.length];
                    const sentimentLabel = camp.sentiment > 0.3 ? "Bullish" : camp.sentiment < -0.3 ? "Bearish" : "Neutral";
                    const sentimentColor = camp.sentiment > 0.3 ? "#10B981" : camp.sentiment < -0.3 ? "#EF4444" : "#F59E0B";
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="p-3 rounded-xl border border-border bg-white/2"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: color }} />
                            <span className="text-sm font-semibold text-text-primary leading-snug">{camp.narrative}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${sentimentColor}15`, color: sentimentColor }}>
                              {sentimentLabel}
                            </span>
                            <span className="text-[10px] font-mono text-text-muted">{camp.support_count} claims</span>
                          </div>
                        </div>

                        {/* Sentiment bar */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-[9px] text-text-muted w-12 flex-shrink-0">Sentiment</span>
                          <div className="flex-1 h-1 bg-white/8 rounded-full relative overflow-hidden">
                            <div className="absolute left-1/2 top-0 w-px h-full bg-white/20" />
                            <motion.div
                              className="absolute top-0 h-full rounded-full"
                              style={{
                                background: sentimentColor,
                                left: camp.sentiment > 0 ? "50%" : `${50 + camp.sentiment * 50}%`,
                                width: `${Math.abs(camp.sentiment) * 50}%`,
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.abs(camp.sentiment) * 50}%` }}
                              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.1 }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-text-muted w-10 text-right">
                            {camp.sentiment > 0 ? "+" : ""}{camp.sentiment.toFixed(2)}
                          </span>
                        </div>

                        {/* Supporting claims */}
                        {camp.supporting_claims.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {camp.supporting_claims.map((claim, ci) => (
                              <div key={ci} className="flex items-start gap-1.5">
                                <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: `${color}80` }} />
                                <span className="text-[11px] text-text-muted leading-relaxed">{claim}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Key agents */}
                        {camp.key_agents.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                            <span className="text-[9px] text-text-muted">Represented by:</span>
                            {camp.key_agents.map((agentName, ai) => {
                              const agentIdx = (agents as AgentPersona[]).findIndex(a => a.name === agentName);
                              const agentColor = AGENT_COLORS[agentIdx >= 0 ? agentIdx % AGENT_COLORS.length : ai % AGENT_COLORS.length];
                              return (
                                <span key={ai} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${agentColor}18`, color: agentColor }}>
                                  {agentName}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Dominant narratives — fallback / supplement */}
            <Card>
              <CardHeader>
                <CardTitle>Dominant Narratives</CardTitle>
              </CardHeader>
              {report.dominantNarratives?.length > 0 ? (
                <div className="space-y-2">
                  {report.dominantNarratives.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg bg-white/2"
                    >
                      <span className="text-xs font-mono text-accent flex-shrink-0">
                        #{i + 1}
                      </span>
                      <span className="text-xs text-text-secondary">{n}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  No dominant narratives detected.
                </p>
              )}
            </Card>
          </div>
        )}

        {/* Evidence / Sources tab */}
        {activeTab === "evidence" && (
          <div className="space-y-3">
            {/* Source distribution breakdown */}
            {sourceBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Source Distribution</CardTitle>
                  <span className="text-[10px] font-mono text-text-muted">{evidence.length} items</span>
                </CardHeader>
                <div className="space-y-2 mt-1">
                  {sourceBreakdown.map(([source, count]) => {
                    const color = SOURCE_COLORS[source] || "#635BFF";
                    const pct = Math.round((count / evidence.length) * 100);
                    return (
                      <div key={source} className="flex items-center gap-2">
                        <div className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 w-24" style={{ background: `${color}18`, color }}>
                          {source.replace(/_/g, " ").toUpperCase()}
                        </div>
                        <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-text-muted w-10 text-right">{count} · {pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Evidence Sources</CardTitle>
                <div className="flex items-center gap-1.5">
                  <FileSearch className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-xs font-mono text-text-muted">{evidence.length}</span>
                </div>
              </CardHeader>
              {evidence.length > 0 && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
                    <input
                      type="text"
                      value={evidenceFilter}
                      onChange={(e) => setEvidenceFilter(e.target.value)}
                      placeholder="Filter sources..."
                      className="w-full pl-7 pr-7 py-1 text-[11px] bg-white/4 border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                    />
                    {evidenceFilter && (
                      <button
                        onClick={() => setEvidenceFilter("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {/* Sort buttons */}
                  <div className="flex items-center gap-1 p-1 bg-white/4 rounded-lg flex-shrink-0">
                    {(["relevance", "credibility", "date"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setEvidenceSort(s)}
                        className={`text-[10px] px-2.5 py-1 rounded-md transition-all capitalize ${evidenceSort === s ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text-secondary"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {evidenceFilter && (
                    <span className="text-[10px] font-mono text-text-muted flex-shrink-0">
                      {sortedEvidence.length}/{evidence.length}
                    </span>
                  )}
                </div>
              )}
              {evidence.length > 0 ? (
                <div className="space-y-2">
                  {sortedEvidence.map((item, i) => {
                    const color = SOURCE_COLORS[item.source] || "#635BFF";
                    const isExpanded = expandedItems.has(i);
                    const sentimentVal = (item as any).sentiment as number | null | undefined;
                    const entities = (item as any).entities as string[] | undefined;
                    return (
                      <motion.div
                        key={item.url}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="p-3 rounded-lg bg-white/2 border border-border group hover:border-border-strong transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                            style={{ background: `${color}20`, color }}
                          >
                            {item.source.replace(/_/g, " ").toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary line-clamp-2 leading-snug">{item.title}</p>
                            {item.snippet && (
                              <div>
                                <p className={`text-[10px] text-text-muted leading-relaxed mt-1 ${isExpanded ? "" : "line-clamp-2"}`}>{item.snippet}</p>
                                {item.snippet.length > 120 && (
                                  <button
                                    onClick={() => setExpandedItems(prev => {
                                      const next = new Set(prev);
                                      isExpanded ? next.delete(i) : next.add(i);
                                      return next;
                                    })}
                                    className="text-[10px] text-accent hover:text-accent/80 mt-0.5 transition-colors"
                                  >
                                    {isExpanded ? "Show less" : "Show more"}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Sentiment bar */}
                            {sentimentVal != null && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-text-muted w-12 flex-shrink-0">
                                    {sentimentVal > 0.2 ? "Bullish" : sentimentVal < -0.2 ? "Bearish" : "Neutral"}
                                  </span>
                                  <div className="flex-1 h-1 bg-white/8 rounded-full relative overflow-hidden">
                                    {/* Center marker */}
                                    <div className="absolute left-1/2 top-0 w-px h-full bg-white/20" />
                                    {/* Fill from center */}
                                    <motion.div
                                      className="absolute top-0 h-full rounded-full"
                                      style={{
                                        background: sentimentVal > 0 ? "#10B981" : "#EF4444",
                                        left: sentimentVal > 0 ? "50%" : `${50 + sentimentVal * 50}%`,
                                        width: `${Math.abs(sentimentVal) * 50}%`,
                                      }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.abs(sentimentVal) * 50}%` }}
                                      transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                  </div>
                                  <span className="text-[9px] font-mono text-text-muted w-10 text-right">
                                    {sentimentVal > 0 ? "+" : ""}{sentimentVal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Entity tags */}
                            {entities && entities.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {entities.slice(0, 5).map((entity, ei) => (
                                  <span key={ei} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/6 text-text-muted border border-white/8">
                                    {entity}
                                  </span>
                                ))}
                                {entities.length > 5 && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/4 text-text-muted">
                                    +{entities.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <div className="flex items-center gap-1" title="Relevance score">
                                <div className="h-1 w-12 bg-white/8 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Math.round(item.relevance_score * 100)}%`, background: color }} />
                                </div>
                                <span className="text-[10px] font-mono text-text-muted">{Math.round(item.relevance_score * 100)}% rel</span>
                              </div>
                              {item.credibility_score != null && (
                                <div className="flex items-center gap-1" title="Credibility score">
                                  <div className="h-1 w-12 bg-white/8 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.round(item.credibility_score * 100)}%`, background: "#10B981" }} />
                                  </div>
                                  <span className="text-[10px] font-mono text-text-muted">{Math.round(item.credibility_score * 100)}% cred</span>
                                </div>
                              )}
                              {item.published_at && (
                                <span className="text-[10px] text-text-muted truncate">
                                  {new Date(item.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 hover:text-accent">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileSearch className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
                  <p className="text-xs text-text-muted">No evidence collected.</p>
                  <p className="text-[11px] text-text-muted/60 mt-1">Enable &ldquo;Collect Evidence&rdquo; in settings to gather sources.</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Agents tab */}
        {activeTab === "agents" && (
          <div className="space-y-4">
            {agents.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(agents as AgentPersona[]).map((agent, i) => {
                    const color = AGENT_COLORS[i % AGENT_COLORS.length];
                    return (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 30 }}
                      >
                        <Card>
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                              style={{ background: `${color}25`, color }}
                            >
                              {agent.name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-text-primary">{agent.name}</div>
                              <div className="text-xs text-text-muted mb-2">{agent.role}</div>
                              {agent.behavioral_bias && (
                                <div
                                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold mb-2"
                                  style={{ background: `${color}18`, color }}
                                >
                                  {agent.behavioral_bias}
                                </div>
                              )}
                              {agent.beliefs?.length > 0 && (
                                <div className="space-y-1">
                                  {(expandedAgents.has(agent.id) ? agent.beliefs : agent.beliefs.slice(0, 3)).map((belief, bi) => (
                                    <div key={bi} className="flex items-start gap-1.5">
                                      <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                                      <p className="text-[11px] text-text-muted leading-relaxed">{belief}</p>
                                    </div>
                                  ))}
                                  {agent.beliefs.length > 3 && (
                                    <button
                                      onClick={() => setExpandedAgents(prev => {
                                        const next = new Set(prev);
                                        if (next.has(agent.id)) { next.delete(agent.id); } else { next.add(agent.id); }
                                        return next;
                                      })}
                                      className="text-[10px] text-accent hover:text-accent/80 mt-1 transition-colors"
                                    >
                                      {expandedAgents.has(agent.id) ? "show less" : `show all ${agent.beliefs.length} beliefs`}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Round count for this agent */}
                          {(() => {
                            const participations = roundEvents.filter(
                              (r) => r.agent1_name === agent.name || r.agent2_name === agent.name
                            ).length;
                            return participations > 0 ? (
                              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
                                <span className="text-[10px] text-text-muted">Simulation rounds</span>
                                <span className="text-[10px] font-mono" style={{ color }}>{participations}</span>
                              </div>
                            ) : null;
                          })()}
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
                {/* Agent consensus */}
                {report.agentConsensus !== undefined && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Swarm Consensus</CardTitle>
                    </CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, #635BFF, #10B981)` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round(report.agentConsensus * 100)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-text-muted mt-1">
                          <span>Divergent</span>
                          <span>Consensus</span>
                        </div>
                      </div>
                      <span className="text-2xl font-bold font-mono text-text-primary flex-shrink-0">
                        {Math.round(report.agentConsensus * 100)}%
                      </span>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-text-muted">
                <p className="text-xs">Agent data not available for this prediction.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
