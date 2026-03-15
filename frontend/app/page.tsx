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
} from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Evidence Collection",
    description:
      "Autonomously scans ArXiv, Hacker News, Reddit, and the web. Zero API keys required.",
    badge: "Keyless",
  },
  {
    icon: BrainCircuit,
    title: "Swarm Simulation",
    description:
      "8+ AI agents with distinct personas debate your prediction through multiple interaction rounds.",
    badge: "GLM-4-Flash",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    description:
      "Entities and relationships extracted from evidence build an explorable graph over time.",
    badge: "SQLite",
  },
  {
    icon: BarChart3,
    title: "Structured Reports",
    description:
      "Confidence scores, scenario trees, timeline forecasts, and dominant narrative clusters.",
    badge: "GLM-4",
  },
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
    model: "glm-4-flash",
    task: "Persona & Simulation",
    color: "#10B981",
  },
  {
    model: "glm-4-air",
    task: "Evidence & Graph",
    color: "#F59E0B",
  },
  {
    model: "glm-4",
    task: "Synthesis & Scoring",
    color: "#EF4444",
  },
  {
    model: "glm-4-plus",
    task: "Sentiment & Narrative",
    color: "#EF4444",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="hero-bg relative overflow-hidden px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="accent" size="md" className="mb-6">
              <Zap className="w-3 h-3 mr-1" />
              Powered by Z.AI GLM Swarm Intelligence
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Feed it{" "}
            <span className="gradient-text">reality</span>
            <br />
            It returns the{" "}
            <span className="gradient-text">future</span>
          </motion.h1>

          <motion.p
            className="text-lg text-text-secondary max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            PREDECT collects evidence from across the web, runs a swarm of AI
            agents through a structured simulation, and synthesizes a structured
            prediction with confidence scores, scenario trees, and a knowledge
            graph.
          </motion.p>

          <motion.div
            className="flex items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link href="/predict">
              <Button size="lg" className="group">
                Start Predicting
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
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

      {/* Features */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-12"
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
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full hover:border-border-strong transition-colors duration-300">
                <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-accent" />
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

      {/* How it works steps */}
      <section className="px-6 py-20 border-y border-border bg-white/1">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-3xl font-bold text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Four-phase pipeline
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-4xl font-bold font-mono gradient-text mb-3">
                  {step.n}
                </div>
                <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-text-secondary">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Example predictions */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
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
              transition={{ delay: i * 0.1 }}
            >
              <Card className="flex items-center justify-between hover:border-border-strong transition-colors">
                <div className="flex items-center gap-3">
                  <Badge variant="muted">{ex.domain}</Badge>
                  <span className="text-sm">{ex.query}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div
                    className="text-sm font-bold font-mono"
                    style={{
                      color:
                        ex.confidence >= 0.7
                          ? "#10B981"
                          : ex.confidence >= 0.5
                          ? "#F59E0B"
                          : "#EF4444",
                    }}
                  >
                    {Math.round(ex.confidence * 100)}%
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </Card>
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
      <section className="px-6 py-20 border-t border-border bg-white/1">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {models.map((m) => (
                <div key={m.model} className="glass rounded-xl p-4 text-left">
                  <div
                    className="w-2 h-2 rounded-full mb-3"
                    style={{ background: m.color }}
                  />
                  <div className="font-mono text-xs font-bold mb-1">
                    {m.model}
                  </div>
                  <div className="text-xs text-text-muted">{m.task}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold mb-4">Ready to predict?</h2>
          <p className="text-text-secondary mb-8 max-w-lg mx-auto">
            No API keys required. PREDECT works out of the box with keyless
            evidence sources.
          </p>
          <Link href="/predict">
            <Button size="lg">
              <Zap className="w-4 h-4" />
              Launch Prediction Engine
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
