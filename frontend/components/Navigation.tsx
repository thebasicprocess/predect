"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  Network,
  FileSearch,
  History,
  Settings,
  Zap,
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

  return (
    <>
      {/* Top nav — always visible */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-bg-base/80 backdrop-blur-glass">
        <div className="max-w-screen-2xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4 text-accent" />
            </div>
            <span className="font-bold text-sm tracking-tight">
              PRE<span className="text-accent">DECT</span>
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
                      className="absolute inset-0 bg-white/6 rounded-lg border border-border"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon className="relative w-3.5 h-3.5" />
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-text-muted">Z.AI Connected</span>
          </div>
        </div>
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
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
