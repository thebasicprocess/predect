"use client";
import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface ConfidenceGaugeProps {
  score: number;
  color: string;
}

// Arc geometry constants
const CX = 80;
const CY = 90;
const R = 64;
// The arc spans 180 degrees: from 180° (left) to 0° (right) going counter-clockwise
// In SVG angles: start at left (π rad) end at right (0/2π rad)
const START_ANGLE = Math.PI; // left
const END_ANGLE = 0; // right

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  // Large arc flag: 1 because we want the 180° arc (the top half)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
}

// Full 180° track path (static)
const TRACK_PATH = describeArc(CX, CY, R, START_ANGLE, END_ANGLE);

// Circumference of the full 180° arc
const ARC_LENGTH = Math.PI * R; // πr for a semicircle

export function ConfidenceGauge({ score, color }: ConfidenceGaugeProps) {
  const clampedScore = Math.max(0, Math.min(1, score));
  const animatedScore = useMotionValue(0);
  const displayPct = useTransform(animatedScore, (v) =>
    Math.round(v * 100).toString()
  );
  // strokeDashoffset drives the fill: offset = totalLength * (1 - score)
  const dashOffset = useTransform(
    animatedScore,
    (v) => ARC_LENGTH * (1 - v)
  );

  useEffect(() => {
    const controls = animate(animatedScore, clampedScore, {
      duration: 1.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
    return controls.stop;
  }, [clampedScore, animatedScore]);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 160 100"
        width={160}
        height={100}
        aria-label={`Confidence: ${Math.round(clampedScore * 100)}%`}
        role="img"
      >
        {/* Track */}
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={8}
          strokeLinecap="round"
        />

        {/* Animated fill arc */}
        <motion.path
          d={TRACK_PATH}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          style={{ strokeDashoffset: dashOffset }}
        />

        {/* Score text */}
        <text
          x={CX}
          y={CY - 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={22}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
          fill={color}
        >
          <motion.tspan>{displayPct}</motion.tspan>%
        </text>

        {/* Label */}
        <text
          x={CX}
          y={CY + 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={7}
          fontWeight={500}
          fontFamily="Inter, system-ui, sans-serif"
          fill="rgba(248,248,252,0.35)"
          letterSpacing="0.12em"
        >
          CONFIDENCE
        </text>
      </svg>
    </div>
  );
}
