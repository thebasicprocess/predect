"use client";
import { motion, AnimatePresence } from "framer-motion";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Activity, Users, FileSearch, MessageSquare, ExternalLink, Zap } from "lucide-react";

const sourceColors: Record<string, string> = {
  arxiv: "#635BFF",
  hn: "#F59E0B",
  reddit: "#EF4444",
  web: "#10B981",
  newsapi: "#60A5FA",
  gnews: "#A78BFA",
};

const agentColors = ["#635BFF", "#10B981", "#F59E0B", "#EF4444", "#60A5FA", "#A78BFA", "#EC4899", "#F97316"];

export function ActivityPanel() {
  const { events, agents, roundEvents, evidence, status } = usePredictionStore();
  const modelEvents = events.filter((e) => e.model && e.task);

  // Build a stable name → color index map from the agents array
  const agentColorMap = new Map<string, string>(
    agents.map((a, i) => [a.name, agentColors[i % agentColors.length]])
  );

  return (
    <div className="space-y-4">
      {/* Live model activity */}
      <Card>
        <CardHeader>
          <CardTitle>Model Activity</CardTitle>
          <Activity className="w-3.5 h-3.5 text-text-muted" />
        </CardHeader>
        <div className="space-y-1.5">
          <AnimatePresence>
            {modelEvents.slice(-5).reverse().map((e, i) => (
              <motion.div
                key={`${e.phase}-${e.step}-${e.task}-${i}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${i === 0 && status === "running" ? "bg-accent/8 border border-accent/20" : "bg-white/2"}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 && status === "running" ? "bg-accent animate-pulse" : "bg-text-muted"}`} />
                <span className="font-mono text-text-primary font-medium">{e.model}</span>
                <span className="text-text-muted">·</span>
                <span className={`text-text-muted ${i === 0 && status === "running" ? "text-accent" : ""}`}>{e.task?.replace(/_/g, " ")}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {modelEvents.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No activity yet</p>
          )}
        </div>
      </Card>

      {/* Evidence collected */}
      {evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evidence Collected</CardTitle>
            <div className="flex items-center gap-1.5">
              <FileSearch className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-mono text-text-muted">{evidence.length}</span>
            </div>
          </CardHeader>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <AnimatePresence>
              {evidence.map((item, i) => (
                <motion.div
                  key={item.url}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-2 p-2 rounded-lg bg-white/2 group"
                >
                  <div
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                    style={{
                      background: `${sourceColors[item.source] || "#635BFF"}20`,
                      color: sourceColors[item.source] || "#635BFF",
                    }}
                  >
                    {item.source.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary line-clamp-1 leading-tight">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-text-muted">
                        {Math.round(item.relevance_score * 100)}% rel
                      </span>
                    </div>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <ExternalLink className="w-3 h-3 text-text-muted" />
                  </a>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      )}

      {/* Agent swarm */}
      {agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Swarm</CardTitle>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-mono text-text-muted">{agents.length}</span>
            </div>
          </CardHeader>
          <div className="space-y-1.5">
            {agents.map((agent, i) => {
              const color = agentColors[i % agentColors.length];
              const firstBelief = agent.beliefs?.[0];
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 30 }}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-white/2"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: `${color}25`, color }}
                  >
                    {agent.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-text-primary truncate">{agent.name}</div>
                    <div className="text-[10px] text-text-muted truncate">{agent.role}</div>
                    {agent.behavioral_bias && (
                      <div
                        className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                        style={{ background: `${color}18`, color }}
                      >
                        {agent.behavioral_bias}
                      </div>
                    )}
                    {firstBelief && (
                      <p className="text-[10px] text-text-muted leading-relaxed mt-1.5 italic line-clamp-2">
                        &ldquo;{firstBelief}&rdquo;
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Live conversation feed */}
      {roundEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Simulation Feed</CardTitle>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-mono text-text-muted">{roundEvents.length}</span>
            </div>
          </CardHeader>
          <div className="space-y-4 max-h-[520px] overflow-y-auto">
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
                    {/* Round header */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <Zap className="w-2.5 h-2.5 text-accent" />
                        </div>
                        <span className="text-[10px] font-mono text-accent">R{ev.round}</span>
                      </div>
                      <span className="text-[10px] text-text-muted font-medium truncate">
                        {ev.agent1_name} × {ev.agent2_name}
                      </span>
                    </div>

                    {/* Chat bubbles */}
                    {hasStatements && (
                      <div className="space-y-2 ml-1">
                        {/* Agent 1 bubble — left */}
                        <div className="flex items-start gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                            style={{ background: `${color1}25`, color: color1 }}
                          >
                            {ev.agent1_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-text-muted mb-0.5">{ev.agent1_name}</div>
                            <div className="p-2 rounded-lg rounded-tl-none bg-white/4 border border-white/8">
                              <p className="text-[11px] text-text-secondary leading-relaxed italic">
                                &ldquo;{ev.agent1_statement}&rdquo;
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Agent 2 bubble — right */}
                        <div className="flex items-start gap-2 flex-row-reverse">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                            style={{ background: `${color2}25`, color: color2 }}
                          >
                            {ev.agent2_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-text-muted mb-0.5 text-right">{ev.agent2_name}</div>
                            <div className="p-2 rounded-lg rounded-tr-none bg-accent/5 border border-accent/10">
                              <p className="text-[11px] text-text-secondary leading-relaxed italic">
                                &ldquo;{ev.agent2_statement}&rdquo;
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="ml-5 p-2 rounded-lg bg-white/3 border border-border">
                      <p className="text-[10px] text-text-muted leading-relaxed">{ev.interaction_summary}</p>
                    </div>

                    {/* Emergent claims */}
                    {ev.emergent_claims.length > 0 && (
                      <div className="ml-5 space-y-1">
                        {ev.emergent_claims.slice(0, 2).map((claim, ci) => (
                          <div key={ci} className="flex items-start gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-accent/60 mt-1.5 flex-shrink-0" />
                            <p className="text-[10px] text-text-muted leading-relaxed">{claim}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>
      )}
    </div>
  );
}
