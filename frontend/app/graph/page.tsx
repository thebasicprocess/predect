"use client";
import { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import { Network, BarChart3, Plus, Minus, Maximize2, ArrowRight } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  Person: "#635BFF",
  Organization: "#10B981",
  Event: "#F59E0B",
  Location: "#60A5FA",
  Concept: "#A78BFA",
  Prediction: "#EC4899",
};

const NODE_TYPES = Object.keys(NODE_COLORS) as Array<keyof typeof NODE_COLORS>;

interface GraphStats {
  node_count: number;
  edge_count: number;
  node_types?: Record<string, number>;
}

function GraphPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const predictionId = searchParams.get("prediction_id") ?? undefined;
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Set of node types that are currently hidden (toggled off)
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const graphRef = useRef<GraphCanvasHandle>(null);

  const { data: nodes = [] } = useQuery<GraphNode[]>({
    queryKey: ["graph-nodes", predictionId],
    queryFn: () => getGraphNodes(500, predictionId),
  });
  const { data: edges = [] } = useQuery<GraphEdge[]>({
    queryKey: ["graph-edges", predictionId],
    queryFn: () => getGraphEdges(1000, predictionId),
  });
  const { data: stats } = useQuery<GraphStats>({
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

  const toggleType = (type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // All edges connected to the selected node
  const allConnectedEdges: Array<{ edge: GraphEdge; connectedNode: GraphNode }> =
    selected
      ? edges
          .filter(
            (e) =>
              e.source_id === selected.id || e.target_id === selected.id
          )
          .map((e) => {
            const connectedId =
              e.source_id === selected.id ? e.target_id : e.source_id;
            const connectedNode = nodes.find((n) => n.id === connectedId);
            return connectedNode ? { edge: e, connectedNode } : null;
          })
          .filter((item): item is { edge: GraphEdge; connectedNode: GraphNode } => item !== null)
      : [];

  const connectedEdges = allConnectedEdges.slice(0, 5);

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
          hiddenTypes={hiddenTypes}
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

        {/* Node type filter pills */}
        <div>
          <p className="text-xs text-text-muted mb-2 font-medium uppercase tracking-wide">
            Filter by type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {NODE_TYPES.map((type) => {
              const isActive = !hiddenTypes.has(type);
              const color = NODE_COLORS[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  aria-pressed={isActive}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border"
                  style={
                    isActive
                      ? {
                          background: `${color}22`,
                          borderColor: `${color}66`,
                          color,
                        }
                      : {
                          background: "transparent",
                          borderColor: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.3)",
                        }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: isActive ? color : "rgba(255,255,255,0.2)" }}
                  />
                  {type}
                </button>
              );
            })}
          </div>
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
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
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

                  {/* Connections section */}
                  {connectedEdges.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-xs text-text-muted">Connections</div>
                        <div className="text-[10px] font-mono text-text-muted">{allConnectedEdges.length} total</div>
                      </div>
                      <div className="space-y-1.5">
                        {connectedEdges.map(({ edge, connectedNode }) => (
                          <button
                            key={edge.id}
                            onClick={() => handleNodeSelect(connectedNode)}
                            className="w-full flex items-center gap-2 text-xs bg-white/4 hover:bg-white/8 rounded-lg px-2.5 py-1.5 transition-colors group text-left"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background:
                                  NODE_COLORS[connectedNode.type] ?? "#635BFF",
                              }}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-text-muted font-mono truncate">
                                {edge.relationship.replace(/_/g, " ").toLowerCase()}
                              </span>
                              <span className="block text-text-secondary truncate">
                                {connectedNode.name}
                              </span>
                            </span>
                            <ArrowRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                          </button>
                        ))}
                        {allConnectedEdges.length > 5 && (
                          <p className="text-[10px] text-text-muted text-center pt-1">
                            +{allConnectedEdges.length - 5} more connections
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!selected && nodes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 px-2"
          >
            <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mx-auto mb-4">
              <Network className="w-6 h-6 text-text-muted" />
            </div>
            {predictionId ? (
              <>
                <p className="text-sm text-text-secondary font-medium mb-1">
                  No graph data yet
                </p>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">
                  This prediction hasn&apos;t generated any knowledge graph
                  nodes. Try re-running it with evidence collection enabled.
                </p>
                <button
                  onClick={() => router.push("/predict")}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 transition-colors"
                >
                  Run a prediction
                  <ArrowRight className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary font-medium mb-1">
                  Graph is empty
                </p>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">
                  Run a prediction to build the knowledge graph. Entities,
                  events, and relationships will appear here automatically.
                </p>
                <button
                  onClick={() => router.push("/predict")}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 transition-colors"
                >
                  Go to predictions
                  <ArrowRight className="w-3 h-3" />
                </button>
              </>
            )}
          </motion.div>
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
