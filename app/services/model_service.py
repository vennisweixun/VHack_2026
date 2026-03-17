"""
FraudShield XGBoost Model Service
===================================
Loads fraud_model.pkl (produced by fraud_model_pipeline.py + patch_pkl.py)
and performs real-time fraud probability prediction.

The pkl must contain:
  model          — fitted XGBClassifier
  feature_cols   — ordered list of 35 feature names
  label_encoders — {col: LabelEncoder}  (added by patch_pkl.py)
  freq_maps      — {col: {value: count}} (added by patch_pkl.py)
"""

import logging
import pickle
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_model_data: Optional[dict] = None

LABEL_COLS = [
    "merchant_country", "channel", "entry_mode",
    "issuer_country", "home_country", "card_brand",
    "avs_result", "cvc_result", "three_ds_result", "ip_country",
]
FREQ_COLS = ["card_id", "customer_id", "merchant_id", "mcc", "device_id_hash"]


# ── Public API ─────────────────────────────────────────────────────────────────

def load_model(path: str) -> bool:
    """Load the pkl model.  Returns True on success."""
    global _model_data
    try:
        with open(path, "rb") as f:
            _model_data = pickle.load(f)

        required = {"model", "feature_cols"}
        if not required.issubset(_model_data.keys()):
            logger.error("pkl missing required keys. Found: %s", list(_model_data.keys()))
            _model_data = None
            return False

        has_encoders = "label_encoders" in _model_data and "freq_maps" in _model_data
        if not has_encoders:
            logger.warning(
                "pkl is missing label_encoders / freq_maps. "
                "Run `python patch_pkl.py` to add them. "
                "Predictions will fall back to zero-encoded values."
            )

        logger.info(
            "XGBoost model loaded: %d features, encoders=%s",
            len(_model_data["feature_cols"]),
            "yes" if has_encoders else "NO",
        )
        return True

    except FileNotFoundError:
        logger.error("Model file not found: %s", path)
        return False
    except Exception as exc:
        logger.error("Failed to load model: %s", exc, exc_info=True)
        _model_data = None
        return False


def is_loaded() -> bool:
    return _model_data is not None


def model_info() -> dict:
    if not is_loaded():
        return {"loaded": False}
    return {
        "loaded": True,
        "features": len(_model_data.get("feature_cols", [])),
        "has_encoders": "label_encoders" in _model_data,
        "model_type": type(_model_data["model"]).__name__,
    }


def predict_fraud(
    txn_dict: dict,
    card_history: Optional[list] = None,
) -> tuple[float, list[str]]:
    """
    Predict fraud probability for a transaction.

    Args:
        txn_dict:     dict with transaction fields (matches dataset format)
        card_history: recent transactions for this card_id from MongoDB

    Returns:
        (fraud_probability in [0,1], flags: list of risk indicator strings)
    """
    if not is_loaded():
        raise RuntimeError("Fraud model not loaded. Set MODEL_PATH in .env and restart.")

    card_hist = card_history or []
    features = _build_features(txn_dict, card_hist)

    feature_cols = _model_data["feature_cols"]
    X = pd.DataFrame([{col: features.get(col, 0) for col in feature_cols}])

    fraud_prob = float(_model_data["model"].predict_proba(X)[0, 1])
    flags = _generate_flags(txn_dict, fraud_prob, card_hist)
    return round(fraud_prob, 4), flags


# ── Feature engineering ────────────────────────────────────────────────────────

