"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPredictionHistory } from "@/lib/api";
import { getConfidenceColor, formatConfidence } from "@/lib/utils";
import { History, Clock, BrainCircuit, BarChart2, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";

interface HistoryItem {
  id: string;
  query: string;
  domain: string | null;
  time_horizon: string | null;
  status: "complete" | "failed" | "running";
  confidence: number | null;
  headline: string | null;
  created_at: string;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Mini SVG arc that shows confidence as a colored arc. */
function ConfidenceArc({ score }: { score: number }) {
  const color = getConfidenceColor(score);
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Full circle circumference
  const circumference = 2 * Math.PI * radius;
  // We use 75% of the circle (270deg) as the track
  const trackFraction = 0.75;
  const fillFraction = trackFraction * score;
  const trackDash = circumference * trackFraction;
  const fillDash = circumference * fillFraction;
  // Rotate so the arc starts at 135deg (bottom-left)
  const rotation = 135;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        {/* Track arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${trackDash} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
        {/* Fill arc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference - fillDash}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - fillDash }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      {/* Score label inside arc */}
      <span
        className="absolute text-[9px] font-bold font-mono tabular-nums"
        style={{ color }}
      >
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: HistoryItem["status"] }) {
  const map: Record<HistoryItem["status"], "success" | "danger" | "warning"> = {
    complete: "success",
    failed: "danger",
    running: "warning",
  };
  return <Badge variant={map[status]}>{status}</Badge>;
}

function HistoryCardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

function SummaryBar({
  predictions,
}: {
  predictions: HistoryItem[];
}) {
  const total = predictions.length;
  const completed = predictions.filter((p) => p.status === "complete");
  const avgConfidence =
    completed.length > 0
      ? completed.reduce((sum, p) => sum + (p.confidence ?? 0), 0) / completed.length
      : null;
  const successRate = total > 0 ? completed.length / total : null;

  return (
    <motion.div
      className="grid grid-cols-3 gap-3 mb-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
    >
      <div className="glass rounded-xl p-4 text-center">
        <Target className="w-4 h-4 text-accent mx-auto mb-1.5" />
        <div className="text-2xl font-bold font-mono gradient-text">{total}</div>
        <div className="text-xs text-text-muted mt-0.5">Total Predictions</div>
      </div>
      <div className="glass rounded-xl p-4 text-center">
        <BarChart2 className="w-4 h-4 text-warning mx-auto mb-1.5" />
        <div
          className="text-2xl font-bold font-mono"
          style={{ color: avgConfidence != null ? getConfidenceColor(avgConfidence) : "var(--text-muted)" }}
        >
          {avgConfidence != null ? formatConfidence(avgConfidence) : "—"}
        </div>
        <div className="text-xs text-text-muted mt-0.5">Avg Confidence</div>
      </div>
      <div className="glass rounded-xl p-4 text-center">
        <CheckCircle2 className="w-4 h-4 text-success mx-auto mb-1.5" />
        <div className="text-2xl font-bold font-mono text-success">
          {successRate != null ? `${Math.round(successRate * 100)}%` : "—"}
        </div>
        <div className="text-xs text-text-muted mt-0.5">Success Rate</div>
      </div>
    </motion.div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { data: predictions = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["history"],
    queryFn: getPredictionHistory,
    refetchInterval: 10_000,
  });

  const grouped = predictions.reduce(
    (acc: Record<string, HistoryItem[]>, p: HistoryItem) => {
      const rawDate =
        p.created_at?.split("T")[0] ?? p.created_at?.split(" ")[0] ?? "Unknown";
      if (!acc[rawDate]) acc[rawDate] = [];
      acc[rawDate].push(p);
      return acc;
    },
    {}
  );

  const handleCardClick = (p: HistoryItem) => {
    if (p.status === "complete") {
      router.push(`/predict?view=${p.id}`);
    } else {
      router.push(`/predict`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-lg shadow-accent/10">
            <History className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prediction History</h1>
            <p className="text-sm text-text-secondary">
              {isLoading
                ? "Loading..."
                : `${predictions.length} total prediction${predictions.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Summary bar — only when we have data */}
        {!isLoading && predictions.length > 0 && (
          <SummaryBar predictions={predictions} />
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <HistoryCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && predictions.length === 0 && (
          <div className="text-center py-24">
            <motion.div
              className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6"
              animate={{
                boxShadow: [
                  "0 0 0px rgba(99,91,255,0)",
                  "0 0 24px rgba(99,91,255,0.3)",
                  "0 0 0px rgba(99,91,255,0)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <BrainCircuit className="w-10 h-10 text-accent/60" />
            </motion.div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              No predictions yet
            </h2>
            <p className="text-sm text-text-muted mb-6 max-w-xs mx-auto">
              Run your first prediction to see your history here.
            </p>
            <Link
              href="/predict"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:shadow-xl"
            >
              <BrainCircuit className="w-4 h-4" />
              Run First Prediction
            </Link>
          </div>
        )}

        {/* Grouped by date */}
        {!isLoading &&
          Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, preds]) => (
              <motion.div
                key={date}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
                {/* Date separator */}
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {formatDateGroup(date)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-muted tabular-nums">
                    {preds.length} prediction{preds.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-2">
                  {preds.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: i * 0.04,
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      whileHover={{ y: -2 }}
                    >
                      <Card
                        className="hover:border-border-strong transition-all duration-200 cursor-pointer group hover:bg-white/[0.04] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                        onClick={() => handleCardClick(p)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              <StatusBadge status={p.status} />
                              {p.domain && (
                                <Badge variant="accent">{p.domain}</Badge>
                              )}
                              {p.time_horizon && (
                                <Badge variant="muted">{p.time_horizon}</Badge>
                              )}
                            </div>

                            {/* Query */}
                            <p className="text-sm font-medium text-text-primary line-clamp-2 group-hover:text-white transition-colors duration-200">
                              {p.query}
                            </p>

                            {/* Headline */}
                            {p.headline && (
                              <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                                {p.headline}
                              </p>
                            )}

                            {/* Timestamp */}
                            <p className="text-[11px] text-text-muted mt-2 font-mono">
                              {formatTimestamp(p.created_at)}
                            </p>
                          </div>

                          {/* Confidence arc */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-2 pt-0.5">
                            {p.confidence != null ? (
                              <ConfidenceArc score={p.confidence} />
                            ) : (
                              <span className="text-xs text-text-muted font-mono w-10 text-center">—</span>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
      </motion.div>
    </div>
  );
}
