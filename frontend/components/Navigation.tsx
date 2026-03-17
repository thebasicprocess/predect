"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePredictionStore } from "@/lib/stores/predictionStore";
import { checkHealth } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";
import {
  BrainCircuit,
  Network,
  FileSearch,
  History,
  Settings,
  Zap,
  Sun,
  Moon,
} from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Zap },
  { href: "/predict", label: "Predict", icon: BrainCircuit },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/evidence", label: "Evidence", icon: FileSearch },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const predictionStatus = usePredictionStore((s) => s.status);
  const isRunning = predictionStatus === "running";
  const [backendOnline, setBackendOnline] = useState(true);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    checkHealth().then(setBackendOnline);
    const interval = setInterval(() => checkHealth().then(setBackendOnline), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Top nav — always visible */}
      <nav className="nav-gradient-border fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-bg-base/80 backdrop-blur-glass">
        <div className="max-w-screen-2xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center transition-all duration-300 group-hover:bg-accent/30 group-hover:shadow-[0_0_12px_rgba(99,91,255,0.4)]">
              <BrainCircuit className="w-4 h-4 text-accent" />
            </div>
            <span className="font-bold text-sm tracking-tight">
              PRE<span className="text-accent" style={{ filter: "drop-shadow(0 0 6px rgba(99,91,255,0.6))" }}>DECT</span>
            </span>
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href) && href !== "/";
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
                    active
                      ? "text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg border border-accent/25"
                      style={{
                        background: "rgba(99,91,255,0.08)",
                        boxShadow: "0 0 12px rgba(99,91,255,0.15), inset 0 0 8px rgba(99,91,255,0.05)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon
                    className={cn("relative w-3.5 h-3.5 transition-colors duration-200", active && "text-accent")}
                  />
                  <span className="relative">{label}</span>
                  {href === "/predict" && isRunning && !active && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors duration-200"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Z.AI status badge */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border",
            backendOnline ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"
          )}>
            <span className="relative flex h-2 w-2">
              {backendOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />}
              <span className={cn("relative inline-flex rounded-full h-2 w-2", backendOnline ? "bg-success status-glow-pulse" : "bg-danger")} />
            </span>
            <span className={cn("text-xs font-medium", backendOnline ? "text-success/80" : "text-danger/80")}>
              {backendOnline ? "Z.AI Connected" : "Backend Offline"}
            </span>
          </div>
        </div>

        {/* Thin gradient bottom border accent */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(99,91,255,0.5) 30%, rgba(167,139,250,0.4) 60%, transparent 100%)",
          }}
        />
      </nav>

      {/* Bottom tab bar — mobile only (< sm) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-bg-base/90 backdrop-blur-glass flex sm:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href) && href !== "/";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-200",
                active ? "text-accent" : "text-text-muted"
              )}
            >
              {active && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute bottom-0 w-8 h-0.5 rounded-t-full"
                  style={{
                    background: "linear-gradient(90deg, #635BFF, #A78BFA)",
                    boxShadow: "0 0 8px rgba(99,91,255,0.6)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {href === "/predict" && isRunning && !active && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
