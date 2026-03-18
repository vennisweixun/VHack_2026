"""
patch_pkl.py
Add label_encoders and freq_maps to the existing fraud_model.pkl.
Run once after the original pipeline (which saved only model + feature_cols).

Usage:
    cd C:\\Users\\Vennis\\OneDrive\\Desktop\\VhACK
    python patch_pkl.py
"""

import pickle
import pandas as pd
from sklearn.preprocessing import LabelEncoder

MODEL_PKL   = r"C:\Users\Mjian\OneDrive\Documents\GitHub\VHack_2026\fraud_model.pkl"
TRAIN_CLEAN = r"C:\Users\Mjian\OneDrive\Documents\GitHub\VHack_2026\train_clean.csv"

LABEL_COLS = [
    "merchant_country", "channel", "entry_mode",
    "issuer_country", "home_country", "card_brand",
    "avs_result", "cvc_result", "three_ds_result", "ip_country",
]
FREQ_COLS = ["card_id", "customer_id", "merchant_id", "mcc", "device_id_hash"]


def main():
    print("\n" + "=" * 50)
    print("  FraudShield PKL Patcher")
    print("=" * 50)

    # 1. Load clean training data
    print("\n[1] Loading train_clean.csv ...")
    print("    (may take ~30 seconds for 3.4M rows)")
    df = pd.read_csv(TRAIN_CLEAN)
    print(f"    Shape: {df.shape}")

    # 2. Prepare categoricals — fill NaN with 'missing' (matches pipeline)
    print("\n[2] Preparing categorical columns ...")
    for col in LABEL_COLS:
        if col in df.columns:
            df[col] = df[col].fillna("missing").astype(str)

    # 3. Build LabelEncoders
    print("\n[3] Building LabelEncoders ...")
    le_maps = {}
    for col in LABEL_COLS:
        if col in df.columns:
            le = LabelEncoder()
            le.fit(df[col])
            le_maps[col] = le
            classes_preview = list(le.classes_)[:8]
            print(f"    {col:30s}: {len(le.classes_)} classes -> {classes_preview}")

    # 4. Build frequency maps (card_id, merchant_id, mcc, etc.)
    print("\n[4] Building frequency maps ...")
    for col in FREQ_COLS:
        if col in df.columns:
            df[col] = df[col].fillna(-1)

    freq_maps = {}
    for col in FREQ_COLS:
        if col in df.columns:
            freq_maps[col] = df[col].value_counts().to_dict()
            print(f"    {col:30s}: {len(freq_maps[col]):,} unique values")

    # 5. Load existing pkl
    print(f"\n[5] Loading existing model from {MODEL_PKL} ...")
    with open(MODEL_PKL, "rb") as f:
        model_data = pickle.load(f)
    print(f"    Existing keys: {list(model_data.keys())}")
    print(f"    Features: {len(model_data.get('feature_cols', []))}")

    # 6. Inject encoders
    model_data["label_encoders"] = le_maps
    model_data["freq_maps"]      = freq_maps

    # 7. Save
    print(f"\n[6] Saving patched pkl to {MODEL_PKL} ...")
    with open(MODEL_PKL, "wb") as f:
        pickle.dump(model_data, f)

    print("\n" + "=" * 50)
    print("  PATCHING COMPLETE")
    print("=" * 50)
    print(f"  Keys: {list(model_data.keys())}")
    print("\n  Restart the FastAPI server to load the updated model.")
    print()


if __name__ == "__main__":
    main()
