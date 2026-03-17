"""
Fraud Detection ML Pipeline
============================
Steps:
  1. Data Cleaning        — remove duplicates, save train_clean.csv / test_clean.csv
  2. Feature Engineering  — datetime, behavioural, frequency encoding (in-memory)
  3. Missing Value Handling
  4. Model Training       — XGBoost on full training data
  5. Output              — fraud_model.pkl, classification_report.txt, feature_importance.csv

Outputs:
    C:\\FraudShield\\train_clean.csv          (cleaned raw data, no engineered features)
    C:\\FraudShield\\test_clean.csv           (cleaned raw data, no engineered features)
    C:\\FraudShield\\fraud_model.pkl          (trained XGBoost model + feature list)
    C:\\FraudShield\\classification_report.txt
    C:\\FraudShield\\feature_importance.csv

Usage:
    python fraud_model_pipeline.py
"""

import os
import sys
import time
import pickle
import warnings

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

warnings.filterwarnings("ignore")
pd.set_option("display.max_columns", None)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

# All outputs go to a local folder outside OneDrive to avoid sync-lock errors.
OUT_DIR = r"C:\FraudShield"
os.makedirs(OUT_DIR, exist_ok=True)

TRAIN_RAW       = os.path.join(DATASET_DIR, "train.csv")
TEST_RAW        = os.path.join(DATASET_DIR, "test.csv")
TRAIN_CLEAN     = os.path.join(OUT_DIR, "train_clean.csv")
TEST_CLEAN      = os.path.join(OUT_DIR, "test_clean.csv")
MODEL_OUT       = os.path.join(OUT_DIR, "fraud_model.pkl")
REPORT_OUT      = os.path.join(OUT_DIR, "classification_report.txt")
FEATURE_IMP_OUT = os.path.join(OUT_DIR, "feature_importance.csv")

# ── Column configuration ──────────────────────────────────────────────────────
SINGLE_VALUE_COLS = ["currency", "card_type"]   # zero variance → drop

LABEL_ENCODE_COLS = [
    "merchant_country", "channel", "entry_mode",
    "issuer_country", "home_country", "card_brand",
    "avs_result", "cvc_result", "three_ds_result", "ip_country",
]

# High-cardinality IDs → replaced by their frequency in train
FREQ_ENCODE_COLS = ["card_id", "customer_id", "merchant_id", "mcc", "device_id_hash"]

# Columns to drop before model training
DROP_FOR_MODEL = [
    "transaction_id", "account_id",
    "event_ts_utc", "date",
] + FREQ_ENCODE_COLS   # originals replaced by *_freq versions


# ══════════════════════════════════════════════════════════════════════════════
# Utility — robust CSV writer (retries on Windows file-lock)
# ══════════════════════════════════════════════════════════════════════════════

def save_csv(df: pd.DataFrame, path: str, max_retries: int = 5, delay: int = 3) -> None:
    """Write a DataFrame to CSV with retry logic for Windows file-lock errors."""
    for attempt in range(1, max_retries + 1):
        try:
            df.to_csv(path, index=False)
            print(f"  Saved -> {path}  ({df.shape[0]:,} rows x {df.shape[1]} cols)")
            return
        except PermissionError as exc:
            if attempt < max_retries:
                print(f"  [!] File locked (attempt {attempt}/{max_retries}), "
                      f"retrying in {delay}s… ({exc})")
                time.sleep(delay)
            else:
                print(f"  [!] Could not save CSV after {max_retries} attempts.")
                alt_path = path.replace(".csv", ".parquet")
                print(f"  [!] Saving as Parquet instead -> {alt_path}")
                df.to_parquet(alt_path, index=False)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — DATA CLEANING
# ══════════════════════════════════════════════════════════════════════════════

def load_and_clean(path: str, label: str) -> pd.DataFrame:
    sep = "=" * 60
    print(f"\n{sep}")
    print(f"[1] Cleaning {label}")
    print(f"{sep}")

    df = pd.read_csv(path)
    print(f"  Raw shape          : {df.shape}")

    before = len(df)
    df = df.drop_duplicates(subset="transaction_id", keep="first")
    print(f"  Duplicate rows removed : {before - len(df):,}")
    print(f"  Shape after dedup  : {df.shape}")

    existing = [c for c in SINGLE_VALUE_COLS if c in df.columns]
    if existing:
        df.drop(columns=existing, inplace=True)
        print(f"  Dropped zero-variance columns: {existing}")

    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════════════

