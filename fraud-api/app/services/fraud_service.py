"""
Fraud Detection Service
========================
Scoring pipeline:
  1. If pkl model is loaded  →  use XGBoost (fraud_model.pkl)
  2. Fallback                →  rule-based mock model

Risk classification thresholds (set in .env):
  fraud_probability < APPROVED_THRESHOLD  →  APPROVED
  APPROVED_THRESHOLD <= prob < BLOCK_THRESHOLD  →  FLAGGED
  prob >= BLOCK_THRESHOLD  →  BLOCKED
"""

import logging

from app.core.config import get_settings
from app.models.transaction import TransactionRequest, FraudModelResponse
from app.services import model_service, mock_fraud_model

logger = logging.getLogger(__name__)


async def score_transaction(
    txn: TransactionRequest,
    card_history: list | None = None,
) -> tuple[FraudModelResponse, list[str]]:
    """
    Score a transaction for fraud risk.

    Returns:
        (FraudModelResponse, flags: list[str])
    """
    card_hist = card_history or []

    # ── Primary: XGBoost pkl model ────────────────────────────────────────────
    if model_service.is_loaded():
        try:
            fraud_prob, flags = model_service.predict_fraud(txn.model_dump(), card_hist)
            return FraudModelResponse(
                fraud_probability=fraud_prob,
                model_version="xgb-fraudshield-v1",
                source="pkl_model",
            ), flags
        except Exception as exc:
            # Log the FULL traceback so the cause is visible in the API console
            logger.error(
                "pkl model prediction failed for txn %s — falling back to mock.  "
                "Fix the error above to ensure XGBoost is used for ALL transactions.",
                txn.transaction_id,
                exc_info=True,
            )

    # ── Fallback: rule-based mock ─────────────────────────────────────────────
    logger.warning(
        "Using MOCK fraud model for txn %s — "
        "pkl model is %s.",
        txn.transaction_id,
        "loaded but failed (see error above)" if model_service.is_loaded() else "not loaded",
    )
    fraud_prob, flags = mock_fraud_model.score(txn)
    return FraudModelResponse(
        fraud_probability=fraud_prob,
        model_version="mock-v1.0",
        source="mock",
    ), flags


def classify_transaction(fraud_probability: float) -> str:
    """Map a fraud probability score → APPROVED / FLAGGED / BLOCKED."""
    settings = get_settings()
    if fraud_probability >= settings.block_threshold:
        return "BLOCKED"
    if fraud_probability >= settings.approved_threshold:
        return "FLAGGED"
    return "APPROVED"
