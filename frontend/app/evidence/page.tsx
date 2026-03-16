"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { collectEvidence } from "@/lib/api";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import {
  FileSearch,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from "lucide-react";

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

interface EvidenceItem {
  id: string;
  title: string;
  url: string;
  source: string;
  snippet: string;
  relevance_score: number;
  credibility_score: number;
  sentiment: number | null;
  entities: string[];
}

// --- Credibility Matrix SVG scatter plot ---

const PLOT_W = 300;
const PLOT_H = 200;
const PAD_L = 28;
const PAD_B = 28;
const PAD_T = 20;
const PAD_R = 16;
const INNER_W = PLOT_W - PAD_L - PAD_R;
const INNER_H = PLOT_H - PAD_T - PAD_B;

function CredibilityMatrix({ items }: { items: EvidenceItem[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    source: string;
  } | null>(null);

  if (items.length === 0) return null;

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75].map((v) => ({
    xPx: PAD_L + v * INNER_W,
    yPx: PAD_T + (1 - v) * INNER_H,
  }));

  return (
    <Card className="mt-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Evidence Credibility Matrix
        </h3>
        <p className="text-xs text-text-muted mt-0.5">
          Relevance vs Credibility — each dot is one evidence item
        </p>
      </div>
      <div className="relative w-full overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
          className="border border-border rounded-lg bg-white/1"
        >
          {/* Quadrant background shading */}
          {/* Top-right = ideal: high cred / high rel */}
          <rect
            x={PAD_L + INNER_W / 2}
            y={PAD_T}
            width={INNER_W / 2}
            height={INNER_H / 2}
            fill="rgba(99,91,255,0.04)"
          />

          {/* Grid lines - vertical */}
          {gridLines.map(({ xPx }, i) => (
            <line
              key={`vg-${i}`}
              x1={xPx}
              y1={PAD_T}
              x2={xPx}
              y2={PAD_T + INNER_H}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ))}
          {/* Grid lines - horizontal */}
          {gridLines.map(({ yPx }, i) => (
            <line
              key={`hg-${i}`}
              x1={PAD_L}
              y1={yPx}
              x2={PAD_L + INNER_W}
              y2={yPx}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ))}

          {/* Center dividers */}
          <line
            x1={PAD_L + INNER_W / 2}
            y1={PAD_T}
            x2={PAD_L + INNER_W / 2}
            y2={PAD_T + INNER_H}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          <line
            x1={PAD_L}
            y1={PAD_T + INNER_H / 2}
            x2={PAD_L + INNER_W}
            y2={PAD_T + INNER_H / 2}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />

          {/* Axes */}
          <line
            x1={PAD_L}
            y1={PAD_T}
            x2={PAD_L}
            y2={PAD_T + INNER_H}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          <line
            x1={PAD_L}
            y1={PAD_T + INNER_H}
            x2={PAD_L + INNER_W}
            y2={PAD_T + INNER_H}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />

          {/* Axis labels */}
          <text
            x={PAD_L + INNER_W / 2}
            y={PLOT_H - 4}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize="8"
            fontFamily="ui-monospace,monospace"
          >
            Relevance →
          </text>
          <text
            x={9}
            y={PAD_T + INNER_H / 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize="8"
            fontFamily="ui-monospace,monospace"
            transform={`rotate(-90, 9, ${PAD_T + INNER_H / 2})`}
          >
            Cred →
          </text>

          {/* Quadrant corner labels */}
          <text
            x={PAD_L + INNER_W - 3}
            y={PAD_T + 10}
            textAnchor="end"
            fill="rgba(99,91,255,0.55)"
            fontSize="6"
            fontFamily="sans-serif"
          >
            High/High
          </text>
          <text
            x={PAD_L + 3}
            y={PAD_T + 10}
            textAnchor="start"
            fill="rgba(255,255,255,0.25)"
            fontSize="6"
            fontFamily="sans-serif"
          >
            Low/High
          </text>
          <text
            x={PAD_L + INNER_W - 3}
            y={PAD_T + INNER_H - 4}
            textAnchor="end"
            fill="rgba(255,255,255,0.25)"
            fontSize="6"
            fontFamily="sans-serif"
          >
            High/Low
          </text>
          <text
            x={PAD_L + 3}
            y={PAD_T + INNER_H - 4}
            textAnchor="start"
            fill="rgba(239,68,68,0.45)"
            fontSize="6"
            fontFamily="sans-serif"
          >
            Low/Low
          </text>

          {/* Dots */}
          {items.map((item) => {
            const cx = PAD_L + item.relevance_score * INNER_W;
            const cy = PAD_T + (1 - item.credibility_score) * INNER_H;
            const color = sourceColors[item.source] || "#635BFF";
            return (
              <circle
                key={item.id}
                cx={cx}
                cy={cy}
                r={4}
                fill={color}
                opacity={0.8}
                className="cursor-pointer"
                onMouseEnter={() =>
                  setTooltip({ x: cx, y: cy, title: item.title, source: item.source })
                }
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

          {/* Tooltip */}
          {tooltip && (() => {
            const ttW = 120;
            const ttH = 28;
            const ttX = Math.min(tooltip.x + 6, PLOT_W - ttW - 4);
            const ttY = Math.max(tooltip.y - ttH - 4, PAD_T);
            return (
              <g>
                <rect
                  x={ttX}
                  y={ttY}
                  width={ttW}
                  height={ttH}
                  rx={4}
                  fill="#1a1a2e"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.5"
                />
                <text
                  x={ttX + 6}
                  y={ttY + 10}
                  fill="rgba(255,255,255,0.7)"
                  fontSize="5.5"
                  fontFamily="sans-serif"
                >
                  {tooltip.source.replace(/_/g, " ").toUpperCase()}
                </text>
                <text
                  x={ttX + 6}
                  y={ttY + 20}
                  fill="rgba(255,255,255,0.9)"
                  fontSize="6"
                  fontFamily="sans-serif"
                >
                  {tooltip.title.slice(0, 26)}
                  {tooltip.title.length > 26 ? "…" : ""}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Source legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(sourceColors)
          .filter(([src]) => items.some((i) => i.source === src))
          .map(([src, color]) => (
            <div key={src} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: color }}
              />
              <span className="text-xs text-text-muted">{src}</span>
            </div>
          ))}
      </div>
    </Card>
  );
}

// --- Main page ---

type SortKey = "relevance" | "credibility" | "sentiment";

export default function EvidencePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");

  const { newsApiKey, gNewsApiKey, alphaVantageKey } = useSettingsStore();

  const handleCollect = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await collectEvidence(query, undefined, {
        newsApiKey,
        gNewsApiKey,
        alphaVantageKey,
      });
      setItems(result.items || []);
    } catch {
      // ignore errors
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Evidence Manager</h1>
            <p className="text-sm text-text-secondary">
              Collect and browse evidence from all sources
            </p>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search query (e.g., 'AI regulation 2025')"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCollect()}
            />
            <Button
              onClick={handleCollect}
              loading={loading}
              disabled={!query.trim()}
            >
              Collect Evidence
            </Button>
          </div>
          {(newsApiKey || gNewsApiKey) && (
            <p className="text-xs text-text-muted mt-2">
              Premium sources active:{" "}
              {[newsApiKey && "NewsAPI", gNewsApiKey && "GNews"]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </Card>

        {/* Skeleton loading state */}
        {loading && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="skeleton h-24 rounded-xl"
              />
            ))}
          </motion.div>
        )}

        {/* Items */}
        {!loading && items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-text-secondary">
                {items.length} items collected
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                  {(["relevance", "credibility", "sentiment"] as SortKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSortBy(key)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono capitalize transition-colors ${
                        sortBy === key
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "text-text-muted hover:text-text-secondary border border-transparent"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              <div className="flex gap-2 flex-wrap">
                {["arxiv", "hn", "reddit", "web", "newsapi", "gnews"].map((src) => {
                  const count = items.filter((i) => i.source === src).length;
                  if (!count) return null;
                  return (
                    <Badge
                      key={src}
                      style={{
                        background: `${sourceColors[src]}20`,
                        color: sourceColors[src],
                        borderColor: `${sourceColors[src]}30`,
                      }}
                    >
                      {src}: {count}
                    </Badge>
                  );
                })}
              </div>
              </div>
            </div>

            <div className="flex justify-end mb-3">
              <button
                onClick={() => router.push(`/predict?query=${encodeURIComponent(query)}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Run Prediction on this query
              </button>
            </div>

            <div className="space-y-3">
              {[...items]
                .sort((a, b) => {
                  if (sortBy === "relevance") return b.relevance_score - a.relevance_score;
                  if (sortBy === "credibility") return b.credibility_score - a.credibility_score;
                  // sentiment: positive first (null treated as 0)
                  return (b.sentiment ?? 0) - (a.sentiment ?? 0);
                })
                .map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="hover:border-border-strong transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge
                          style={{
                            background: `${sourceColors[item.source] || "#635BFF"}20`,
                            color: sourceColors[item.source] || "#635BFF",
                            borderColor: `${sourceColors[item.source] || "#635BFF"}30`,
                          }}
                        >
                          {item.source}
                        </Badge>
                        {item.entities.slice(0, 3).map((e) => (
                          <Badge key={e} variant="muted">
                            {e}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.sentiment !== null &&
                          item.sentiment !== undefined &&
                          (item.sentiment > 0.1 ? (
                            <TrendingUp className="w-3.5 h-3.5 text-success" />
                          ) : item.sentiment < -0.1 ? (
                            <TrendingDown className="w-3.5 h-3.5 text-danger" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-text-muted" />
                          ))}
                        <span className="text-xs font-mono text-accent">
                          {Math.round(item.relevance_score * 100)}% rel
                        </span>
                        <span className="text-xs font-mono text-text-muted">
                          {Math.round(item.credibility_score * 100)}% cred
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors" />
                        </a>
                      </div>
                    </div>
                    <h3 className="text-sm font-medium mb-1.5 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {item.snippet}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Credibility Matrix */}
            <CredibilityMatrix items={items} />
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="text-center py-20">
            <FileSearch className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-2">No evidence collected yet</p>
            <p className="text-xs text-text-muted">
              Enter a search query and click Collect Evidence
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
