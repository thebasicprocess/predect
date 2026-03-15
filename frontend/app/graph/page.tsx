"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getGraphNodes, getGraphEdges, getGraphStats } from "@/lib/api";
import { Network, BarChart3 } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  Person: "#635BFF",
  Organization: "#10B981",
  Event: "#F59E0B",
  Location: "#60A5FA",
  Concept: "#A78BFA",
  Prediction: "#EC4899",
};

interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

export default function GraphPage() {
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const { data: nodes = [] } = useQuery({
    queryKey: ["graph-nodes"],
    queryFn: () => getGraphNodes(),
  });
  const { data: edges = [] } = useQuery({
    queryKey: ["graph-edges"],
    queryFn: () => getGraphEdges(),
  });
  const { data: stats } = useQuery({
    queryKey: ["graph-stats"],
    queryFn: () => getGraphStats(),
  });

  return (
    <div className="h-[calc(100vh-56px)] flex overflow-hidden">
      {/* Graph canvas */}
      <div className="flex-1 relative bg-[#0a0a0f]">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          onNodeSelect={(n) => setSelected(n as GraphNode | null)}
        />
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Badge variant="accent">
            <Network className="w-3 h-3 mr-1" />
            Knowledge Graph
          </Badge>
          <Badge variant="muted">
            {nodes.length} nodes · {edges.length} edges
          </Badge>
        </div>
      </div>

      {/* Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-[320px] flex-shrink-0 border-l border-border overflow-y-auto p-4 space-y-4"
      >
        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle>Node Types</CardTitle>
          </CardHeader>
          <div className="space-y-1.5">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <span className="text-xs text-text-secondary">{type}</span>
                {stats?.node_types?.[type] !== undefined && (
                  <span className="ml-auto text-xs font-mono text-text-muted">
                    {stats.node_types[type]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Stats */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Graph Stats</CardTitle>
              <BarChart3 className="w-3.5 h-3.5 text-text-muted" />
            </CardHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total nodes</span>
                <span className="font-mono text-text-primary">
                  {stats.node_count}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total edges</span>
                <span className="font-mono text-text-primary">
                  {stats.edge_count}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Selected node */}
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card glow>
              <CardHeader>
                <CardTitle>Selected Node</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Name</div>
                  <div className="text-sm font-medium">{selected.name}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Type</div>
                  <Badge variant="accent">{selected.type}</Badge>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">ID</div>
                  <div className="text-xs font-mono text-text-muted">
                    {selected.id.slice(0, 16)}...
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {!selected && nodes.length === 0 && (
          <div className="text-center py-12">
            <Network className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-xs text-text-muted">
              Run a prediction to build the knowledge graph
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
