"""
MongoDB service using Motor (async driver).

Collections
-----------
  transactions  — one document per processed transaction
"""

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import DESCENDING, IndexModel

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect() -> None:
    """Open the MongoDB connection and ensure indexes exist."""
    global _client, _db
    settings = get_settings()

    masked = settings.mongodb_url.split("@")[-1] if "@" in settings.mongodb_url else settings.mongodb_url
    logger.info("Connecting to MongoDB …  host: %s", masked)

    _client = AsyncIOMotorClient(settings.mongodb_url)
    _db = _client[settings.mongodb_db_name]

    await _client.admin.command("ping")
    logger.info("MongoDB ping OK — database: '%s'", settings.mongodb_db_name)

    await _ensure_indexes()


async def disconnect() -> None:
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed.")


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialised. Call connect() first.")
    return _db


async def _ensure_indexes() -> None:
    col = _db["transactions"]
    indexes = [
        IndexModel([("transaction_id", DESCENDING)], unique=True, name="idx_transaction_id"),
        IndexModel([("received_at", DESCENDING)],    name="idx_received_at"),
        IndexModel([("status", DESCENDING)],         name="idx_status"),
        IndexModel([("card_id", DESCENDING)],        name="idx_card_id"),
        IndexModel([("customer_id", DESCENDING)],    name="idx_customer_id"),
        IndexModel([("fraud_probability", DESCENDING)], name="idx_fraud_probability"),
    ]
    try:
        await col.create_indexes(indexes)
        logger.info("MongoDB indexes ensured on 'transactions'.")
    except Exception as exc:
        logger.warning("Could not create indexes (non-fatal): %s", exc)


# ─── CRUD helpers ─────────────────────────────────────────────────────────────

async def insert_transaction(doc: dict) -> str:
    col = get_db()["transactions"]
    await col.insert_one(doc)
    return doc["transaction_id"]


async def get_transaction_by_id(transaction_id: str) -> Optional[dict]:
    col = get_db()["transactions"]
    return await col.find_one({"transaction_id": transaction_id}, {"_id": 0})


async def get_card_history(card_id: int, limit: int = 50) -> list[dict]:
    """
    Fetch the most recent transactions for a card (newest first).
    Used for behavioural feature computation before model prediction.
    """
    col = get_db()["transactions"]
    cursor = (
        col.find({"card_id": card_id}, {"_id": 0})
        .sort("received_at", DESCENDING)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    # Return in chronological order (oldest first) for time-delta calculations
    return list(reversed(docs))


async def update_transaction_status(transaction_id: str, new_status: str) -> bool:
    """Update the status of a transaction. Returns True if a document was modified."""
    col = get_db()["transactions"]
    result = await col.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"status": new_status}},
    )
    return result.modified_count > 0


async def list_transactions(
    page: int = 1,
    page_size: int = 50,
    status: Optional[str] = None,
    min_fraud_prob: Optional[float] = None,
) -> tuple[int, list[dict]]:
    """Return a paginated list of transactions, newest first."""
    col = get_db()["transactions"]
    query: dict = {}

    if status:
        query["status"] = status.upper()
    if min_fraud_prob is not None:
        query["fraud_probability"] = {"$gte": min_fraud_prob}

    total = await col.count_documents(query)
    skip = (page - 1) * page_size

    cursor = (
        col.find(query, {"_id": 0})
        .sort("received_at", DESCENDING)
        .skip(skip)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)
    return total, docs
