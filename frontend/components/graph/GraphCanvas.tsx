"use client";
import { useEffect, useRef, useState } from "react";

interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  weight: number;
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

export function GraphCanvas({
  nodes,
  edges,
  onNodeSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect: (node: GraphNode | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const posRef = useRef<Map<string, NodePos>>(new Map());
  const animRef = useRef<number>(0);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const W = canvas.width;
    const H = canvas.height;

    // Initialize positions for new nodes
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

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const positions = posRef.current;

      // Force simulation (run for first 300 ticks)
      if (tickRef.current < 300) {
        const nodeArr = nodes.map((n) => ({
          id: n.id,
          ...positions.get(n.id)!,
        }));

        // Repulsion
        for (let i = 0; i < nodeArr.length; i++) {
          for (let j = i + 1; j < nodeArr.length; j++) {
            const a = nodeArr[i],
              b = nodeArr[j];
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
        edges.forEach((e) => {
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

        // Center gravity + damping
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

      // Draw edges
      edges.forEach((e) => {
        const a = positions.get(e.source_id);
        const b = positions.get(e.target_id);
        if (!a || !b) return;
        ctx.strokeStyle = "rgba(99,91,255,0.25)";
        ctx.lineWidth = Math.max(0.5, e.weight * 0.8);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((n) => {
        const pos = positions.get(n.id);
        if (!pos) return;
        const color = NODE_COLORS[n.type] || "#635BFF";
        const r = n.type === "Prediction" ? 10 : 7;
        const isHovered = hovered === n.id;

        // Glow for hovered/prediction nodes
        if (isHovered || n.type === "Prediction") {
          ctx.shadowBlur = 12;
          ctx.shadowColor = color;
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isHovered ? r + 3 : r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = isHovered ? 1 : 0.85;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Label for hovered nodes
        if (isHovered) {
          ctx.font = "11px Inter, sans-serif";
          ctx.fillStyle = "rgba(248,248,252,0.9)";
          ctx.fillText(n.name.slice(0, 24), pos.x + r + 5, pos.y + 4);
        }
      });

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [nodes, edges, hovered]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const node of nodes) {
      const pos = posRef.current.get(node.id);
      if (!pos) continue;
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (dx * dx + dy * dy < 144) {
        onNodeSelect(node);
        return;
      }
    }
    onNodeSelect(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: string | null = null;
    for (const node of nodes) {
      const pos = posRef.current.get(node.id);
      if (!pos) continue;
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (dx * dx + dy * dy < 144) {
        found = node.id;
        break;
      }
    }
    setHovered(found);
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    />
  );
}
