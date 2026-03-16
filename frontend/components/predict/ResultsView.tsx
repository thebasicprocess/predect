"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { usePredictionStore, type AgentPersona } from "@/lib/stores/predictionStore";
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
} from "lucide-react";

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
}


const SOURCE_COLORS: Record<string, string> = {
  arxiv: "#635BFF",
  hn: "#F59E0B",
  reddit: "#EF4444",
  google_news: "#10B981",
  wikipedia: "#60A5FA",
  newsapi: "#A78BFA",
  gnews: "#EC4899",
  web: "#F97316",
};

const AGENT_COLORS = ["#635BFF", "#10B981", "#F59E0B", "#EF4444", "#60A5FA", "#A78BFA", "#EC4899", "#F97316"];

export function ResultsView() {
  const { result, status, predictionId, agents, roundEvents, evidence, query } = usePredictionStore();
  const [activeTab, setActiveTab] = useState("report");
  const [copied, setCopied] = useState(false);

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
          <div className="flex-shrink-0">
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
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <p className="text-sm text-text-secondary leading-relaxed">
              {report.verdict}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(
                [
                  { key: "base", label: "Base", color: "#635BFF", icon: Minus },
                  { key: "bull", label: "Bull", color: "#10B981", icon: TrendingUp },
                  { key: "bear", label: "Bear", color: "#EF4444", icon: TrendingDown },
                ] as const
              ).map(({ key, label, color, icon: Icon }) => {
                const scenario = report.scenarios[key];
                return (
                  <div
                    key={key}
                    className="p-3 rounded-lg bg-white/2 border border-border text-center"
                  >
                    <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                    <div
                      className="text-lg font-bold font-mono"
                      style={{ color }}
                    >
                      {Math.round(scenario.probability * 100)}%
                    </div>
                    <div className="text-xs text-text-muted">{label}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Scenarios tab */}
        {activeTab === "scenarios" && (
          <Card>
            <CardHeader>
              <CardTitle>Scenarios</CardTitle>
            </CardHeader>
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
                  </div>
                );
              })}
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
              roundEvents.map((round, i) => {
                const color1 = AGENT_COLORS[(agents as AgentPersona[]).findIndex((a) => a.name === round.agent1_name) % AGENT_COLORS.length] || AGENT_COLORS[0];
                const color2 = AGENT_COLORS[(agents as AgentPersona[]).findIndex((a) => a.name === round.agent2_name) % AGENT_COLORS.length] || AGENT_COLORS[1];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
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
                        <p className="text-xs text-text-secondary mb-3 leading-relaxed">{round.interaction_summary}</p>
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
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                          {round.emergent_claims.map((claim, ci) => (
                            <span key={ci} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                              {claim}
                            </span>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-12 text-text-muted">
                <p className="text-xs">Simulation data not available for this prediction.</p>
              </div>
            )}
          </div>
        )}

        {/* Narratives tab */}
        {activeTab === "narratives" && (
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
        )}

        {/* Evidence / Sources tab */}
        {activeTab === "evidence" && (
          <Card>
            <CardHeader>
              <CardTitle>Evidence Sources</CardTitle>
              <div className="flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-mono text-text-muted">{evidence.length}</span>
              </div>
            </CardHeader>
            {evidence.length > 0 ? (
              <div className="space-y-2">
                {evidence.map((item, i) => {
                  const color = SOURCE_COLORS[item.source] || "#635BFF";
                  return (
                    <motion.div
                      key={item.url}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/2 border border-border group hover:border-border-strong transition-colors"
                    >
                      <div
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{ background: `${color}20`, color }}
                      >
                        {item.source.replace("_", " ").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary line-clamp-2 leading-snug">{item.title}</p>
                        {item.snippet && (
                          <p className="text-[10px] text-text-muted leading-relaxed mt-1 line-clamp-2">{item.snippet}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1">
                            <div className="h-1 w-14 bg-white/8 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.round(item.relevance_score * 100)}%`, background: color }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-text-muted">
                              {Math.round(item.relevance_score * 100)}%
                            </span>
                          </div>
                          {item.published_at && (
                            <span className="text-[10px] text-text-muted truncate">
                              {new Date(item.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 hover:text-accent"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
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
                                  {agent.beliefs.slice(0, 3).map((belief, bi) => (
                                    <div key={bi} className="flex items-start gap-1.5">
                                      <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                                      <p className="text-[11px] text-text-muted leading-relaxed">{belief}</p>
                                    </div>
                                  ))}
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