# ── 2a. Datetime ──────────────────────────────────────────────────────────────

def add_datetime_features(df: pd.DataFrame) -> pd.DataFrame:
    df["event_ts_utc"] = pd.to_datetime(df["event_ts_utc"], utc=True)

    df["year"]        = df["event_ts_utc"].dt.year
    df["month"]       = df["event_ts_utc"].dt.month
    df["day"]         = df["event_ts_utc"].dt.day
    df["hour"]        = df["event_ts_utc"].dt.hour
    df["minute"]      = df["event_ts_utc"].dt.minute
    df["day_of_week"] = df["event_ts_utc"].dt.dayofweek
    df["is_weekend"]  = df["day_of_week"].isin([5, 6]).astype(int)
    df["date"]        = df["event_ts_utc"].dt.date   # helper for daily aggregations
    return df


# ── 2b. Build aggregation tables (from train only) ────────────────────────────

def build_agg_tables(train: pd.DataFrame) -> dict:
    print("\n[2b] Building behavioural aggregation tables from train …")

    t = train.sort_values(["card_id", "event_ts_utc"])

    # Card global stats
    card_agg = (
        t.groupby("card_id")
        .agg(
            card_avg_amount           =("amount",           "mean"),
            card_std_amount           =("amount",           "std"),
            card_unique_mcc_countries =("merchant_country", "nunique"),
            card_channel_diversity    =("channel",          "nunique"),
        )
        .reset_index()
    )
    card_agg["card_std_amount"] = card_agg["card_std_amount"].fillna(0)

    # Card transactions per (card_id, date)
    card_day = (
        t.groupby(["card_id", "date"])
        .size()
        .reset_index(name="card_txn_per_day")
    )

    # Merchant transactions per (merchant_id, date)
    merchant_day = (
        t.groupby(["merchant_id", "date"])
        .size()
        .reset_index(name="merchant_txn_per_day")
    )

    # Device stats
    device_agg = (
        t.groupby("device_id_hash")
        .agg(
            device_txn_count   =("transaction_id", "count"),
            device_unique_cards=("card_id",        "nunique"),
        )
        .reset_index()
    )

    tables = dict(
        card_agg=card_agg,
        card_day=card_day,
        merchant_day=merchant_day,
        device_agg=device_agg,
    )
    for k, v in tables.items():
        print(f"  {k}: {v.shape}")
    return tables


# ── 2c. Apply behavioural features ───────────────────────────────────────────

def apply_behavioural(df: pd.DataFrame, tables: dict) -> pd.DataFrame:
    df = df.sort_values(["card_id", "event_ts_utc"]).reset_index(drop=True)

    # Time since last transaction per card (seconds)
    prev = df.groupby("card_id")["event_ts_utc"].shift(1)
    df["time_since_last_txn_sec"] = (df["event_ts_utc"] - prev).dt.total_seconds()
    df["time_since_last_txn_sec"].fillna(
        df["time_since_last_txn_sec"].median(), inplace=True
    )

    df = df.merge(tables["card_agg"],    on="card_id",                   how="left")
    df = df.merge(tables["card_day"],    on=["card_id",    "date"],       how="left")
    df = df.merge(tables["merchant_day"],on=["merchant_id","date"],       how="left")
    df = df.merge(tables["device_agg"],  on="device_id_hash",            how="left")

    df["amount_zscore"] = (
        (df["amount"] - df["card_avg_amount"])
        / (df["card_std_amount"] + 1e-8)
    )
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — MISSING VALUE HANDLING
# ══════════════════════════════════════════════════════════════════════════════

