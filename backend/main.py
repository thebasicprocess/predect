import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

from backend.db.database import init_db
from backend.routers import predict, evidence, graph, orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="PREDECT API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/api/predict", tags=["predict"])
app.include_router(evidence.router, prefix="/api/evidence", tags=["evidence"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(orchestrator.router, prefix="/api/orchestrator", tags=["orchestrator"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "PREDECT"}
