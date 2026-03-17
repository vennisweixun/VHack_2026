import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routes import transactions
from app.services import database, model_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting FraudShield API …")

    # Connect to MongoDB
    await database.connect()

    # Load XGBoost fraud model
    settings = get_settings()
    if settings.model_path:
        success = model_service.load_model(settings.model_path)
        if success:
            info = model_service.model_info()
            logger.info(
                "Fraud model ready: %s  features=%d  encoders=%s",
                info["model_type"], info["features"], info["has_encoders"],
            )
        else:
            logger.warning(
                "Could not load model from '%s'. Falling back to rule-based mock.",
                settings.model_path,
            )
    else:
        logger.warning("MODEL_PATH not set in .env — using mock fraud model.")

    yield

    logger.info("Shutting down FraudShield API …")
    await database.disconnect()


settings = get_settings()

app = FastAPI(
    title="FraudShield API",
    description="""
## FraudShield Fraud Detection API

Receives bank transactions, scores them with the XGBoost fraud model
(`fraud_model.pkl`), classifies as **APPROVED / FLAGGED / BLOCKED**,
and persists to MongoDB.

### Scoring Thresholds
| fraud_probability | status |
|---|---|
| < 0.40 | ✅ APPROVED |
| 0.40 – 0.74 | ⚠️ FLAGGED |
| ≥ 0.75 | 🚫 BLOCKED |
""",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow the React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router, prefix=settings.api_prefix)


@app.get("/health", tags=["System"], summary="Health check")
async def health():
    s = get_settings()
    m = model_service.model_info()
    return {
        "status": "ok",
        "model": {
            "loaded":       m["loaded"],
            "type":         m.get("model_type", "none"),
            "features":     m.get("features", 0),
            "has_encoders": m.get("has_encoders", False),
            "path":         s.model_path,
        },
        "mongodb_db": s.mongodb_db_name,
        "thresholds": {
            "approved_below": s.approved_threshold,
            "flagged_range":  f"{s.approved_threshold} – {s.block_threshold}",
            "blocked_above":  s.block_threshold,
        },
    }
