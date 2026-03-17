"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPredictionHistory, deletePrediction } from "@/lib/api";
import { getConfidenceColor, formatConfidence } from "@/lib/utils";
import { History, Clock, BrainCircuit, BarChart2, CheckCircle2, Target, Trash2, Search, X, RefreshCw } from "lucide-react";
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
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

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

// ─── Heatmap ────────────────────────────────────────────────────────────────

const WEEKS = 12;
const DAYS = WEEKS * 7; // 84

/** YYYY-MM-DD string for a Date */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns midnight-local Date for a YYYY-MM-DD string */
function fromDateKey(key: string): Date {
  return new Date(key + "T00:00:00");
}

/** Color for a given count */
function cellColor(count: number): string {
  if (count === 0) return "rgba(255,255,255,0.04)";
  if (count === 1) return "#635BFF40";
  if (count === 2) return "#635BFF80";
  return "#635BFF";
}

interface TooltipState {
  x: number;
  y: number;
  date: string;
  count: number;
}

function PredictionHeatmap({ predictions }: { predictions: HistoryItem[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build count map keyed by YYYY-MM-DD
  const countMap = new Map<string, number>();
  for (const p of predictions) {
    const key = p.created_at?.split("T")[0] ?? p.created_at?.split(" ")[0];
    if (key) countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  // Build the 84-day grid ending today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Align end of grid to the end of the current week (Saturday)
  // so columns are always Mon-Sun
  const endDate = new Date(today);
  // dayOfWeek: 0=Sun … 6=Sat; we want to end on the last day of this week
  const dayOfWeek = today.getDay(); // 0-6
  // Days until Saturday (6)
  const daysUntilSat = (6 - dayOfWeek + 7) % 7;
  endDate.setDate(endDate.getDate() + daysUntilSat);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (DAYS - 1));

  // cells[col][row] — col=0 is oldest week, row=0 is Monday (adjusted)
  const cells: { date: string; count: number }[][] = [];
  for (let col = 0; col < WEEKS; col++) {
    cells[col] = [];
    for (let row = 0; row < 7; row++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + col * 7 + row);
      const key = toDateKey(d);
      cells[col][row] = { date: key, count: countMap.get(key) ?? 0 };
    }
  }

  // Month labels: find columns where the month changes (or is the first col)
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < WEEKS; col++) {
    const d = fromDateKey(cells[col][0].date);
    const m = d.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        col,
        label: d.toLocaleString("en-US", { month: "short" }),
      });
      lastMonth = m;
    }
  }

  const CELL = 13; // px cell size
  const GAP = 3;   // px gap
  const LABEL_W = 20; // px left label width
  const MONTH_H = 18; // px month label row height

  const totalW = WEEKS * (CELL + GAP) - GAP;
  const totalH = 7 * (CELL + GAP) - GAP;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<SVGRectElement>, date: string, count: number) => {
      const rect = (e.target as SVGRectElement).getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setTooltip({
        x: rect.left - containerRect.left + CELL / 2,
        y: rect.top - containerRect.top,
        date,
        count,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Only show if predictions span at least 2 different days
  const uniqueDays = new Set(
    predictions
      .map((p) => p.created_at?.split("T")[0] ?? p.created_at?.split(" ")[0])
      .filter(Boolean)
  );
  if (uniqueDays.size < 2) return null;

  return (
    <motion.div
      className="glass rounded-xl p-5 mb-8 overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.18 }}
    >
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
        Activity — last 12 weeks
      </p>

      <div className="relative" ref={containerRef}>
        <svg
          width={LABEL_W + GAP + totalW}
          height={MONTH_H + totalH}
          style={{ display: "block", overflow: "visible" }}
          aria-label="Prediction activity heatmap"
          role="img"
        >
          {/* Month labels */}
          {monthLabels.map(({ col, label }) => (
            <text
              key={`month-${col}`}
              x={LABEL_W + GAP + col * (CELL + GAP)}
              y={MONTH_H - 5}
              fontSize={10}
              fill="rgba(248,248,252,0.35)"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {label}
            </text>
          ))}

          {/* Weekday labels (M W F) */}
          {[
            { row: 0, label: "M" },
            { row: 2, label: "W" },
            { row: 4, label: "F" },
          ].map(({ row, label }) => (
            <text
              key={`wd-${row}`}
              x={0}
              y={MONTH_H + row * (CELL + GAP) + CELL - 2}
              fontSize={9}
              fill="rgba(248,248,252,0.28)"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {label}
            </text>
          ))}

          {/* Cells */}
          {cells.map((week, col) =>
            week.map((cell, row) => {
              const isFuture = cell.date > toDateKey(today);
              const color = isFuture
                ? "rgba(255,255,255,0.02)"
                : cellColor(cell.count);
              const x = LABEL_W + GAP + col * (CELL + GAP);
              const y = MONTH_H + row * (CELL + GAP);
              const delay = (col * 7 + row) * 0.005;

              return (
                <motion.rect
                  key={cell.date}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  ry={2}
                  fill={color}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay,
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                  }}
                  style={{
                    cursor: isFuture ? "default" : "pointer",
                    transformOrigin: `${x + CELL / 2}px ${y + CELL / 2}px`,
                    filter:
                      !isFuture && cell.count >= 3
                        ? "drop-shadow(0 0 4px rgba(99,91,255,0.6))"
                        : "none",
                  }}
                  onMouseEnter={
                    isFuture
                      ? undefined
                      : (e) =>
                          handleMouseEnter(
                            e as unknown as React.MouseEvent<SVGRectElement>,
                            cell.date,
                            cell.count
                          )
                  }
                  onMouseLeave={isFuture ? undefined : handleMouseLeave}
                />
              );
            })
          )}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              key="heatmap-tooltip"
              className="absolute z-50 pointer-events-none"
              style={{
                left: tooltip.x,
                top: tooltip.y - 8,
                transform: "translate(-50%, -100%)",
              }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              <div className="bg-[#1a1a2e] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl shadow-black/40 whitespace-nowrap">
                <p className="text-[11px] font-mono text-text-secondary">
                  {fromDateKey(tooltip.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-[11px] font-semibold text-text-primary">
                  {tooltip.count === 0
                    ? "No predictions"
                    : `${tooltip.count} prediction${tooltip.count !== 1 ? "s" : ""}`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span className="text-[10px] text-text-muted">Less</span>
          {[0, 1, 2, 3].map((level) => (
            <div
              key={level}
              className="rounded-sm"
              style={{
                width: CELL,
                height: CELL,
                backgroundColor: cellColor(level),
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
          ))}
          <span className="text-[10px] text-text-muted">More</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: predictions = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["history"],
    queryFn: getPredictionHistory,
    refetchInterval: 10_000,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: deletePrediction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      setDeletingId(null);
    },
    onError: () => setDeletingId(null),
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const filteredPredictions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = predictions;
    if (domainFilter) result = result.filter((p) => p.domain === domainFilter);
    if (!q) return result;
    return result.filter(
      (p) =>
        p.query.toLowerCase().includes(q) ||
        (p.headline?.toLowerCase().includes(q)) ||
        (p.domain?.toLowerCase().includes(q))
    );
  }, [predictions, searchQuery, domainFilter]);

  const presentDomains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of predictions) {
      if (p.domain) counts.set(p.domain, (counts.get(p.domain) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [predictions]);

  const grouped = useMemo(
    () =>
      filteredPredictions.reduce(
        (acc: Record<string, HistoryItem[]>, p: HistoryItem) => {
          const rawDate =
            p.created_at?.split("T")[0] ?? p.created_at?.split(" ")[0] ?? "Unknown";
          if (!acc[rawDate]) acc[rawDate] = [];
          acc[rawDate].push(p);
          return acc;
        },
        {}
      ),
    [filteredPredictions]
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
                : searchQuery && domainFilter
                ? `${filteredPredictions.length} match${filteredPredictions.length !== 1 ? "es" : ""}`
                : searchQuery
                ? `${filteredPredictions.length} of ${predictions.length} prediction${predictions.length !== 1 ? "s" : ""}`
                : domainFilter
                ? `${filteredPredictions.length} ${domainFilter} prediction${filteredPredictions.length !== 1 ? "s" : ""}`
                : `${predictions.length} total prediction${predictions.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Search */}
        {!isLoading && predictions.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search predictions…"
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-white/2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Domain filter chips */}
        {!isLoading && presentDomains.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {presentDomains.map(([domain, count]) => (
              <button
                key={domain}
                onClick={() => setDomainFilter(domainFilter === domain ? null : domain)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                  domainFilter === domain
                    ? "bg-accent/15 border-accent/30 text-accent"
                    : "border-border text-text-muted hover:border-border-strong hover:text-text-secondary"
                }`}
              >
                {domain}
                <span className="text-[10px] opacity-60 font-mono">{count}</span>
              </button>
            ))}
            {domainFilter && (
              <button
                onClick={() => setDomainFilter(null)}
                className="px-2.5 py-1 rounded-full text-xs text-text-muted hover:text-text-primary border border-transparent hover:border-border transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Summary bar — only when we have data */}
        {!isLoading && predictions.length > 0 && !searchQuery && (
          <SummaryBar predictions={predictions} />
        )}

        {/* Activity heatmap — only shown when predictions span multiple days and not searching */}
        {!isLoading && predictions.length > 0 && !searchQuery && (
          <PredictionHeatmap predictions={predictions} />
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

        {/* No search/filter results */}
        {!isLoading && predictions.length > 0 && (searchQuery || domainFilter) && filteredPredictions.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-8 h-8 text-text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-text-muted">
              {searchQuery
                ? `No predictions match \u201c${searchQuery}\u201d`
                : `No predictions in the \u201c${domainFilter}\u201d domain`}
            </p>
            <button
              onClick={() => { setSearchQuery(""); setDomainFilter(null); }}
              className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Clear filters
            </button>
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

                          {/* Confidence arc + actions */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-2 pt-0.5">
                            {p.confidence != null ? (
                              <ConfidenceArc score={p.confidence} />
                            ) : (
                              <span className="text-xs text-text-muted font-mono w-10 text-center">—</span>
                            )}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const params = new URLSearchParams({ query: p.query });
                                  if (p.domain) params.set("domain", p.domain);
                                  if (p.time_horizon) params.set("time_horizon", p.time_horizon);
                                  router.push(`/predict?${params.toString()}`);
                                }}
                                className="p-1.5 rounded-md hover:bg-accent/15 hover:text-accent text-text-muted"
                                title="Re-run this prediction"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, p.id)}
                                disabled={deletingId === p.id}
                                className="p-1.5 rounded-md hover:bg-danger/15 hover:text-danger text-text-muted disabled:opacity-30"
                                title="Delete prediction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
