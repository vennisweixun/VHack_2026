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

Explainability: SHAP TreeExplainer is used to compute per-feature contributions
to the fraud score. Top contributors are returned as human-readable flag strings.
"""

import logging
import pickle
from typing import Optional

import numpy as np
import pandas as pd

try:
    import shap as _shap
    _SHAP_AVAILABLE = True
except ImportError:
    _SHAP_AVAILABLE = False

logger = logging.getLogger(__name__)

_model_data: Optional[dict] = None
_explainer: Optional[object] = None   # cached shap.TreeExplainer
_scale_pos_weight: float = 1.0        # cached for calibration

# Human-readable explanation sentences for each feature when it contributes positively to fraud
_FEATURE_EXPLANATIONS: dict[str, str] = {
    "amount":                    "Transaction amount is unusually high",
    "card_present_flag":         "Card was not physically present at time of transaction",
    "network_token_used_flag":   "Network token used, indicating a digital or card-on-file transaction",
    "year":                      "Transaction year is unusual for this pattern",
    "month":                     "Transaction month is atypical for this card",
    "day":                       "Day of month is unusual for this card",
    "hour":                      "Transaction occurred at an unusual hour",
    "minute":                    "Transaction timing appears irregular",
    "day_of_week":               "Unusual day of week for this card's activity",
    "is_weekend":                "Weekend timing is atypical for this card",
    "merchant_country":          "Merchant is located in a high-risk or unexpected country",
    "channel":                   "Transaction channel carries elevated fraud risk",
    "entry_mode":                "Card entry mode is associated with higher fraud rates",
    "issuer_country":            "Card-issuing country does not match transaction location",
    "home_country":              "Transaction occurred outside the cardholder's home country",
    "card_brand":                "Card brand is associated with elevated fraud patterns",
    "avs_result":                "Address verification (AVS) check raised a concern",
    "cvc_result":                "Card security code (CVC) check raised a concern",
    "three_ds_result":           "3D Secure authentication was not completed successfully",
    "ip_country":                "IP address originates from a high-risk or mismatched location",
    "card_id_freq":              "Card has limited transaction history, suggesting it is new or rarely used",
    "customer_id_freq":          "Customer account shows abnormal activity levels",
    "merchant_id_freq":          "This merchant shows an unusual transaction pattern",
    "mcc_freq":                  "Merchant category is uncommon or associated with elevated risk",
    "device_id_hash_freq":       "Device has limited or suspicious usage history",
    "card_avg_amount":           "Transaction amount significantly exceeds this card's average spend",
    "card_std_amount":           "Spend amount is highly inconsistent with this card's history",
    "time_since_last_txn_sec":   "Very short interval since the previous transaction on this card",
    "card_txn_per_day":          "Unusually high number of transactions on this card today",
    "merchant_txn_per_day":      "Abnormally high transaction volume at this merchant today",
    "device_txn_count":          "Device shows a high number of recent transactions",
    "device_unique_cards":       "Multiple different cards have been used on this device",
    "card_unique_mcc_countries": "Card has been used across an unusually wide range of countries",
    "card_channel_diversity":    "Card is being used across an unusual mix of transaction channels",
    "amount_zscore":             "Transaction amount is a significant outlier compared to this card's history",
}

LABEL_COLS = [
    "merchant_country", "channel", "entry_mode",
    "issuer_country", "home_country", "card_brand",
    "avs_result", "cvc_result", "three_ds_result", "ip_country",
]
FREQ_COLS = ["card_id", "customer_id", "merchant_id", "mcc", "device_id_hash"]


# ── Probability calibration ─────────────────────────────────────────────────────

def _calibrate_prob(prob_raw: float, scale_pos_weight: float) -> float:
    """
    Prior-correction calibration for XGBoost models trained with scale_pos_weight.

    When XGBoost is trained with scale_pos_weight=w on a dataset where fraud is
    rare (e.g. 1:668), the model's predict_proba output is compressed into a tiny
    range (e.g. 0.0001–0.05) because the class-imbalance prior is baked into every
    prediction.

    This function removes that prior bias by adding log(w) to the raw log-odds:
        corrected_logit = logit(prob_raw) + log(scale_pos_weight)
        calibrated_prob = sigmoid(corrected_logit)

    Result: a full 0–1 probability where 0.5 means "features are equally
    consistent with fraud and legitimate transactions", independent of base rate.
    Thresholds of 0.40 (FLAGGED) and 0.75 (BLOCKED) are appropriate for this range.

    If scale_pos_weight == 1.0 (balanced training), the correction is zero and
    prob_raw is returned unchanged.
    """
    if scale_pos_weight <= 1.0:
        return prob_raw
    logit_raw = np.log(max(prob_raw, 1e-10) / max(1.0 - prob_raw, 1e-10))
    logit_corrected = logit_raw + np.log(scale_pos_weight)
    return float(1.0 / (1.0 + np.exp(-logit_corrected)))


# ── Public API ─────────────────────────────────────────────────────────────────

def load_model(path: str) -> bool:
    """Load the pkl model and build the SHAP explainer. Returns True on success."""
    global _model_data, _explainer, _scale_pos_weight
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

        # Extract scale_pos_weight for probability calibration
        try:
            spw = float(_model_data["model"].get_params().get("scale_pos_weight", 1.0))
        except Exception:
            spw = float(_model_data.get("scale_pos_weight", 1.0))
        _scale_pos_weight = spw
        logger.info(
            "XGBoost model loaded: %d features, encoders=%s, scale_pos_weight=%.1f",
            len(_model_data["feature_cols"]),
            "yes" if has_encoders else "NO",
            _scale_pos_weight,
        )
        if _scale_pos_weight > 1.0:
            logger.info(
                "Probability calibration enabled: prior-correction with scale_pos_weight=%.1f "
                "(raw probabilities will be stretched to full 0–1 range).",
                _scale_pos_weight,
            )

        # Build SHAP TreeExplainer (cached — fast at prediction time)
        if _SHAP_AVAILABLE:
            try:
                _explainer = _shap.TreeExplainer(
                    _model_data["model"],
                    feature_perturbation="tree_path_dependent",
                )
                logger.info("SHAP TreeExplainer ready.")
            except Exception as exc:
                logger.warning("SHAP explainer could not be built: %s. Explainability disabled.", exc)
                _explainer = None
        else:
            logger.warning("shap package not installed. Explainability disabled. Run: pip install shap")
            _explainer = None

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
        return {
            "loaded":           False,
            "shap_available":   False,
            "shap_package":     _SHAP_AVAILABLE,
        }
    return {
        "loaded":           True,
        "features":         len(_model_data.get("feature_cols", [])),
        "has_encoders":     "label_encoders" in _model_data,
        "model_type":       type(_model_data["model"]).__name__,
        "shap_available":   _explainer is not None,
        "shap_package":     _SHAP_AVAILABLE,
        "scale_pos_weight": _scale_pos_weight,
        "prob_calibrated":  _scale_pos_weight > 1.0,
    }


def predict_fraud(
    txn_dict: dict,
    card_history: Optional[list] = None,
) -> tuple[float, list[str]]:
    """
    Predict fraud probability for a transaction and compute SHAP explanations.

    Args:
        txn_dict:     dict with transaction fields (matches dataset format)
        card_history: recent transactions for this card_id from MongoDB

    Returns:
        (fraud_probability in [0,1], flags: list of SHAP-derived explanation strings)
    """
    if not is_loaded():
        raise RuntimeError("Fraud model not loaded. Set MODEL_PATH in .env and restart.")

    card_hist = card_history or []
    features  = _build_features(txn_dict, card_hist)

    feature_cols = _model_data["feature_cols"]
    X = pd.DataFrame([{col: features.get(col, 0) for col in feature_cols}])

    proba      = _model_data["model"].predict_proba(X)
    prob_raw   = float(proba[0, 1])

    # Apply prior-correction to expand compressed probabilities to full 0–1 range.
    # Models trained with scale_pos_weight>1 embed the class-imbalance prior into
    # every prediction; calibration removes that bias.
    fraud_prob = _calibrate_prob(prob_raw, _scale_pos_weight)

    flags = _shap_flags(X, feature_cols, fraud_prob=fraud_prob)

    # Guarantee explanations for MEDIUM / HIGH risk — fall back to derived rules
    # if SHAP is unavailable or returned nothing.
    if not flags and fraud_prob >= 0.40:
        logger.info(
            "SHAP returned no flags for fraud_prob=%.4f — using derived fallback.", fraud_prob
        )
        flags = _derived_flags(txn_dict, fraud_prob)

    return round(fraud_prob, 4), flags


def _shap_flags(
    X: "pd.DataFrame",
    feature_cols: list[str],
    fraud_prob: float = 0.0,
    top_n: int = 5,
) -> list[str]:
    """
    Compute SHAP values and return the top fraud-increasing features as plain
    human-readable sentences.

    Only features with positive SHAP values (pushing toward fraud) are returned.
    SHAP values and direction arrows are intentionally omitted from the output.

    fraud_prob here is the calibrated probability (0–1 range after prior-correction),
    so the 0.40 / LOW-risk threshold is meaningful and directly comparable to the
    FLAGGED/BLOCKED thresholds in config.

      MEDIUM / HIGH risk (fraud_prob >= 0.40):  always return top_n positive features.
      LOW risk           (fraud_prob  < 0.40):  return positive features with SHAP > 1e-4.
    """
    if _explainer is None:
        return []

    try:
        shap_vals = _explainer.shap_values(X)

        # TreeExplainer for binary XGBoost may return:
        #   list of two arrays  → take index 1  (class = fraud)
        #   single 2-D array    → row 0 is our transaction
        if isinstance(shap_vals, list):
            vals = np.asarray(shap_vals[1][0], dtype=float)
        else:
            vals = np.asarray(shap_vals[0], dtype=float)

        # Keep only positive contributions (features pushing toward fraud),
        # sorted by magnitude (largest first)
        positive_pairs = sorted(
            [(feat, sv) for feat, sv in zip(feature_cols, vals.tolist()) if sv > 0],
            key=lambda kv: kv[1],
            reverse=True,
        )

        is_medium_or_high = fraud_prob >= 0.40
        min_val = 0.0 if is_medium_or_high else 1e-4

        flags = []
        for feat, sv in positive_pairs[:top_n]:
            if sv < min_val:
                break
            explanation = _FEATURE_EXPLANATIONS.get(
                feat,
                feat.replace("_", " ").title() + " is a contributing risk factor",
            )
            flags.append(explanation)

        if not flags and is_medium_or_high:
            # Edge case: no positive SHAP values at all — surface the highest-magnitude feature
            logger.warning(
                "No positive SHAP values for fraud_prob=%.4f — using top-magnitude feature.", fraud_prob
            )
            all_pairs = sorted(
                zip(feature_cols, vals.tolist()),
                key=lambda kv: abs(kv[1]),
                reverse=True,
            )
            feat, _ = all_pairs[0] if all_pairs else ("unknown", 0)
            explanation = _FEATURE_EXPLANATIONS.get(
                feat,
                feat.replace("_", " ").title() + " is a contributing risk factor",
            )
            flags.append(explanation)

        return flags

    except Exception as exc:
        logger.warning("SHAP value computation failed: %s", exc, exc_info=True)
        return []


def _derived_flags(txn: dict, fraud_prob: float) -> list[str]:
    """
    Rule-based explanation derived directly from transaction fields.
    Called ONLY when SHAP is unavailable and fraud_prob >= 0.40 (MEDIUM / HIGH risk).
    Each flag is prefixed with [derived] so the dashboard renders it distinctly.
    """
    flags: list[str] = []

    # Score context
    if fraud_prob >= 0.75:
        flags.append(
            f"[derived] XGBoost fraud score {fraud_prob*100:.2f}% — exceeds BLOCK threshold (≥75%)"
        )
    else:
        flags.append(
            f"[derived] XGBoost fraud score {fraud_prob*100:.2f}% — exceeds FLAG threshold (≥40%)"
        )

    # Amount
    amount = float(txn.get("amount", 0))
    if amount >= 10_000:
        flags.append(f"[derived] Very high transaction amount: MYR {amount:,.2f}")
    elif amount >= 3_000:
        flags.append(f"[derived] Above-average transaction amount: MYR {amount:,.2f}")

    # Card-not-present
    channel = str(txn.get("channel", ""))
    if channel in ("ecommerce", "in_app", "moto") and not txn.get("card_present_flag"):
        flags.append(f"[derived] Card-not-present transaction via {channel}")

    # Security checks
    if str(txn.get("avs_result") or "").lower() in ("fail", "missing"):
        flags.append("[derived] AVS address verification failed or missing")
    if str(txn.get("cvc_result") or "").lower() in ("fail", "missing"):
        flags.append("[derived] CVC card security code failed or missing")
    if str(txn.get("three_ds_result") or "").lower() in ("challenge_failed", "unavailable"):
        flags.append("[derived] 3DS authentication challenge failed or unavailable")

    # Cross-border
    issuer   = str(txn.get("issuer_country") or "")
    merchant = str(txn.get("merchant_country") or "")
    home     = str(txn.get("home_country") or "")
    if issuer and merchant and issuer != merchant:
        flags.append(
            f"[derived] Cross-border transaction: card issued in {issuer}, "
            f"merchant in {merchant}"
        )
    if home and merchant and home != merchant:
        flags.append(f"[derived] Transaction outside cardholder home country ({home})")

    # High-risk MCC
    HIGH_RISK_MCC_LABELS = {7995: "Gambling", 6051: "Crypto Exchange", 6012: "Financial Services"}
    mcc = txn.get("mcc")
    if mcc and mcc in HIGH_RISK_MCC_LABELS:
        flags.append(f"[derived] High-risk merchant category: {HIGH_RISK_MCC_LABELS[mcc]}")

    return flags


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


