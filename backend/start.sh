#!/bin/bash
set -e
SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR/.."
if [ -f "backend/venv/Scripts/activate" ]; then
  source backend/venv/Scripts/activate
else
  source backend/venv/bin/activate
fi
uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
