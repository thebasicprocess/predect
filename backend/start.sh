#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate
else
  source venv/bin/activate
fi
uvicorn main:app --reload --host 0.0.0.0 --port 8000
