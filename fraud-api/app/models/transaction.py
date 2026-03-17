"""
Pydantic models for the FraudShield transaction pipeline.
Fields now match the training dataset format (card_id, mcc int, channel enum, etc.)
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid


TransactionStatus = Literal["APPROVED", "FLAGGED", "BLOCKED"]


# ─── Incoming request from the bank / dashboard ───────────────────────────────

class TransactionRequest(BaseModel):
    """
    Transaction payload sent by the bank system (or dashboard simulator).
    Matches the dataset columns used during model training.
    """
    transaction_id: Optional[str] = Field(
        default=None,
        description="Unique transaction ID (auto-generated if omitted)"
    )

    # Card / account identifiers
    card_id:     int = Field(..., description="Card identifier (integer)")
    customer_id: int = Field(..., description="Customer identifier (integer)")
    merchant_id: int = Field(..., description="Merchant identifier (integer)")
    account_id:  Optional[int] = Field(default=None)

    # Transaction core
    event_ts_utc: str   = Field(..., description="Timestamp e.g. '2024-01-15 14:30:00+08:00'")
    amount:       float = Field(..., gt=0, description="Transaction amount in MYR")

    # Merchant
    merchant_country: str = Field(..., description="2-letter country code: MY, SG, US …")
    mcc:              int = Field(..., description="Merchant Category Code (integer)")
    mcc_label:        Optional[str] = Field(default=None, description="Human-readable MCC label")
    merchant_name:    Optional[str] = Field(default=None, description="Merchant name (display only)")
    merchant_country_label: Optional[str] = Field(default=None, description="Full country name (display)")

    # Channel & card attributes
    channel:         Literal["ecommerce", "in_app", "pos", "moto"]
    card_present_flag: int = Field(default=0, ge=0, le=1)
    entry_mode:      Literal["manual", "tokenized", "chip", "contactless", "swipe"]
    issuer_country:  str = Field(..., description="Card issuer country code")
    home_country:    str = Field(..., description="Cardholder home country code")
    card_brand:      Literal["visa", "mastercard", "other", "amex"]

    # Security checks (nullable for POS / offline channels)
    avs_result:       Optional[str] = None   # pass | fail | unchecked | unavailable | missing
    cvc_result:       Optional[str] = None
    three_ds_result:  Optional[str] = None

    # Network / device
    ip_country:             Optional[str] = None
    device_id_hash:         Optional[int] = None
    network_token_used_flag: Optional[int] = Field(default=None, ge=0, le=1)

    model_config = {
        "json_schema_extra": {
            "example": {
                "card_id": 12345,
                "customer_id": 9876,
                "merchant_id": 441,
                "event_ts_utc": "2024-03-15 14:30:00+08:00",
                "amount": 350.00,
                "merchant_country": "MY",
                "mcc": 5411,
                "mcc_label": "Grocery Stores",
                "channel": "ecommerce",
                "card_present_flag": 0,
                "entry_mode": "tokenized",
                "issuer_country": "MY",
                "home_country": "MY",
                "card_brand": "visa",
                "avs_result": "pass",
                "cvc_result": "pass",
                "three_ds_result": "frictionless",
                "ip_country": "MY",
                "device_id_hash": 7654321,
                "network_token_used_flag": 1,
            }
        }
    }


# ─── Model response ────────────────────────────────────────────────────────────

class FraudModelResponse(BaseModel):
    fraud_probability: float = Field(..., ge=0.0, le=1.0)
    model_version: Optional[str] = None
    source: Literal["pkl_model", "mock"] = "mock"


# ─── Full document stored in MongoDB ─────────────────────────────────────────

class TransactionDocument(BaseModel):
    """The complete record persisted in MongoDB."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str

    # Dataset fields
    card_id:     int
    customer_id: int
    merchant_id: int
    account_id:  Optional[int] = None
    event_ts_utc: str
    amount:       float
    merchant_country: str
    mcc:              int
    mcc_label:        Optional[str] = None
    merchant_name:    Optional[str] = None
    merchant_country_label: Optional[str] = None
    channel:          str
    card_present_flag: int = 0
    entry_mode:       str
    issuer_country:   str
    home_country:     str
    card_brand:       str
    avs_result:       Optional[str] = None
    cvc_result:       Optional[str] = None
    three_ds_result:  Optional[str] = None
    ip_country:       Optional[str] = None
    device_id_hash:   Optional[int] = None
    network_token_used_flag: Optional[int] = None

    # Detection scores
    fraud_probability: float
    anomaly_score:     Optional[float] = None
    risk_score:        float

    # Classification
    status: TransactionStatus
    flags:  list[str] = Field(default_factory=list)

    # Model metadata
    fraud_model_source:  str
    fraud_model_version: Optional[str] = None

    # Timestamps
    received_at:  datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None


# ─── API response returned to the caller (bank / dashboard) ──────────────────

class TransactionResponse(BaseModel):
    """
    Returned after processing a transaction.
    Includes all original fields (for dashboard display) plus scoring results.
    """
    # Identity & result
    transaction_id: str
    status:           TransactionStatus
    fraud_probability: float
    risk_score:        float
    flags:             list[str]
    fraud_model_source: str
    message:           str
    received_at:       datetime
    processed_at:      datetime

    # Echo original transaction fields for dashboard display
    card_id:     int
    customer_id: int
    merchant_id: int
    account_id:  Optional[int] = None
    event_ts_utc: str
    amount:       float
    merchant_country: str
    mcc:              int
    mcc_label:        Optional[str] = None
    merchant_name:    Optional[str] = None
    merchant_country_label: Optional[str] = None
    channel:          str
    card_present_flag: int
    entry_mode:       str
    issuer_country:   str
    home_country:     str
    card_brand:       str
    avs_result:       Optional[str] = None
    cvc_result:       Optional[str] = None
    three_ds_result:  Optional[str] = None
    ip_country:       Optional[str] = None
    device_id_hash:   Optional[int] = None
    network_token_used_flag: Optional[int] = None


class TransactionListResponse(BaseModel):
    total:        int
    page:         int
    page_size:    int
    transactions: list[TransactionDocument]
