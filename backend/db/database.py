import sqlite3
import os
from pathlib import Path

DB_PATH = os.getenv("DATABASE_URL", "./predect.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    with conn:
        conn.executescript(SCHEMA_PATH.read_text())
    # Migrate existing non-unique index to unique — safe to fail if already unique
    # or if duplicate data exists (we can't auto-deduplicate without data loss)
    try:
        with conn:
            conn.execute("DROP INDEX IF EXISTS idx_nodes_name_type")
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_name_type ON nodes(name, type)")
    except Exception:
        pass  # Duplicate data prevents migration — existing nodes still work via SELECT-first pattern
    # Migrate edges index to unique — enables INSERT OR IGNORE in create_edge
    try:
        with conn:
            conn.execute("DROP INDEX IF EXISTS idx_edges_unique")
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique ON edges(source_id, target_id, relationship)")
    except Exception:
        pass  # Duplicate edges prevent migration — application-level dedup still prevents most duplicates
    conn.close()
