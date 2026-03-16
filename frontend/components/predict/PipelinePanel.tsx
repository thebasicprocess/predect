"use client";
import { motion, AnimatePresence } from "framer-motion";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { Progress } from "@/components/ui/Progress";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CheckCircle, Circle, Loader2 } from "lucide-react";

const phases = [
  { id: "evidence", label: "Evidence Collection" },
  { id: "graph", label: "Graph Construction" },
  { id: "agents", label: "Agent Generation" },
  { id: "simulation", label: "Swarm Simulation" },
  { id: "analysis", label: "Synthesis" },
  { id: "report", label: "Report Generation" },
];

export function PipelinePanel() {
  const { status, events, progress, currentPhase } = usePredictionStore();

  if (status === "idle") return null;

  const phaseOrder = phases.map((p) => p.id);
  const currentPhaseIdx = phaseOrder.indexOf(currentPhase);
  const isPhaseDone = (phaseId: string) => {
    if (status === "complete") return true;
    if (status === "error") return false;
    const idx = phaseOrder.indexOf(phaseId);
    return currentPhaseIdx > 0 && idx < currentPhaseIdx;
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">Pipeline Progress</span>
        <Badge
          variant={
            status === "complete"
              ? "success"
              : status === "error"
              ? "danger"
              : "accent"
          }
        >
          {status === "running"
            ? "Running"
            : status === "complete"
            ? "Complete"
            : "Error"}
        </Badge>
      </div>

      <Progress value={progress} showLabel className="mb-4" />

      <div className="space-y-2">
        {phases.map((phase) => {
          const done = isPhaseDone(phase.id);
          const active = currentPhase === phase.id && status === "running";
          return (
            <div key={phase.id} className="flex items-center gap-2.5">
              {done ? (
                <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />
              ) : active ? (
                <Loader2 className="w-3.5 h-3.5 text-accent flex-shrink-0 animate-spin" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              )}
              <span
                className={`text-xs ${
                  done || active ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {events.length > 0 && (
          <motion.div
            key={events[events.length - 1]?.message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 pt-3 border-t border-border"
          >
            <p className="text-xs text-text-muted">
              {events[events.length - 1]?.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