def _build_features(txn: dict, card_history: list) -> dict:
    """Build the 35-feature vector matching the training pipeline."""
    f: dict = {}

    # Direct numeric
    f["amount"]                  = float(txn.get("amount", 0))
    f["card_present_flag"]       = int(txn.get("card_present_flag", 0))
    f["network_token_used_flag"] = int(txn.get("network_token_used_flag") or 0)

    # Datetime from event_ts_utc (or fallback)
    ts_raw = txn.get("event_ts_utc") or txn.get("timestamp") or txn.get("received_at")
    try:
        ts = pd.to_datetime(ts_raw, utc=True)
    except Exception:
        ts = pd.Timestamp.now(tz="UTC")

    f["year"]        = ts.year
    f["month"]       = ts.month
    f["day"]         = ts.day
    f["hour"]        = ts.hour
    f["minute"]      = ts.minute
    f["day_of_week"] = ts.dayofweek
    f["is_weekend"]  = 1 if ts.dayofweek in (5, 6) else 0

    # Label-encoded categoricals
    le_maps = _model_data.get("label_encoders", {})
    for col in LABEL_COLS:
        le = le_maps.get(col)
        if le is None:
            f[col] = 0
            continue
        val = str(txn.get(col) or "missing")
        known = set(le.classes_)
        if val not in known:
            val = "missing" if "missing" in known else le.classes_[0]
        f[col] = int(le.transform([val])[0])

    # Frequency-encoded IDs
    freq_maps = _model_data.get("freq_maps", {})
    for col in FREQ_COLS:
        fm = freq_maps.get(col, {})
        val = txn.get(col)
        if val is None:
            val = -1
        # freq_maps keys may be int or float — try both
        count = fm.get(val, fm.get(int(val) if isinstance(val, float) else val, 0))
        f[f"{col}_freq"] = int(count)

    # Behavioural features
    if card_history:
        amounts   = [float(h.get("amount", 0)) for h in card_history]
        card_avg  = float(np.mean(amounts))
        card_std  = float(np.std(amounts)) if len(amounts) > 1 else 0.0

        f["card_avg_amount"] = card_avg
        f["card_std_amount"] = card_std

        # Time since last transaction
        try:
            last_raw = (
                card_history[-1].get("event_ts_utc")
                or card_history[-1].get("received_at")
            )
            last_ts = pd.to_datetime(last_raw, utc=True)
            f["time_since_last_txn_sec"] = max(0.0, (ts - last_ts).total_seconds())
        except Exception:
            f["time_since_last_txn_sec"] = 0.0

        # Card diversity
        countries = {h.get("merchant_country", "") for h in card_history}
        channels  = {h.get("channel", "") for h in card_history}
        f["card_unique_mcc_countries"] = len(countries)
        f["card_channel_diversity"]    = len(channels)

        # Daily counts
        today = ts.date().isoformat()
        card_today = [
            h for h in card_history
            if str(h.get("event_ts_utc", "") or h.get("received_at", ""))[:10] == today
        ]
        f["card_txn_per_day"] = len(card_today) + 1

        merch_today = [
            h for h in card_today
            if str(h.get("merchant_id", "")) == str(txn.get("merchant_id", ""))
        ]
        f["merchant_txn_per_day"] = len(merch_today) + 1

        # Device features
        this_device = txn.get("device_id_hash")
        if this_device is not None:
            dev_txns  = [h for h in card_history if h.get("device_id_hash") == this_device]
            dev_cards = {h.get("card_id") for h in dev_txns}
        else:
            dev_txns, dev_cards = [], set()
        f["device_txn_count"]    = len(dev_txns) + 1
        f["device_unique_cards"] = max(1, len(dev_cards))

        # Amount z-score
        f["amount_zscore"] = (
            (f["amount"] - card_avg) / (card_std + 1e-8) if card_std > 0 else 0.0
        )
    else:
        # First transaction for this card — safe defaults
        f.update({
            "time_since_last_txn_sec":   0.0,
            "card_avg_amount":           f["amount"],
            "card_std_amount":           0.0,
            "card_txn_per_day":          1,
            "merchant_txn_per_day":      1,
            "device_txn_count":          1,
            "device_unique_cards":       1,
            "card_unique_mcc_countries": 1,
            "card_channel_diversity":    1,
            "amount_zscore":             0.0,
        })

    return f


def _generate_flags(txn: dict, fraud_prob: float, card_history: list) -> list[str]:
    """Generate human-readable risk flags for a transaction."""
    flags = []
    amount  = float(txn.get("amount", 0))
    channel = str(txn.get("channel", ""))

    # Parse hour for off-hours check
    ts_raw = txn.get("event_ts_utc") or txn.get("timestamp")
    try:
        hour = pd.to_datetime(ts_raw, utc=True).hour
    except Exception:
        hour = 12

    if fraud_prob >= 0.75:
        flags.append("High fraud probability score")
    elif fraud_prob >= 0.40:
        flags.append("Elevated fraud probability")

    if amount > 5000:
        flags.append("Unusually large transaction amount")

    if channel in ("ecommerce", "in_app", "moto") and not txn.get("card_present_flag"):
        flags.append("Card-not-present transaction")

    issuer   = str(txn.get("issuer_country") or "")
    merchant = str(txn.get("merchant_country") or "")
    home     = str(txn.get("home_country") or "")
    if issuer and merchant and issuer != merchant:
        flags.append("Cross-border transaction")
    if home and merchant and home != merchant:
        flags.append("Transaction outside home country")

    if str(txn.get("avs_result") or "") in ("fail", "missing"):
        flags.append("AVS check failed or missing")
    if str(txn.get("cvc_result") or "") in ("fail", "missing"):
        flags.append("CVC check failed or missing")
    if str(txn.get("three_ds_result") or "") in ("challenge_failed", "unavailable"):
        flags.append("3DS authentication issue")

    if hour < 5 or hour >= 22:
        flags.append("Off-hours transaction")

    if card_history:
        amounts = [float(h.get("amount", 0)) for h in card_history]
        avg = np.mean(amounts)
        std = np.std(amounts)
        if std > 0 and abs(amount - avg) > 3 * std:
            flags.append("Abnormal amount vs card history")

        today = datetime.now(timezone.utc).date().isoformat()
        today_count = sum(
            1 for h in card_history
            if str(h.get("event_ts_utc", "") or h.get("received_at", ""))[:10] == today
        )
        if today_count >= 10:
            flags.append("High transaction velocity today")

    return flags