def handle_missing(df: pd.DataFrame, label: str) -> pd.DataFrame:
    print(f"\n[3] Handling missing values — {label}")

    # Categorical security fields — missingness is itself a signal
    for col in ["avs_result", "cvc_result", "three_ds_result", "ip_country"]:
        if col in df.columns:
            n = df[col].isnull().sum()
            if n:
                df[col].fillna("missing", inplace=True)
                print(f"  {col}: {n:,} NaN -> 'missing'")

    # Binary flag — assume not used
    if "network_token_used_flag" in df.columns:
        n = df["network_token_used_flag"].isnull().sum()
        if n:
            df["network_token_used_flag"].fillna(0, inplace=True)
            print(f"  network_token_used_flag: {n:,} NaN -> 0")

    # Device ID — unknown device
    if "device_id_hash" in df.columns:
        n = df["device_id_hash"].isnull().sum()
        if n:
            df["device_id_hash"].fillna(-1, inplace=True)
            print(f"  device_id_hash: {n:,} NaN -> -1")

    # Behavioural aggregates that may be NaN for unseen cards/merchants in test
    behav = [
        "card_avg_amount", "card_std_amount",
        "card_unique_mcc_countries", "card_channel_diversity",
        "card_txn_per_day", "merchant_txn_per_day",
        "device_txn_count", "device_unique_cards",
    ]
    for col in behav:
        if col in df.columns:
            df[col].fillna(df[col].median(), inplace=True)

    # Any remaining numeric NaN -> median
    for col in df.select_dtypes(include=[np.number]).columns:
        n = df[col].isnull().sum()
        if n:
            df[col].fillna(df[col].median(), inplace=True)
            print(f"  {col}: {n:,} NaN -> median")

    total_nan = df.isnull().sum().sum()
    print(f"  Total NaN remaining: {total_nan}")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — ENCODING
# ══════════════════════════════════════════════════════════════════════════════

def build_label_encoders(train: pd.DataFrame) -> dict:
    encoders = {}
    for col in LABEL_ENCODE_COLS:
        if col in train.columns:
            le = LabelEncoder()
            le.fit(train[col].astype(str).fillna("missing"))
            encoders[col] = le
    return encoders


def apply_label_encoding(df: pd.DataFrame, encoders: dict) -> pd.DataFrame:
    for col, le in encoders.items():
        if col in df.columns:
            known = set(le.classes_)
            df[col] = (
                df[col].astype(str)
                       .fillna("missing")
                       .apply(lambda x: x if x in known else le.classes_[0])
            )
            df[col] = le.transform(df[col])
    return df


def build_freq_encoders(train: pd.DataFrame) -> dict:
    return {
        col: train[col].value_counts().to_dict()
        for col in FREQ_ENCODE_COLS if col in train.columns
    }


def apply_freq_encoding(df: pd.DataFrame, freq_maps: dict) -> pd.DataFrame:
    for col, freq_map in freq_maps.items():
        if col in df.columns:
            df[f"{col}_freq"] = df[col].map(freq_map).fillna(0).astype(int)
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — TRAIN MODEL
# ══════════════════════════════════════════════════════════════════════════════

def train_model(train: pd.DataFrame):
    print("\n" + "=" * 60)
    print("[5] Training XGBoost Fraud Detection Model")
    print("=" * 60)

    drop_cols = [c for c in DROP_FOR_MODEL if c in train.columns]
    X = train.drop(columns=drop_cols + ["is_fraud"], errors="ignore")
    y = train["is_fraud"]

    n_neg, n_pos = (y == 0).sum(), (y == 1).sum()
    spw = n_neg / n_pos

    print(f"  Features : {X.shape[1]}")
    print(f"  Samples  : {X.shape[0]:,}")
    print(f"  Fraud    : {n_pos:,}  ({n_pos/len(y)*100:.3f}%)")
    print(f"  scale_pos_weight = {spw:.1f}")
    print(f"  Feature list: {list(X.columns)}")

    model = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=spw,
        eval_metric="aucpr",
        random_state=42,
        n_jobs=-1,
        verbosity=1,
    )

    print("\n  Fitting model …")
    model.fit(X, y)
    print("  Training complete.")

    y_pred = model.predict(X)
    y_prob = model.predict_proba(X)[:, 1]
    report = classification_report(y, y_pred, target_names=["Legit", "Fraud"], digits=4)
    roc    = roc_auc_score(y, y_prob)
    cm     = confusion_matrix(y, y_pred)

    print("\n  Classification Report (train set — for reference):")
    print(report)
    print(f"  ROC-AUC (train): {roc:.6f}")
    print(f"  Confusion Matrix: TN={cm[0,0]:,}  FP={cm[0,1]:,} | FN={cm[1,0]:,}  TP={cm[1,1]:,}")

    return model, list(X.columns), report, roc, cm


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — SAVE OUTPUTS
# ══════════════════════════════════════════════════════════════════════════════

