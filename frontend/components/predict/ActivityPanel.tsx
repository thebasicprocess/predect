"use client";
import { motion, AnimatePresence } from "framer-motion";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ModelBadge } from "@/components/ui/ModelBadge";
import { Activity, Users } from "lucide-react";

export function ActivityPanel() {
  const { events, agents, status } = usePredictionStore();

  const modelEvents = events.filter((e) => e.model && e.task);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Model Activity</CardTitle>
          <Activity className="w-3.5 h-3.5 text-text-muted" />
        </CardHeader>
        <div className="space-y-2">
          <AnimatePresence>
            {modelEvents
              .slice(-6)
              .reverse()
              .map((e, i) => (
                <motion.div
                  key={`${e.phase}-${e.step}-${i}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ModelBadge
                    model={e.model || ""}
                    task={e.task}
                    active={i === 0 && status === "running"}
                    tokens={e.tokens}
                  />
                </motion.div>
              ))}
          </AnimatePresence>
          {modelEvents.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">
              No activity yet
            </p>
          )}
        </div>
      </Card>

      {agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Swarm</CardTitle>
            <Users className="w-3.5 h-3.5 text-text-muted" />
          </CardHeader>
          <div className="space-y-2">
            {(
              agents as Array<{
                id: string;
                name: string;
                role: string;
                behavioral_bias: string;
              }>
            ).map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 p-2 rounded-lg bg-white/2"
              >
                <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                  {agent.name[0]}
                </div>
                <div>
                  <div className="text-xs font-medium">{agent.name}</div>
                  <div className="text-xs text-text-muted">{agent.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
