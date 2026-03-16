"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  BrainCircuit,
  Network,
  FileSearch,
  Zap,
  ChevronRight,
  BarChart3,
  ArrowRight,
  Activity,
  Cpu,
  Database,
  Radio,
} from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Evidence Collection",
    description:
      "Autonomously scans Google News, Wikipedia, Hacker News, Reddit, and ArXiv. Zero API keys required.",
    badge: "Keyless",
    color: "#10B981",
    glow: "rgba(16, 185, 129, 0.15)",
  },
  {
    icon: BrainCircuit,
    title: "Swarm Simulation",
    description:
      "8+ AI agents with distinct personas debate your prediction through multiple interaction rounds.",
    badge: "GLM-4.5-Air",
    color: "#635BFF",
    glow: "rgba(99, 91, 255, 0.15)",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    description:
      "Entities and relationships extracted from evidence build an explorable graph over time.",
    badge: "SQLite",
    color: "#A78BFA",
    glow: "rgba(167, 139, 250, 0.15)",
  },
  {
    icon: BarChart3,
    title: "Structured Reports",
    description:
      "Confidence scores, scenario trees, timeline forecasts, and dominant narrative clusters.",
    badge: "GLM-4.7",
    color: "#60A5FA",
    glow: "rgba(96, 165, 250, 0.15)",
  },
];

const stats = [
  { label: "AI Models", value: "4", icon: Cpu, suffix: "" },
  { label: "Agents per Prediction", value: "8+", icon: Activity, suffix: "" },
  { label: "Evidence Sources", value: "5", icon: Database, suffix: "" },
  { label: "Streaming Pipeline", value: "SSE", icon: Radio, suffix: "" },
];

const steps = [
  {
    n: "01",
    title: "Enter your question",
    desc: "Any topic: markets, geopolitics, technology, sports.",
  },
  {
    n: "02",
    title: "Evidence collection",
    desc: "PREDECT searches academic papers, forums, and the web.",
  },
  {
    n: "03",
    title: "Swarm simulation",
    desc: "Diverse AI agents debate the topic through structured rounds.",
  },
  {
    n: "04",
    title: "Prediction report",
    desc: "Confidence score, scenarios, drivers, and risk factors.",
  },
];

const examples = [
  {
    query: "Will the Fed cut rates before Q3 2026?",
    confidence: 0.72,
    domain: "Finance",
  },
  {
    query: "OpenAI GPT-5 release timeline",
    confidence: 0.61,
    domain: "Technology",
  },
  {
    query: "Euro 2026 winner prediction",
    confidence: 0.48,
    domain: "Sports",
  },
];

const models = [
  {
    model: "glm-4.5-air",
    task: "Persona & Simulation",
    color: "#10B981",
  },
  {
    model: "glm-4.5",
    task: "Evidence & Graph",
    color: "#F59E0B",
  },
  {
    model: "glm-4.7",
    task: "Synthesis & Scoring",
    color: "#8B5CF6",
  },
  {
    model: "glm-5",
    task: "Sentiment & Narrative",
    color: "#EF4444",
  },
];

