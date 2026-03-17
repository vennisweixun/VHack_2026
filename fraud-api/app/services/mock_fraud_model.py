"""
Rule-based mock fraud scoring model.
Used when fraud_model.pkl is not loaded (dev/fallback only).
"""

from app.models.transaction import TransactionRequest

# High-risk merchant countries (2-letter codes from dataset)
HIGH_RISK_COUNTRIES = {
    "NG": 0.30, "RU": 0.28, "UA": 0.25, "RO": 0.22,
    "CN": 0.15, "BR": 0.12, "MX": 0.10, "ZA": 0.10,
    "US": 0.05,
}

# High-risk MCC codes
HIGH_RISK_MCC = {
    7995: 0.25,  # Gambling
    6051: 0.22,  # Crypto Exchange
    6012: 0.15,  # Financial Services
    5094: 0.15,  # Jewelry & Watches
    4816: 0.10,  # Online Services
    5045: 0.08,  # Computers & Software
}

# Channel risk weights
CHANNEL_RISK = {
    "moto":       0.18,
    "ecommerce":  0.08,
    "in_app":     0.05,
    "pos":        0.02,
}


def _amount_risk(amount: float) -> float:
    if amount >= 20_000: return 0.35
    if amount >= 10_000: return 0.25
    if amount >= 5_000:  return 0.18
    if amount >= 2_000:  return 0.10
    if amount >= 500:    return 0.04
    return 0.01


def score(txn: TransactionRequest) -> tuple[float, list[str]]:
    base = 0.05
    base += _amount_risk(txn.amount)
    base += HIGH_RISK_COUNTRIES.get(txn.merchant_country, 0.0)
    base += HIGH_RISK_MCC.get(txn.mcc, 0.0)
    base += CHANNEL_RISK.get(txn.channel, 0.0)

    # Card-not-present bonus
    if txn.channel in ("ecommerce", "in_app", "moto") and not txn.card_present_flag:
        base += 0.05

    # Failed security checks
    if str(txn.avs_result or "").lower() in ("fail", "missing"):
        base += 0.08
    if str(txn.cvc_result or "").lower() in ("fail", "missing"):
        base += 0.08
    if str(txn.three_ds_result or "").lower() in ("challenge_failed", "unavailable"):
        base += 0.10

    # Cross-border
    if txn.issuer_country and txn.merchant_country and txn.issuer_country != txn.merchant_country:
        base += 0.04

    fraud_probability = round(min(max(base, 0.01), 0.99), 4)
    flags = _build_flags(txn, fraud_probability)
    return fraud_probability, flags


def _build_flags(txn: TransactionRequest, prob: float) -> list[str]:
    """
    Rule-based flags derived directly from transaction fields.
    These are honest explanations of why the mock model scored this transaction —
    each flag corresponds to a real risk weight applied in score().
    Prefixed with [rule-based] so the dashboard can distinguish from SHAP flags.
    """
    flags = []
    if txn.merchant_country in HIGH_RISK_COUNTRIES:
        risk = HIGH_RISK_COUNTRIES[txn.merchant_country]
        flags.append(f"[rule] Merchant country {txn.merchant_country} carries elevated fraud risk (+{risk:.2f})")
    if txn.mcc in HIGH_RISK_MCC:
        label = txn.mcc_label or str(txn.mcc)
        risk = HIGH_RISK_MCC[txn.mcc]
        flags.append(f"[rule] High-risk merchant category: {label} (+{risk:.2f})")
    if txn.amount >= 10_000:
        flags.append(f"[rule] Very large transaction amount: MYR {txn.amount:,.2f}")
    elif txn.amount >= 3_000:
        flags.append(f"[rule] Above-average transaction amount: MYR {txn.amount:,.2f}")
    if txn.channel in ("ecommerce", "in_app", "moto") and not txn.card_present_flag:
        flags.append(f"[rule] Card-not-present transaction via {txn.channel}")
    if str(txn.avs_result or "").lower() in ("fail", "missing"):
        flags.append("[rule] AVS check failed or missing (+0.08)")
    if str(txn.cvc_result or "").lower() in ("fail", "missing"):
        flags.append("[rule] CVC check failed or missing (+0.08)")
    if str(txn.three_ds_result or "").lower() in ("challenge_failed", "unavailable"):
        flags.append("[rule] 3DS authentication issue (+0.10)")
    if txn.issuer_country and txn.merchant_country and txn.issuer_country != txn.merchant_country:
        flags.append(f"[rule] Cross-border transaction: card from {txn.issuer_country}, merchant in {txn.merchant_country}")
    channel_risk = CHANNEL_RISK.get(txn.channel, 0)
    if channel_risk >= 0.08:
        flags.append(f"[rule] High-risk channel: {txn.channel} (+{channel_risk:.2f})")
    return flags
