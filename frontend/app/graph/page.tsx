"use client";
import { useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  GraphCanvas,
  type GraphCanvasHandle,
  type GraphNode,
  type GraphEdge,
} from "@/components/graph/GraphCanvas";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getGraphNodes, getGraphEdges, getGraphStats } from "@/lib/api";
import { Network, BarChart3, Plus, Minus, Maximize2 } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  Person: "#635BFF",
  Organization: "#10B981",
  Event: "#F59E0B",
  Location: "#60A5FA",
  Concept: "#A78BFA",
  Prediction: "#EC4899",
};

function GraphPageInner() {
  const searchParams = useSearchParams();
  const predictionId = searchParams.get("prediction_id") ?? undefined;
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const graphRef = useRef<GraphCanvasHandle>(null);

  const { data: nodes = [] } = useQuery<GraphNode[]>({
    queryKey: ["graph-nodes", predictionId],
    queryFn: () => getGraphNodes(500, predictionId),
  });
  const { data: edges = [] } = useQuery<GraphEdge[]>({
    queryKey: ["graph-edges", predictionId],
    queryFn: () => getGraphEdges(1000, predictionId),
  });
  const { data: stats } = useQuery({
    queryKey: ["graph-stats"],
    queryFn: () => getGraphStats(),
  });

  // Search filtering
  const filteredNodes: GraphNode[] =
    searchTerm.trim().length > 0
      ? (nodes as GraphNode[]).filter((n: GraphNode) =>
          n.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [];

  const highlightNodes = new Set(filteredNodes.map((n) => n.id));

  const handleNodeSelect = (n: GraphNode | null) => {
    setSelected(n);
  };

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-56px)] md:overflow-hidden">
      {/* Graph canvas */}
      <div className="relative bg-[#0a0a0f] h-[50vh] md:h-auto md:flex-1">
        <GraphCanvas
          ref={graphRef}
          nodes={nodes}
          edges={edges}
          onNodeSelect={handleNodeSelect}
          highlightNodes={highlightNodes}
        />

        {/* Top-left badges */}
        <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap pointer-events-none">
          <Badge variant="accent">
            <Network className="w-3 h-3 mr-1" />
            Knowledge Graph
          </Badge>
          <Badge variant="muted">
            {nodes.length} nodes · {edges.length} edges
          </Badge>
          {predictionId && (
            <Badge variant="muted">#{predictionId.slice(0, 8)}</Badge>
          )}
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10">
          <button
            onClick={() => graphRef.current?.zoomIn()}
            aria-label="Zoom in"
            className="w-8 h-8 glass rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => graphRef.current?.zoomOut()}
            aria-label="Zoom out"
            className="w-8 h-8 glass rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => graphRef.current?.resetCamera()}
            aria-label="Reset camera"
            className="w-8 h-8 glass rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-[320px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-border overflow-y-auto p-4 space-y-4"
      >
        {/* Node search */}
        <div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search nodes..."
            className="w-full bg-white/4 border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
          {filteredNodes.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {filteredNodes.slice(0, 5).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNodeSelect(n)}
                  className="w-full text-left text-xs px-2 py-1 rounded bg-white/4 hover:bg-white/8 transition-colors truncate text-text-secondary"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle flex-shrink-0"
                    style={{ background: NODE_COLORS[n.type] ?? "#635BFF" }}
                  />
                  {n.name}
                </button>
              ))}
            </div>
          )}
          {searchTerm.trim().length > 0 && filteredNodes.length === 0 && (
            <p className="mt-2 text-xs text-text-muted px-1">No nodes found</p>
          )}
        </div>

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
                {Object.keys(selected.properties).length > 0 && (
                  <div>
                    <div className="text-xs text-text-muted mb-1">
                      Properties
                    </div>
                    <div className="space-y-1">
                      {Object.entries(selected.properties)
                        .slice(0, 4)
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-text-muted capitalize">
                              {k}
                            </span>
                            <span className="font-mono text-text-secondary truncate max-w-[120px]">
                              {String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {!selected && nodes.length === 0 && (
          <div className="text-center py-12">
            <Network className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-xs text-text-muted">
              {predictionId
                ? "No graph nodes for this prediction yet"
                : "Run a prediction to build the knowledge graph"}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-56px)] text-text-muted text-sm">
          Loading graph...
        </div>
      }
    >
      <GraphPageInner />
    </Suspense>
  );
}