function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 0.7 ? "#10B981" : score >= 0.5 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${score * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="text-sm font-bold font-mono w-10 text-right" style={{ color }}>
        {Math.round(score * 100)}%
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="hero-bg relative overflow-hidden px-4 sm:px-6 pt-20 sm:pt-28 pb-28 sm:pb-36">
        {/* Floating glow orbs */}
        <motion.div
          className="absolute top-16 left-1/4 w-72 h-72 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(99,91,255,0.25) 0%, transparent 70%)",
          }}
          animate={{ y: [0, -22, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-32 right-1/5 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          }}
          animate={{ y: [0, 18, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute bottom-8 left-1/3 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)",
          }}
          animate={{ y: [0, -14, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="accent" size="md" className="mb-6 shadow-lg shadow-accent/20">
              <Zap className="w-3 h-3 mr-1" />
              Powered by Z.AI GLM Swarm Intelligence
            </Badge>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Feed it{" "}
            <span
              className="gradient-text"
              style={{ filter: "drop-shadow(0 0 28px rgba(99,91,255,0.5))" }}
            >
              reality
            </span>
            <br />
            It returns the{" "}
            <span
              className="gradient-text"
              style={{ filter: "drop-shadow(0 0 28px rgba(167,139,250,0.5))" }}
            >
              future
            </span>
          </motion.h1>

          <motion.p
            className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            PREDECT collects evidence from across the web, runs a swarm of AI
            agents through a structured simulation, and synthesizes a prediction
            with confidence scores, scenario trees, and a knowledge graph.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link href="/predict">
              <Button size="lg" className="group shadow-xl shadow-accent/30">
                Start Predicting
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Button>
            </Link>
            <Link href="/graph">
              <Button size="lg" variant="outline">
                Explore Graph
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 30 }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <stat.icon className="w-3.5 h-3.5 text-accent/70" />
                  <div className="text-3xl font-bold font-mono gradient-text">
                    {stat.value}
                    {stat.suffix}
                  </div>
                </div>
                <div className="text-xs text-text-muted uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold mb-3">How it works</h2>
          <p className="text-text-secondary">
            Four AI-powered stages from question to prediction
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: i * 0.1,
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              whileHover={{ y: -4 }}
            >
              <Card
                className="h-full transition-all duration-300 hover:border-border-strong"
                style={{
                  ["--card-glow" as string]: f.glow,
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 border"
                  style={{
                    background: f.glow,
                    borderColor: `${f.color}33`,
                    boxShadow: `0 0 16px ${f.glow}`,
                  }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <Badge variant="muted" className="mb-3">
                  {f.badge}
                </Badge>
                <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {f.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Steps — four-phase pipeline */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-y border-border bg-white/[0.015]">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-3xl font-bold text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Four-phase pipeline
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                className="relative text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: i * 0.12,
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                {/* Connector line between steps (desktop only, not last) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block step-connector-animated" />
                )}

                {/* Step number bubble */}
                <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full border border-accent/30 bg-accent/10 mb-4 mx-auto">
                  <div
                    className="text-lg font-bold font-mono gradient-text"
                  >
                    {step.n}
                  </div>
                </div>

                <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Example predictions */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 max-w-4xl mx-auto">
        <motion.h2
          className="text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Example predictions
        </motion.h2>
        <div className="space-y-3">
          {examples.map((ex, i) => (
            <motion.div
              key={ex.query}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: i * 0.1,
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              whileHover={{ y: -2 }}
            >
              <Link href={`/predict?query=${encodeURIComponent(ex.query)}`}>
                <Card className="flex items-center justify-between gap-3 hover:border-accent/40 transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,91,255,0.15)] cursor-pointer group">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Badge variant="muted" className="flex-shrink-0">
                      {ex.domain}
                    </Badge>
                    <span className="text-sm truncate group-hover:text-text-primary transition-colors">{ex.query}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <ConfidenceBar score={ex.confidence} />
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-200" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/predict">
            <Button variant="outline">Run your own prediction</Button>
          </Link>
        </div>
      </section>

      {/* Model orchestration */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-t border-border bg-white/[0.015]">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-3">
              Intelligent model routing
            </h2>
            <p className="text-text-secondary mb-10">
              Each task is routed to the optimal GLM model — fast models for
              high-volume simulation, premium models for synthesis.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {models.map((m, i) => (
                <motion.div
                  key={m.model}
                  className="glass rounded-xl p-4 text-left hover:border-border-strong transition-all duration-200"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: i * 0.08,
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                  whileHover={{ y: -3 }}
                >
                  <div
                    className="w-2 h-2 rounded-full mb-3"
                    style={{
                      background: m.color,
                      boxShadow: `0 0 8px ${m.color}`,
                    }}
                  />
                  <div className="font-mono text-xs font-bold mb-1 text-text-primary">
                    {m.model}
                  </div>
                  <div className="text-xs text-text-muted">{m.task}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 sm:px-6 py-24 sm:py-32 text-center overflow-hidden">
        {/* CTA background orbs */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(99,91,255,0.12) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)",
          }}
          animate={{ y: [0, -16, 0], x: [0, 8, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)",
          }}
          animate={{ y: [0, 12, 0], x: [0, -10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Ready to predict?
          </h2>
          <p className="text-text-secondary mb-8 max-w-lg mx-auto text-lg">
            No API keys required. PREDECT works out of the box with keyless
            evidence sources.
          </p>
          <Link href="/predict">
            <Button size="lg" className="shadow-2xl shadow-accent/40">
              <Zap className="w-4 h-4" />
              Launch Prediction Engine
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
