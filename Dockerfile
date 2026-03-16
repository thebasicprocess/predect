FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy full project (so backend.main imports resolve correctly)
COPY . .

# Ensure data dir exists for SQLite volume mount
RUN mkdir -p /app/data

ENV DATABASE_URL=/app/data/predect.db
ENV PORT=8000

CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
