import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.transaction import (
    TransactionRequest,
    TransactionDocument,
    TransactionResponse,
    TransactionListResponse,
)
from app.services import fraud_service, database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transactions", tags=["Transactions"])


# ─── POST /transactions ───────────────────────────────────────────────────────

@router.post(
    "",
    response_model=TransactionResponse,
    status_code=201,
    summary="Submit a transaction for fraud detection",
    description="""
Accepts a bank transaction (dataset format), runs it through the XGBoost fraud model,
classifies the result as **APPROVED / FLAGGED / BLOCKED**, stores it in MongoDB,
and returns the full scoring result.

**Scoring thresholds:**

| fraud_probability | status |
|---|---|
| < 0.40 | ✅ APPROVED |
| 0.40 – 0.74 | ⚠️ FLAGGED |
| ≥ 0.75 | 🚫 BLOCKED |
""",
)
async def submit_transaction(body: TransactionRequest):
    received_at = datetime.now(timezone.utc)

    if not body.transaction_id:
        body.transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"

    logger.info(
        "Processing transaction %s  card=%s  amount=%.2f  channel=%s",
        body.transaction_id, body.card_id, body.amount, body.channel,
    )

    # ── 1. Fetch card history for behavioural features ─────────────────────
    try:
        card_history = await database.get_card_history(body.card_id, limit=50)
    except Exception as exc:
        logger.warning("Could not fetch card history for card %s: %s", body.card_id, exc)
        card_history = []

    # ── 2. Score with fraud model ──────────────────────────────────────────
    fraud_result, flags = await fraud_service.score_transaction(body, card_history)

    # ── 3. Classify ────────────────────────────────────────────────────────
    status = fraud_service.classify_transaction(fraud_result.fraud_probability)
    risk_score = round(fraud_result.fraud_probability, 4)
    processed_at = datetime.now(timezone.utc)

    # ── 4. Build MongoDB document ──────────────────────────────────────────
    doc = TransactionDocument(
        transaction_id=body.transaction_id,
        card_id=body.card_id,
        customer_id=body.customer_id,
        merchant_id=body.merchant_id,
        account_id=body.account_id,
        event_ts_utc=body.event_ts_utc,
        amount=body.amount,
        merchant_country=body.merchant_country,
        mcc=body.mcc,
        mcc_label=body.mcc_label,
        merchant_name=body.merchant_name,
        merchant_country_label=body.merchant_country_label,
        channel=body.channel,
        card_present_flag=body.card_present_flag,
        entry_mode=body.entry_mode,
        issuer_country=body.issuer_country,
        home_country=body.home_country,
        card_brand=body.card_brand,
        avs_result=body.avs_result,
        cvc_result=body.cvc_result,
        three_ds_result=body.three_ds_result,
        ip_country=body.ip_country,
        device_id_hash=body.device_id_hash,
        network_token_used_flag=body.network_token_used_flag,
        fraud_probability=fraud_result.fraud_probability,
        risk_score=risk_score,
        status=status,
        flags=flags,
        fraud_model_source=fraud_result.source,
        fraud_model_version=fraud_result.model_version,
        received_at=received_at,
        processed_at=processed_at,
    )

    # ── 5. Persist ─────────────────────────────────────────────────────────
    try:
        await database.insert_transaction(doc.model_dump())
        logger.info(
            "Saved %s → %s  fraud_prob=%.4f  flags=%d",
            body.transaction_id, status, fraud_result.fraud_probability, len(flags),
        )
    except Exception as exc:
        logger.error("Failed to save transaction %s: %s", body.transaction_id, exc)
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    # ── 6. Return ─────────────────────────────────────────────────────────
    messages = {
        "APPROVED": "Transaction approved. No significant fraud indicators detected.",
        "FLAGGED":  "Transaction flagged for manual review. Elevated fraud probability.",
        "BLOCKED":  "Transaction blocked. High fraud probability detected.",
    }

    return TransactionResponse(
        transaction_id=doc.transaction_id,
        status=status,
        fraud_probability=fraud_result.fraud_probability,
        risk_score=risk_score,
        flags=flags,
        fraud_model_source=fraud_result.source,
        message=messages[status],
        received_at=received_at,
        processed_at=processed_at,
        # Echo back all original fields
        card_id=body.card_id,
        customer_id=body.customer_id,
        merchant_id=body.merchant_id,
        account_id=body.account_id,
        event_ts_utc=body.event_ts_utc,
        amount=body.amount,
        merchant_country=body.merchant_country,
        mcc=body.mcc,
        mcc_label=body.mcc_label,
        merchant_name=body.merchant_name,
        merchant_country_label=body.merchant_country_label,
        channel=body.channel,
        card_present_flag=body.card_present_flag,
        entry_mode=body.entry_mode,
        issuer_country=body.issuer_country,
        home_country=body.home_country,
        card_brand=body.card_brand,
        avs_result=body.avs_result,
        cvc_result=body.cvc_result,
        three_ds_result=body.three_ds_result,
        ip_country=body.ip_country,
        device_id_hash=body.device_id_hash,
        network_token_used_flag=body.network_token_used_flag,
    )


# ─── GET /transactions ────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=TransactionListResponse,
    summary="List all processed transactions",
    description="Returns a paginated list of all processed transactions, newest first.",
)
async def list_transactions(
    page:           int   = Query(default=1,    ge=1,          description="Page number"),
    page_size:      int   = Query(default=50,   ge=1, le=200,  description="Results per page"),
    status:         Optional[str]   = Query(default=None, description="Filter: APPROVED, FLAGGED, BLOCKED"),
    min_fraud_prob: Optional[float] = Query(default=None, ge=0.0, le=1.0),
):
    total, docs = await database.list_transactions(
        page=page,
        page_size=page_size,
        status=status,
        min_fraud_prob=min_fraud_prob,
    )
    return TransactionListResponse(
        total=total,
        page=page,
        page_size=page_size,
        transactions=[TransactionDocument(**d) for d in docs],
    )


# ─── GET /transactions/{transaction_id} ──────────────────────────────────────

@router.get(
    "/{transaction_id}",
    response_model=TransactionDocument,
    summary="Get a single transaction by ID",
)
async def get_transaction(transaction_id: str):
    doc = await database.get_transaction_by_id(transaction_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Transaction '{transaction_id}' not found.")
    return TransactionDocument(**doc)
