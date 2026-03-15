"use client";
import { motion } from "framer-motion";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatConfidence, getConfidenceColor } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
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
}

export function ResultsView() {
  const { result, status } = usePredictionStore();

  if (status !== "complete" || !result) return null;

  const report = result as unknown as PredictionResult;
  const confidenceColor = getConfidenceColor(report.confidence.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Headline + Confidence */}
      <Card glow>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Badge variant="success" className="mb-2">
              Prediction Complete
            </Badge>
            <h2 className="text-xl font-bold leading-tight">
              {report.headline}
            </h2>
          </div>
          <div className="text-right flex-shrink-0">
            <div
              className="text-4xl font-bold font-mono"
              style={{ color: confidenceColor }}
            >
              {formatConfidence(report.confidence.score)}
            </div>
            <div className="text-xs text-text-muted">confidence</div>
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

      {/* Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Scenarios</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {(
            [
              {
                key: "base",
                label: "Base Case",
                icon: Minus,
                color: "#635BFF",
              },
              {
                key: "bull",
                label: "Bull Case",
                icon: TrendingUp,
                color: "#10B981",
              },
              {
                key: "bear",
                label: "Bear Case",
                icon: TrendingDown,
                color: "#EF4444",
              },
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
                    <span className="text-xs font-semibold" style={{ color }}>
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

      {/* Key Drivers + Risk Factors */}
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

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline Outlook</CardTitle>
          <Clock className="w-3.5 h-3.5 text-text-muted" />
        </CardHeader>
        <div className="space-y-2">
          {report.timelineOutlook.map((t, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xs font-mono text-accent w-20 flex-shrink-0">
                {t.period}
              </span>
              <span className="text-xs text-text-secondary">{t.outlook}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Dominant narratives */}
      {report.dominantNarratives?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dominant Narratives</CardTitle>
          </CardHeader>
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
        </Card>
      )}
    </motion.div>
  );
}
