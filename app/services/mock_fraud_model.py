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
    flags = []
    if txn.merchant_country in HIGH_RISK_COUNTRIES:
        flags.append(f"High-risk merchant country: {txn.merchant_country}")
    if txn.mcc in HIGH_RISK_MCC:
        label = txn.mcc_label or str(txn.mcc)
        flags.append(f"High-risk MCC: {label}")
    if txn.amount >= 10_000:
        flags.append(f"Very large amount: {txn.amount:,.2f} MYR")
    elif txn.amount >= 3_000:
        flags.append(f"Above-average amount: {txn.amount:,.2f} MYR")
    if txn.channel in ("ecommerce", "in_app", "moto"):
        flags.append("Card-not-present transaction")
    if str(txn.avs_result or "").lower() in ("fail", "missing"):
        flags.append("AVS check failed")
    if str(txn.cvc_result or "").lower() in ("fail", "missing"):
        flags.append("CVC check failed")
    if prob >= 0.75:
        flags.append("Score exceeds BLOCK threshold (mock model)")
    elif prob >= 0.40:
        flags.append("Score exceeds FLAG threshold (mock model)")
    return flags
