"use client";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Settings, Key, Cpu, Sliders } from "lucide-react";

export default function SettingsPage() {
  const {
    agentCount,
    rounds,
    newsApiKey,
    gNewsApiKey,
    alphaVantageKey,
    setAgentCount,
    setRounds,
    setNewsApiKey,
    setGNewsApiKey,
    setAlphaVantageKey,
  } = useSettingsStore();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-text-secondary">
              Configure simulation defaults and API keys
            </p>
          </div>
        </div>

        {/* Simulation defaults */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Simulation Defaults</CardTitle>
            <Sliders className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">Agent count</span>
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
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">
                  Simulation rounds
                </span>
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

        {/* API Keys */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Premium Evidence Sources</CardTitle>
            <Key className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <p className="text-xs text-text-secondary mb-4">
            Keyless sources (ArXiv, HN, Reddit) work without any keys. Add
            premium keys to unlock additional evidence sources.
          </p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">NewsAPI</span>
                <Badge variant={newsApiKey ? "success" : "muted"}>
                  {newsApiKey ? "Active" : "Not set"}
                </Badge>
              </div>
              <Input
                type="password"
                value={newsApiKey}
                onChange={(e) => setNewsApiKey(e.target.value)}
                placeholder="NEWS_API_KEY"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">GNews</span>
                <Badge variant={gNewsApiKey ? "success" : "muted"}>
                  {gNewsApiKey ? "Active" : "Not set"}
                </Badge>
              </div>
              <Input
                type="password"
                value={gNewsApiKey}
                onChange={(e) => setGNewsApiKey(e.target.value)}
                placeholder="GNEWS_API_KEY"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">Alpha Vantage</span>
                <Badge variant={alphaVantageKey ? "success" : "muted"}>
                  {alphaVantageKey ? "Active" : "Not set"}
                </Badge>
              </div>
              <Input
                type="password"
                value={alphaVantageKey}
                onChange={(e) => setAlphaVantageKey(e.target.value)}
                placeholder="ALPHA_VANTAGE_KEY"
              />
            </div>
          </div>
        </Card>

        {/* Model routing info */}
        <Card>
          <CardHeader>
            <CardTitle>Model Routing</CardTitle>
            <Cpu className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <div className="space-y-2">
            {[
              {
                tier: "fast",
                color: "#10B981",
                model: "glm-4.5-air",
                tasks: "Personas, Simulation rounds",
              },
              {
                tier: "balanced",
                color: "#F59E0B",
                model: "glm-4.5",
                tasks: "Entity extraction, Evidence, Graph",
              },
              {
                tier: "premium",
                color: "#8B5CF6",
                model: "glm-4.7",
                tasks: "Synthesis, Confidence, Scoring",
              },
              {
                tier: "top",
                color: "#EF4444",
                model: "glm-5",
                tasks: "Sentiment, Narrative analysis",
              },
            ].map((r) => (
              <div
                key={r.tier}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/2"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: r.color }}
                />
                <span className="text-xs font-mono text-text-primary w-28 sm:w-32 flex-shrink-0">
                  {r.model}
                </span>
                <span className="text-xs text-text-muted">{r.tasks}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
