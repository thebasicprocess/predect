"use client";
import { motion, type Variants } from "framer-motion";

interface TimelineItem {
  period: string;
  outlook: string;
}

interface TimelineChartProps {
  items: TimelineItem[];
}

// Ordered from most to least specific to avoid partial-word false matches
const outlookPatterns: [RegExp, string][] = [
  [/\bbullish\b/i, "#10B981"],
  [/\bbearish\b/i, "#EF4444"],
  [/\bnegative\b/i, "#EF4444"],
  [/\bpositive\b/i, "#10B981"],
  [/\buncertain\b/i, "#F59E0B"],
  [/\bmixed\b/i, "#F59E0B"],
  [/\bneutral\b/i, "#F59E0B"],
];

function getOutlookColor(outlook: string): string {
  for (const [pattern, color] of outlookPatterns) {
    if (pattern.test(outlook)) return color;
  }
  return "#635BFF";
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export function TimelineChart({ items }: TimelineChartProps) {
  if (!items || items.length === 0) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      {/* Horizontal connector row with dots */}
      <div className="relative flex items-start gap-0 mb-4 overflow-x-auto pb-1">
        {items.map((item, i) => {
          const color = getOutlookColor(item.outlook);
          const isLast = i === items.length - 1;

          return (
            <motion.div
              key={i}
              variants={itemVariants}
              className="flex flex-col items-center flex-1 min-w-[80px]"
            >
              {/* Dot + connector line */}
              <div className="flex items-center w-full">
                {/* Left line segment (hidden for first item) */}
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      i === 0
                        ? "transparent"
                        : "var(--border)",
                  }}
                />
                {/* Dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 300, damping: 20 }}
                  className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-[var(--bg-base)]"
                  style={{ background: color }}
                />
                {/* Right line segment (hidden for last item) */}
                <div
                  className="flex-1 h-px"
                  style={{
                    background: isLast ? "transparent" : "rgba(255,255,255,0.1)",
                  }}
                />
              </div>

              {/* Period label */}
              <span
                className="mt-2 text-[10px] font-mono text-center leading-tight px-1"
                style={{ color: "var(--text-muted)" }}
              >
                {item.period}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Outlook text list below */}
      <div className="space-y-2">
        {items.map((item, i) => {
          const color = getOutlookColor(item.outlook);
          return (
            <motion.div
              key={i}
              variants={itemVariants}
              className="flex items-start gap-3 py-2 px-3 rounded-lg"
              style={{ background: "var(--bg-card)" }}
            >
              <span
                className="text-[10px] font-mono flex-shrink-0 mt-0.5 w-16 leading-tight"
                style={{ color }}
              >
                {item.period}
              </span>
              <span
                className="text-xs leading-snug"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.outlook}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