def save_outputs(model, feature_cols, report, roc, cm,
                 le_maps=None, freq_maps=None) -> None:
    print("\n[6] Saving model outputs …")

    pkl_payload = {
        "model":          model,
        "feature_cols":   feature_cols,
        "label_encoders": le_maps   or {},
        "freq_maps":      freq_maps or {},
    }
    with open(MODEL_OUT, "wb") as f:
        pickle.dump(pkl_payload, f)
    print(f"  Model saved        -> {MODEL_OUT}")
    print(f"  (includes label_encoders and freq_maps for live inference)")

    with open(REPORT_OUT, "w") as f:
        f.write("FraudShield — XGBoost Fraud Detection Model\n")
        f.write("=" * 60 + "\n\n")
        f.write("Classification Report (train set):\n")
        f.write(report + "\n")
        f.write(f"ROC-AUC (train): {roc:.6f}\n\n")
        f.write(f"Confusion Matrix:\n")
        f.write(f"  TN={cm[0,0]:,}  FP={cm[0,1]:,}\n")
        f.write(f"  FN={cm[1,0]:,}  TP={cm[1,1]:,}\n\n")
        f.write("Features used:\n")
        for feat in feature_cols:
            f.write(f"  - {feat}\n")
    print(f"  Report saved       -> {REPORT_OUT}")

    importance = model.get_booster().get_fscore()
    if importance:
        imp_df = (
            pd.DataFrame.from_dict(importance, orient="index", columns=["importance"])
            .sort_values("importance", ascending=False)
            .reset_index()
            .rename(columns={"index": "feature"})
        )
        imp_df.to_csv(FEATURE_IMP_OUT, index=False)
        print(f"  Feature importance -> {FEATURE_IMP_OUT}")
        print("\n  Top 15 features:")
        print(imp_df.head(15).to_string(index=False))


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  FRAUDSHIELD ML PIPELINE")
    print("=" * 60)
    print(f"  Input  : {DATASET_DIR}")
    print(f"  Output : {OUT_DIR}")

    # ── 1. Load and clean raw data ─────────────────────────────────────────────
    train_raw = load_and_clean(TRAIN_RAW, "train.csv")
    test_raw  = load_and_clean(TEST_RAW,  "test.csv")

    # ── Save clean CSVs (deduplicated raw data, no engineered features yet) ────
    print("\n[*] Saving train_clean.csv …")
    save_csv(train_raw, TRAIN_CLEAN)

    print("[*] Saving test_clean.csv …")
    save_csv(test_raw, TEST_CLEAN)

    # ── 2. Feature engineering (in-memory on copies of clean data) ────────────
    print("\n[2] Feature Engineering …")
    train = train_raw.copy()
    test  = test_raw.copy()

    print("  [2a] Datetime features …")
    train = add_datetime_features(train)
    test  = add_datetime_features(test)

    agg_tables = build_agg_tables(train)

    print("  [2c] Behavioural features …")
    train = apply_behavioural(train, agg_tables)
    test  = apply_behavioural(test,  agg_tables)

    # ── 3. Missing value handling ─────────────────────────────────────────────
    train = handle_missing(train, "train")
    test  = handle_missing(test,  "test")

    # ── 4. Encoding ───────────────────────────────────────────────────────────
    print("\n[4] Encoding categoricals …")
    le_maps   = build_label_encoders(train)
    freq_maps = build_freq_encoders(train)

    train = apply_label_encoding(train, le_maps)
    train = apply_freq_encoding(train,  freq_maps)
    test  = apply_label_encoding(test,  le_maps)
    test  = apply_freq_encoding(test,   freq_maps)

    print(f"  Train shape after encoding: {train.shape}")
    print(f"  Test  shape after encoding: {test.shape}")

    # ── 5. Train model ────────────────────────────────────────────────────────
    model, feature_cols, report, roc, cm = train_model(train)

    # ── 6. Save model artefacts ───────────────────────────────────────────────
    save_outputs(model, feature_cols, report, roc, cm, le_maps, freq_maps)

    print("\n" + "=" * 60)
    print("  PIPELINE COMPLETE")
    print("=" * 60)
    print(f"\n  All outputs in: {OUT_DIR}")
    print("    train_clean.csv")
    print("    test_clean.csv")
    print("    fraud_model.pkl")
    print("    classification_report.txt")
    print("    feature_importance.csv\n")


if __name__ == "__main__":
    main()
