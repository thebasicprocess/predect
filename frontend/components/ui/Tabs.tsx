"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-bg-card p-1 rounded-lg",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200",
            activeTab === tab.id
              ? "text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-bg"
              className="absolute inset-0 bg-bg-hover rounded-md"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{tab.icon}</span>
          <span className="relative">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
