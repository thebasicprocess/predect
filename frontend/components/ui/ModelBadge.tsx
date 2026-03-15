"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModelBadgeProps {
  model: string;
  task?: string;
  tier?: "fast" | "balanced" | "premium";
  active?: boolean;
  tokens?: number;
}

const tierDots = {
  fast: "bg-success",
  balanced: "bg-warning",
  premium: "bg-danger",
};

const tierColors = {
  fast: "text-success",
  balanced: "text-warning",
  premium: "text-danger",
};

export function ModelBadge({
  model,
  task,
  tier = "balanced",
  active,
  tokens,
}: ModelBadgeProps) {
  return (
    <motion.div
      layout
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg glass text-xs",
        active && "border-accent/30 bg-accent/5"
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          tierDots[tier],
          active && "animate-pulse"
        )}
      />
      <span className="font-mono text-text-primary font-medium">{model}</span>
      {task && <span className="text-text-muted">·</span>}
      {task && (
        <span
          className={cn("text-text-muted", active && tierColors[tier])}
        >
          {task.replace(/_/g, " ")}
        </span>
      )}
      {tokens && (
        <span className="ml-auto text-text-muted font-mono">
          {tokens.toLocaleString()}t
        </span>
      )}
    </motion.div>
  );
}
