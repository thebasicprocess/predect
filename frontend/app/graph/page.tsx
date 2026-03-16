"use client";
import { useState, useRef, useMemo, Suspense } from "react";
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
import { getGraphNodes, getGraphEdges, getGraphStats, getNodePredictions } from "@/lib/api";
import {
  Network,
  BarChart3,
  Plus,
  Minus,
  Maximize2,
  ArrowRight,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
  // Set of node types that are active (additive filter — empty = show all)
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  const graphRef = useRef<GraphCanvasHandle>(null);

  const { data: nodes = [], isLoading: isLoadingNodes } = useQuery<GraphNode[]>({
    queryKey: ["graph-nodes", predictionId],
    queryFn: () => getGraphNodes(500, predictionId),
  });
  const { data: edges = [], isLoading: isLoadingEdges } = useQuery<GraphEdge[]>({
    queryKey: ["graph-edges", predictionId],
    queryFn: () => getGraphEdges(1000, predictionId),
  });
  const { data: stats } = useQuery<GraphStats>({
    queryKey: ["graph-stats"],
    queryFn: () => getGraphStats(),
  });

  // Derive hiddenTypes from typeFilter (canvas uses subtractive approach)
  const hiddenTypes = useMemo<Set<string>>(() => {
    if (typeFilter.size === 0) return new Set();
    return new Set(NODE_TYPES.filter((t) => !typeFilter.has(t)));
  }, [typeFilter]);

  // Types that actually appear in the loaded data
  const presentTypes = useMemo(
    () => Array.from(new Set(nodes.map((n: GraphNode) => n.type))).sort(),
    [nodes]
  );

  // Visible node ids based on type filter
  const visibleNodeIds = useMemo(() => {
    if (typeFilter.size === 0) return new Set(nodes.map((n: GraphNode) => n.id));
    return new Set(
      nodes.filter((n: GraphNode) => typeFilter.has(n.type)).map((n: GraphNode) => n.id)
    );
  }, [nodes, typeFilter]);

  // Filtered node/edge arrays (used for sidebar counts)
  const filteredNodes = useMemo(
    () => (typeFilter.size === 0 ? nodes : nodes.filter((n: GraphNode) => typeFilter.has(n.type))),
    [nodes, typeFilter]
  );
  const filteredEdges = useMemo(
    () =>
      typeFilter.size === 0
        ? edges
        : edges.filter(
            (e: GraphEdge) => visibleNodeIds.has(e.source_id) && visibleNodeIds.has(e.target_id)
          ),
    [edges, visibleNodeIds, typeFilter]
  );

  // Search filtering
  const searchFilteredNodes: GraphNode[] =
    searchTerm.trim().length > 0
      ? (nodes as GraphNode[]).filter((n: GraphNode) =>
          n.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [];

  const highlightNodes = new Set(searchFilteredNodes.map((n) => n.id));

  const handleNodeSelect = (n: GraphNode | null) => {
    setSelected(n);
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

  // Degree map: node id → number of edges
  const degreeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) {
      m.set(e.source_id, (m.get(e.source_id) ?? 0) + 1);
      m.set(e.target_id, (m.get(e.target_id) ?? 0) + 1);
    }
    return m;
  }, [edges]);

  // Top 8 most connected nodes
  const topNodes = useMemo(() => {
    return [...nodes]
      .map(n => ({ node: n, degree: degreeMap.get(n.id) ?? 0 }))
      .filter(x => x.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8);
  }, [nodes, degreeMap]);

  // Relationship frequency map
  const relFreqMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) {
      m.set(e.relationship, (m.get(e.relationship) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [edges]);

  // Most central node + most common relationship
  const mostCentral = topNodes[0] ?? null;
  const mostCommonRel = relFreqMap[0] ?? null;
  const avgDegree = nodes.length > 0 ? (edges.length * 2 / nodes.length).toFixed(1) : "0";

  // Fetch predictions that reference the selected node
  const { data: nodePredictions = [] } = useQuery({
    queryKey: ["node-predictions", selected?.id],
    queryFn: () => getNodePredictions(selected!.id),
    enabled: !!selected,
    staleTime: 30_000,
  });

  // State for toggling connection section direction filter
  const [connFilter, setConnFilter] = useState<"all" | "out" | "in">("all");
  const [showAllConn, setShowAllConn] = useState(false);

  // Filtered connections based on direction
  const filteredConnections = useMemo(() => {
    if (!selected) return [];
    const conns = allConnectedEdges.filter(({ edge }) => {
      if (connFilter === "out") return edge.source_id === selected.id;
      if (connFilter === "in") return edge.target_id === selected.id;
      return true;
    });
    return showAllConn ? conns : conns.slice(0, 8);
  }, [allConnectedEdges, selected, connFilter, showAllConn]);

  // Relationship breakdown for selected node
  const selectedRelBreakdown = useMemo(() => {
    if (!selected) return [];
    const m = new Map<string, number>();
    for (const { edge } of allConnectedEdges) {
      m.set(edge.relationship, (m.get(edge.relationship) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [allConnectedEdges, selected]);

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
            {typeFilter.size > 0
              ? `${filteredNodes.length} / ${nodes.length} nodes · ${filteredEdges.length} edges`
              : `${nodes.length} nodes · ${edges.length} edges`}
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

        {/* Canvas empty state */}
        {nodes.length === 0 && !isLoadingNodes && !isLoadingEdges && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
              <Network className="w-8 h-8 text-accent/60" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">No knowledge graph yet</h3>
            <p className="text-xs text-text-muted max-w-[200px] mb-4">
              Run a prediction to start building the graph — entities and relationships are extracted automatically.
            </p>
            <a
              href="/predict"
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Run your first prediction
            </a>
          </div>
        )}
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
          {searchFilteredNodes.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {searchFilteredNodes.slice(0, 5).map((n) => (
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
          {searchTerm.trim().length > 0 && searchFilteredNodes.length === 0 && (
            <p className="mt-2 text-xs text-text-muted px-1">No nodes found</p>
          )}
        </div>

        {/* Node type filter chips */}
        {presentTypes.length > 1 && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Filter by type</p>
            <div className="flex flex-wrap gap-1.5">
              {presentTypes.map((type) => {
                const color = NODE_COLORS[type] ?? "#635BFF";
                const active = typeFilter.has(type);
                const count = nodes.filter((n: GraphNode) => n.type === type).length;
                return (
                  <button
                    key={type}
                    aria-pressed={active}
                    onClick={() => {
                      setTypeFilter((prev) => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type);
                        else next.add(type);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                      active
                        ? "border-current"
                        : "border-transparent bg-white/5 text-text-muted hover:text-text-secondary"
                    }`}
                    style={active ? { color, borderColor: `${color}60`, background: `${color}18` } : {}}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    {type}
                    <span className="opacity-60 font-mono">{count}</span>
                  </button>
                );
              })}
              {typeFilter.size > 0 && (
                <button
                  onClick={() => setTypeFilter(new Set())}
                  className="px-2 py-0.5 rounded-full text-[10px] text-text-muted hover:text-text-primary border border-transparent hover:border-border transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

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

        {/* Insight stats */}
        {(stats || nodes.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Graph Insights</CardTitle>
              <BarChart3 className="w-3.5 h-3.5 text-text-muted" />
            </CardHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total nodes</span>
                <span className="font-mono text-text-primary">{stats?.node_count ?? nodes.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total edges</span>
                <span className="font-mono text-text-primary">{stats?.edge_count ?? edges.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Avg connections</span>
                <span className="font-mono text-text-primary">{avgDegree}</span>
              </div>
              {mostCentral && (
                <div className="pt-2 border-t border-border">
                  <div className="text-[10px] text-text-muted mb-1 font-medium uppercase tracking-wide">Most Central Entity</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[mostCentral.node.type] ?? "#635BFF" }} />
                    <span className="text-xs text-text-primary truncate flex-1">{mostCentral.node.name}</span>
                    <span className="text-[10px] font-mono text-text-muted">{mostCentral.degree} edges</span>
                  </div>
                </div>
              )}
              {mostCommonRel && (
                <div>
                  <div className="text-[10px] text-text-muted mb-1 font-medium uppercase tracking-wide">Top Relationship</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-accent">{mostCommonRel[0].replace(/_/g, " ").toLowerCase()}</span>
                    <span className="text-[10px] font-mono text-text-muted">{mostCommonRel[1]}×</span>
                  </div>
                </div>
              )}
              {relFreqMap.length > 1 && (
                <div>
                  <div className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wide">Relationship Mix</div>
                  <div className="space-y-1">
                    {relFreqMap.slice(0, 4).map(([rel, count]) => {
                      const maxCount = relFreqMap[0][1];
                      return (
                        <div key={rel} className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-text-muted truncate w-28 flex-shrink-0">{rel.replace(/_/g, " ").toLowerCase()}</span>
                          <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
                            <div className="h-full bg-accent/60 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-[9px] font-mono text-text-muted w-5 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Most connected nodes */}
        {topNodes.length > 0 && !selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle>Most Connected</CardTitle>
                <TrendingUp className="w-3.5 h-3.5 text-text-muted" />
              </CardHeader>
              <div className="space-y-1.5">
                {topNodes.map(({ node, degree }, i) => {
                  const color = NODE_COLORS[node.type] ?? "#635BFF";
                  return (
                    <button
                      key={node.id}
                      onClick={() => handleNodeSelect(node)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/6 transition-colors group text-left"
                    >
                      <span className="text-[10px] font-mono text-text-muted w-4 flex-shrink-0">{i + 1}</span>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors truncate flex-1">{node.name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="h-1 w-10 bg-white/6 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(degree / (topNodes[0].degree || 1)) * 100}%`, background: color }} />
                        </div>
                        <span className="text-[10px] font-mono text-text-muted w-4 text-right">{degree}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </motion.div>
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
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NODE_COLORS[selected.type] ?? "#635BFF" }} />
                    <CardTitle className="truncate">{selected.name}</CardTitle>
                  </div>
                  <button onClick={() => handleNodeSelect(null)} className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none ml-1">×</button>
                </CardHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="accent">{selected.type}</Badge>
                    <span className="text-[10px] font-mono text-text-muted">{allConnectedEdges.length} connections</span>
                    <span className="text-[10px] font-mono text-text-muted">{selected.id.slice(0, 8)}…</span>
                  </div>

                  {Object.keys(selected.properties).length > 0 && (
                    <div>
                      <div className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wide">Properties</div>
                      <div className="space-y-1">
                        {Object.entries(selected.properties).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-text-muted capitalize">{k}</span>
                            <span className="font-mono text-text-secondary truncate max-w-[140px]">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Relationship breakdown for selected node */}
                  {selectedRelBreakdown.length > 0 && (
                    <div>
                      <div className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wide">Relationship Types</div>
                      <div className="space-y-1">
                        {selectedRelBreakdown.map(([rel, count]) => {
                          const maxCount = selectedRelBreakdown[0][1];
                          return (
                            <div key={rel} className="flex items-center gap-2">
                              <span className="text-[9px] font-mono text-text-muted truncate flex-1">{rel.replace(/_/g, " ").toLowerCase()}</span>
                              <div className="w-14 h-1 bg-white/6 rounded-full overflow-hidden">
                                <div className="h-full bg-accent/60 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                              </div>
                              <span className="text-[9px] font-mono text-text-muted w-4 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Predictions that reference this node */}
                  {nodePredictions.length > 0 && (
                    <div>
                      <div className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wide">
                        Appears in {nodePredictions.length} prediction{nodePredictions.length !== 1 ? "s" : ""}
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {nodePredictions.slice(0, 6).map((pred) => {
                          const confColor =
                            pred.confidence != null && pred.confidence >= 0.7
                              ? "#10B981"
                              : pred.confidence != null && pred.confidence >= 0.45
                              ? "#F59E0B"
                              : "#EF4444";
                          return (
                            <button
                              key={pred.id}
                              onClick={() => router.push(`/predict?view=${pred.id}`)}
                              className="w-full text-left bg-white/4 hover:bg-white/8 rounded-lg px-2.5 py-2 transition-colors group"
                            >
                              <p className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors line-clamp-2 leading-snug">
                                {pred.headline ?? pred.query}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {pred.confidence != null && (
                                  <span className="text-[9px] font-mono" style={{ color: confColor }}>
                                    {Math.round(pred.confidence * 100)}%
                                  </span>
                                )}
                                {pred.domain && (
                                  <span className="text-[9px] font-mono text-text-muted capitalize">{pred.domain}</span>
                                )}
                                <span className="text-[9px] text-text-muted ml-auto">
                                  {new Date(pred.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Connections */}
                  {allConnectedEdges.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[10px] text-text-muted font-medium uppercase tracking-wide">Connections</div>
                        <div className="flex items-center gap-0.5">
                          {(["all", "out", "in"] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setConnFilter(f)}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${connFilter === f ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text-secondary"}`}
                            >
                              {f === "all" ? `all ${allConnectedEdges.length}` : f === "out" ? `→ ${allConnectedEdges.filter(x => x.edge.source_id === selected.id).length}` : `← ${allConnectedEdges.filter(x => x.edge.target_id === selected.id).length}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {filteredConnections.map(({ edge, connectedNode }) => {
                          const isOutgoing = edge.source_id === selected.id;
                          return (
                            <button
                              key={edge.id}
                              onClick={() => handleNodeSelect(connectedNode)}
                              className="w-full flex items-center gap-2 text-xs bg-white/4 hover:bg-white/8 rounded-lg px-2.5 py-1.5 transition-colors group text-left"
                            >
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: NODE_COLORS[connectedNode.type] ?? "#635BFF" }}
                              />
                              <span className="flex-1 min-w-0">
                                <span className="block text-[9px] font-mono text-text-muted truncate">
                                  {isOutgoing ? "→" : "←"} {edge.relationship.replace(/_/g, " ").toLowerCase()}
                                </span>
                                <span className="block text-text-secondary truncate text-[11px]">{connectedNode.name}</span>
                              </span>
                              {edge.weight > 0 && (
                                <span className="text-[9px] font-mono text-text-muted flex-shrink-0">{edge.weight.toFixed(1)}</span>
                              )}
                              <ArrowRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                            </button>
                          );
                        })}
                      </div>
                      {allConnectedEdges.filter(({ edge }) => connFilter === "all" ? true : connFilter === "out" ? edge.source_id === selected.id : edge.target_id === selected.id).length > 8 && (
                        <button
                          onClick={() => setShowAllConn(v => !v)}
                          className="w-full mt-1.5 flex items-center justify-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors py-1"
                        >
                          {showAllConn ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showAllConn ? "Show less" : `Show all ${allConnectedEdges.length} connections`}
                        </button>
                      )}
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
