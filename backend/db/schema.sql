CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES nodes(id),
    target_id TEXT NOT NULL REFERENCES nodes(id),
    relationship TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    properties TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    domain TEXT,
    time_horizon TEXT,
    status TEXT DEFAULT 'pending',
    confidence REAL,
    result TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evidence_bundles (
    id TEXT PRIMARY KEY,
    prediction_id TEXT REFERENCES predictions(id),
    query TEXT NOT NULL,
    items TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS simulations (
    id TEXT PRIMARY KEY,
    prediction_id TEXT REFERENCES predictions(id),
    agents TEXT NOT NULL DEFAULT '[]',
    rounds TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prediction_node_map (
    prediction_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    PRIMARY KEY (prediction_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_pnm_prediction ON prediction_node_map(prediction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_name_type ON nodes(name, type);
CREATE INDEX IF NOT EXISTS idx_edges_unique ON edges(source_id, target_id, relationship);
