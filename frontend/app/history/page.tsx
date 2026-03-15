"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getPredictionHistory } from "@/lib/api";
import { getConfidenceColor, formatConfidence } from "@/lib/utils";
import { History, Clock, TrendingUp } from "lucide-react";

interface HistoryItem {
  id: string;
  query: string;
  domain: string;
  status: string;
  confidence: number;
  headline: string | null;
  created_at: string;
}

export default function HistoryPage() {
  const { data: predictions = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["history"],
    queryFn: getPredictionHistory,
  });

  const grouped = predictions.reduce(
    (acc: Record<string, HistoryItem[]>, p: HistoryItem) => {
      const date =
        p.created_at?.split("T")[0] ||
        p.created_at?.split(" ")[0] ||
        "Unknown";
      if (!acc[date]) acc[date] = [];
      acc[date].push(p);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <History className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prediction History</h1>
            <p className="text-sm text-text-secondary">
              {predictions.length} total predictions
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && predictions.length === 0 && (
          <div className="text-center py-20">
            <History className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-2">No predictions yet</p>
            <p className="text-xs text-text-muted">
              Run your first prediction to see it here
            </p>
          </div>
        )}

        {Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, preds]) => (
            <motion.div
              key={date}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-medium text-text-muted">
                  {date}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {preds.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="hover:border-border-strong transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge
                              variant={
                                p.status === "complete"
                                  ? "success"
                                  : p.status === "failed"
                                  ? "danger"
                                  : "warning"
                              }
                            >
                              {p.status}
                            </Badge>
                            {p.domain && (
                              <Badge variant="muted">{p.domain}</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium line-clamp-1">
                            {p.query}
                          </p>
                          {p.headline && (
                            <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                              {p.headline}
                            </p>
                          )}
                        </div>
                        {p.confidence != null && (
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            <TrendingUp
                              className="w-3.5 h-3.5"
                              style={{
                                color: getConfidenceColor(p.confidence),
                              }}
                            />
                            <span
                              className="text-sm font-bold font-mono"
                              style={{
                                color: getConfidenceColor(p.confidence),
                              }}
                            >
                              {formatConfidence(p.confidence)}
                            </span>
                          </div>
                        )}
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
