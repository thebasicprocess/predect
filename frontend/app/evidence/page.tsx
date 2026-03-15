"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { collectEvidence } from "@/lib/api";
import {
  FileSearch,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

const sourceColors: Record<string, string> = {
  arxiv: "#635BFF",
  hn: "#F59E0B",
  reddit: "#EF4444",
  web: "#10B981",
  newsapi: "#60A5FA",
  gnews: "#A78BFA",
};

interface EvidenceItem {
  id: string;
  title: string;
  url: string;
  source: string;
  snippet: string;
  relevance_score: number;
  credibility_score: number;
  sentiment: number | null;
  entities: string[];
}

export default function EvidencePage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCollect = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await collectEvidence(query);
      setItems(result.items || []);
    } catch {
      // ignore errors
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Evidence Manager</h1>
            <p className="text-sm text-text-secondary">
              Collect and browse evidence from all sources
            </p>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <div className="flex gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search query (e.g., 'AI regulation 2025')"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCollect()}
            />
            <Button
              onClick={handleCollect}
              loading={loading}
              disabled={!query.trim()}
            >
              Collect Evidence
            </Button>
          </div>
        </Card>

        {/* Items */}
        {items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-text-secondary">
                {items.length} items collected
              </span>
              <div className="flex gap-2 flex-wrap">
                {["arxiv", "hn", "reddit", "web"].map((src) => {
                  const count = items.filter((i) => i.source === src).length;
                  if (!count) return null;
                  return (
                    <Badge
                      key={src}
                      style={{
                        background: `${sourceColors[src]}20`,
                        color: sourceColors[src],
                        borderColor: `${sourceColors[src]}30`,
                      }}
                    >
                      {src}: {count}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="hover:border-border-strong transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          style={{
                            background: `${sourceColors[item.source] || "#635BFF"}20`,
                            color: sourceColors[item.source] || "#635BFF",
                            borderColor: `${sourceColors[item.source] || "#635BFF"}30`,
                          }}
                        >
                          {item.source}
                        </Badge>
                        {item.entities.slice(0, 3).map((e) => (
                          <Badge key={e} variant="muted">
                            {e}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.sentiment !== null &&
                          item.sentiment !== undefined &&
                          (item.sentiment > 0.1 ? (
                            <TrendingUp className="w-3.5 h-3.5 text-success" />
                          ) : item.sentiment < -0.1 ? (
                            <TrendingDown className="w-3.5 h-3.5 text-danger" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-text-muted" />
                          ))}
                        <span className="text-xs font-mono text-accent">
                          {Math.round(item.relevance_score * 100)}% rel
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors" />
                        </a>
                      </div>
                    </div>
                    <h3 className="text-sm font-medium mb-1.5 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {item.snippet}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="text-center py-20">
            <FileSearch className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-2">No evidence collected yet</p>
            <p className="text-xs text-text-muted">
              Enter a search query and click Collect Evidence
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
