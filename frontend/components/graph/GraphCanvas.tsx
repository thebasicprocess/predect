"use client";
import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  weight: number;
}

export interface GraphCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
}

const NODE_COLORS: Record<string, string> = {
  Person: "#635BFF",
  Organization: "#10B981",
  Event: "#F59E0B",
  Location: "#60A5FA",
  Concept: "#A78BFA",
  Prediction: "#EC4899",
};

interface NodePos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

const SCALE_MIN = 0.3;
const SCALE_MAX = 3.0;
const SCALE_STEP = 0.15;

function clampScale(s: number) {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
}

export const GraphCanvas = forwardRef<
  GraphCanvasHandle,
  {
    nodes: GraphNode[];
    edges: GraphEdge[];
    onNodeSelect: (node: GraphNode | null) => void;
    highlightNodes?: Set<string>;
    hiddenTypes?: Set<string>;
  }
>(function GraphCanvas(
  { nodes, edges, onNodeSelect, highlightNodes, hiddenTypes },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const posRef = useRef<Map<string, NodePos>>(new Map());
  const animRef = useRef<number>(0);
  const tickRef = useRef(0);

  // Camera state stored in a ref so draw() always sees the latest value without
  // needing to re-run the effect on every pan/zoom update.
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });

  // Pan drag state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, camX: 0, camY: 0 });

  // Keep latest nodes/edges in a ref so mouse handlers can access them without
  // being recreated on every render.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Hover ref (avoids re-running draw effect on hover change — we read it inside draw())
  const hoveredRef = useRef<string | null>(null);
  const highlightRef = useRef<Set<string>>(new Set());
  const hiddenTypesRef = useRef<Set<string>>(new Set());

  // Sync hovered state into ref for the animation loop
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  useEffect(() => {
    highlightRef.current = highlightNodes ?? new Set();
  }, [highlightNodes]);

  useEffect(() => {
    hiddenTypesRef.current = hiddenTypes ?? new Set();
  }, [hiddenTypes]);

  // ── Degree map ────────────────────────────────────────────────────────────
  const degreeMapRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const m = new Map<string, number>();
    edges.forEach((e) => {
      m.set(e.source_id, (m.get(e.source_id) ?? 0) + 1);
      m.set(e.target_id, (m.get(e.target_id) ?? 0) + 1);
    });
    degreeMapRef.current = m;
  }, [edges]);

  const getRadius = (node: GraphNode) => {
    const base = node.type === "Prediction" ? 12 : 6;
    const degree = degreeMapRef.current.get(node.id) ?? 0;
    return Math.min(base + degree * 1.5, 20);
  };

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomIn() {
      const cam = cameraRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cx = canvas.offsetWidth / 2;
      const cy = canvas.offsetHeight / 2;
      const nextScale = clampScale(cam.scale + SCALE_STEP);
      const ratio = nextScale / cam.scale;
      cam.x = cx - ratio * (cx - cam.x);
      cam.y = cy - ratio * (cy - cam.y);
      cam.scale = nextScale;
    },
    zoomOut() {
      const cam = cameraRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cx = canvas.offsetWidth / 2;
      const cy = canvas.offsetHeight / 2;
      const nextScale = clampScale(cam.scale - SCALE_STEP);
      const ratio = nextScale / cam.scale;
      cam.x = cx - ratio * (cx - cam.x);
      cam.y = cy - ratio * (cy - cam.y);
      cam.scale = nextScale;
    },
    resetCamera() {
      cameraRef.current = { x: 0, y: 0, scale: 1 };
    },
  }));

  // ── Main draw loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    // Initialise positions for new nodes
    nodes.forEach((n) => {
      if (!posRef.current.has(n.id)) {
        posRef.current.set(n.id, {
          x: W / 2 + (Math.random() - 0.5) * W * 0.6,
          y: H / 2 + (Math.random() - 0.5) * H * 0.6,
          vx: 0,
          vy: 0,
        });
      }
    });

    tickRef.current = 0;

    // Build node type map once for O(1) lookups in draw loop
    const nodeTypeMap = new Map<string, string>();
    nodes.forEach(n => nodeTypeMap.set(n.id, n.type));

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const positions = posRef.current;
      const camera = cameraRef.current;
      const currentHovered = hoveredRef.current;
      const highlighted = highlightRef.current;
      const hiddenTypes = hiddenTypesRef.current;

      // ── Force simulation (first 300 ticks) ──────────────────────────────
      if (tickRef.current < 300) {
        const nodeArr = nodesRef.current.map((n) => ({
          id: n.id,
          ...positions.get(n.id)!,
        }));

        // Repulsion
        for (let i = 0; i < nodeArr.length; i++) {
          for (let j = i + 1; j < nodeArr.length; j++) {
            const a = nodeArr[i];
            const b = nodeArr[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 3000 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            const posA = positions.get(a.id)!;
            const posB = positions.get(b.id)!;
            posA.vx -= fx;
            posA.vy -= fy;
            posB.vx += fx;
            posB.vy += fy;
          }
        }

        // Attraction (edges)
        edgesRef.current.forEach((e) => {
          const a = positions.get(e.source_id);
          const b = positions.get(e.target_id);
          if (!a || !b) return;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = dist / 80;
          const fx = (dx / dist) * force * e.weight;
          const fy = (dy / dist) * force * e.weight;
          a.vx += fx * 0.5;
          a.vy += fy * 0.5;
          b.vx -= fx * 0.5;
          b.vy -= fy * 0.5;
        });

        // Centre gravity + damping
        nodeArr.forEach((n) => {
          const pos = positions.get(n.id)!;
          pos.vx += (W / 2 - pos.x) * 0.004;
          pos.vy += (H / 2 - pos.y) * 0.004;
          pos.vx *= 0.82;
          pos.vy *= 0.82;
          pos.x = Math.max(20, Math.min(W - 20, pos.x + pos.vx));
          pos.y = Math.max(20, Math.min(H - 20, pos.y + pos.vy));
        });

        tickRef.current++;
      }

      // ── Apply camera transform ───────────────────────────────────────────
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.scale, camera.scale);

      // ── Draw edges ───────────────────────────────────────────────────────
      edgesRef.current.forEach((e) => {
        const a = positions.get(e.source_id);
        const b = positions.get(e.target_id);
        if (!a || !b) return;
        // Skip edge if either endpoint node type is hidden
        const srcType = nodeTypeMap.get(e.source_id);
        const tgtType = nodeTypeMap.get(e.target_id);
        if ((srcType && hiddenTypes.has(srcType)) || (tgtType && hiddenTypes.has(tgtType))) return;

        ctx.strokeStyle = "rgba(99,91,255,0.25)";
        ctx.lineWidth = Math.max(0.5, e.weight * 0.8);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Relationship label at midpoint (only when zoomed in enough)
        if (camera.scale > 0.7) {
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          ctx.save();
          ctx.font = "8px JetBrains Mono, monospace";
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.textAlign = "center";
          ctx.fillText(e.relationship.replace(/_/g, " "), midX, midY - 3);
          ctx.restore();
        }
      });

      // ── Draw nodes ───────────────────────────────────────────────────────
      nodesRef.current.forEach((n) => {
        const pos = positions.get(n.id);
        if (!pos) return;
        if (hiddenTypes.has(n.type)) return;

        const color = NODE_COLORS[n.type] ?? "#635BFF";
        const r = getRadius(n);
        const isHovered = currentHovered === n.id;
        const isHighlighted = highlighted.size > 0 && highlighted.has(n.id);
        const isPrediction = n.type === "Prediction";

        // Glow
        if (isHovered || isPrediction || isHighlighted) {
          ctx.shadowBlur = isHighlighted ? 24 : 12;
          ctx.shadowColor = isHighlighted ? "#ffffff" : color;
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isHovered ? r + 3 : r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = isHovered || isHighlighted ? 1 : 0.85;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // ── Labels ──────────────────────────────────────────────────────
        const effectiveR = isHovered ? r + 3 : r;

        if (isHovered) {
          // Hovered: always show full (truncated) label
          ctx.font = "11px Inter, sans-serif";
          ctx.fillStyle = "rgba(248,248,252,0.9)";
          ctx.textAlign = "left";
          ctx.fillText(n.name.slice(0, 28), pos.x + effectiveR + 5, pos.y + 4);
        } else if (isPrediction) {
          // Prediction nodes: always visible label
          ctx.font = "bold 10px Inter, sans-serif";
          ctx.fillStyle = "rgba(248,248,252,0.85)";
          ctx.textAlign = "center";
          ctx.fillText(n.name.slice(0, 22), pos.x, pos.y + effectiveR + 13);
        } else if (camera.scale > 1.2) {
          // High zoom: show all node names (truncated)
          ctx.font = "9px Inter, sans-serif";
          ctx.fillStyle = "rgba(248,248,252,0.6)";
          ctx.textAlign = "center";
          ctx.fillText(n.name.slice(0, 18), pos.x, pos.y + effectiveR + 11);
        }

        // Highlight ring
        if (isHighlighted) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
    // Only re-run when the node/edge arrays change identity (not on hover/camera)
  }, [nodes, edges]);

  // ── Screen → world coordinate conversion ──────────────────────────────────
  function toWorld(mx: number, my: number) {
    const cam = cameraRef.current;
    return {
      x: (mx - cam.x) / cam.scale,
      y: (my - cam.y) / cam.scale,
    };
  }

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      const nextScale = clampScale(cam.scale * delta);
      const ratio = nextScale / cam.scale;

      // Zoom toward the cursor position
      cam.x = mx - ratio * (mx - cam.x);
      cam.y = my - ratio * (my - cam.y);
      cam.scale = nextScale;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only pan on left button with no node underneath (node click handled separately)
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x: wx, y: wy } = toWorld(mx, my);

    // Check if we're clicking on a node — if so, don't start pan
    let onNode = false;
    for (const node of nodesRef.current) {
      if (hiddenTypesRef.current.has(node.type)) continue;
      const pos = posRef.current.get(node.id);
      if (!pos) continue;
      const r = getRadius(node);
      const dx = wx - pos.x;
      const dy = wy - pos.y;
      if (dx * dx + dy * dy < r * r + 10) {
        onNode = true;
        break;
      }
    }

    if (!onNode) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: mx,
        y: my,
        camX: cameraRef.current.x,
        camY: cameraRef.current.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const ds = dragStartRef.current;
      cameraRef.current.x = ds.camX + (mx - ds.x);
      cameraRef.current.y = ds.camY + (my - ds.y);
      return;
    }

    // Hover hit-testing in world space
    const { x: wx, y: wy } = toWorld(mx, my);
    let found: string | null = null;
    for (const node of nodesRef.current) {
      if (hiddenTypesRef.current.has(node.type)) continue;
      const pos = posRef.current.get(node.id);
      if (!pos) continue;
      const r = getRadius(node);
      const dx = wx - pos.x;
      const dy = wy - pos.y;
      if (dx * dx + dy * dy < (r + 4) * (r + 4)) {
        found = node.id;
        break;
      }
    }
    setHovered(found);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHovered(null);
  };

  // ── Click ─────────────────────────────────────────────────────────────────
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Suppress click if we just finished a drag (moved more than a few pixels)
    if (isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x: wx, y: wy } = toWorld(mx, my);

    for (const node of nodesRef.current) {
      if (hiddenTypesRef.current.has(node.type)) continue;
      const pos = posRef.current.get(node.id);
      if (!pos) continue;
      const r = getRadius(node);
      const dx = wx - pos.x;
      const dy = wy - pos.y;
      if (dx * dx + dy * dy < (r + 4) * (r + 4)) {
        onNodeSelect(node);
        return;
      }
    }
    onNodeSelect(null);
  };

  // ── Cursor style based on hover/drag ─────────────────────────────────────
  const cursor = isDraggingRef.current
    ? "grabbing"
    : hovered
    ? "pointer"
    : "grab";

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  );
});
