# FraudShield — FastAPI Backend

A FastAPI service that receives bank transactions, sends them through a fraud detection model, classifies the result, and stores everything in MongoDB.

---

## Project Structure

```
fraud-api/
├── app/
│   ├── main.py                   ← FastAPI entry point, CORS, lifespan
│   ├── core/
│   │   └── config.py             ← Settings loaded from .env
│   ├── models/
│   │   └── transaction.py        ← Pydantic request/response models
│   ├── services/
│   │   ├── fraud_service.py      ← Calls external API or falls back to mock
│   │   ├── mock_fraud_model.py   ← Built-in rule-based fraud scorer
│   │   └── database.py           ← MongoDB (Motor async driver)
│   └── routes/
│       └── transactions.py       ← POST/GET /transactions endpoints
├── requirements.txt
├── .env                          ← Your local config (not committed)
└── .env.example                  ← Template
```

---

## Quick Start

### 1 — Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11 or higher |
| MongoDB | Running locally on port 27017 |

Download MongoDB Community: https://www.mongodb.com/try/download/community  
During install, choose **"Install MongoDB as a Service"** so it starts automatically.

### 2 — Create a virtual environment

```powershell
cd "C:\Users\Vennis\OneDrive\Desktop\VhACK\fraud-api"

python -m venv venv
.\venv\Scripts\Activate.ps1
```

> If you get a permission error, run:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### 3 — Install dependencies

```powershell
pip install -r requirements.txt
```

### 4 — Configure environment

```powershell
copy .env.example .env
```

The default `.env` works out of the box with a local MongoDB and the built-in mock fraud model.

### 5 — Start the API server

```powershell
uvicorn app.main:app --reload --port 8000
```

The API is now running at: **http://localhost:8000**

---

## Interactive API Docs

Open your browser and go to:

| URL | Description |
|-----|-------------|
| http://localhost:8000/docs | Swagger UI — test endpoints interactively |
| http://localhost:8000/redoc | ReDoc — clean API reference |
| http://localhost:8000/health | Quick health check |

---

## API Endpoints

### POST `/api/v1/transactions`

Submit a transaction for fraud detection.

**Request Body:**
```json
{
  "customer_id": "CUST-001042",
  "bank_id": "BNK-001",
  "merchant_name": "Amazon",
  "amount": 4999.99,
  "currency": "USD",
  "merchant_country": "United States",
  "merchant_country_code": "US",
  "mcc_code": "5045",
  "mcc_label": "Computers & Software",
  "channel": "online",
  "device_id": "DEV-A1B2C3D4",
  "ip_address": "192.168.1.100"
}
```

**Response:**
```json
{
  "transaction_id": "TXN-A1B2C3D4E5F6",
  "status": "FLAGGED",
  "fraud_probability": 0.4600,
  "risk_score": 0.4600,
  "flags": [
    "Above-average transaction amount: 4999.99 USD",
    "Online transaction with elevated amount",
    "Score exceeds FLAG threshold"
  ],
  "fraud_model_source": "mock",
  "received_at": "2026-03-16T10:00:00Z",
  "processed_at": "2026-03-16T10:00:00.012Z",
  "message": "Transaction flagged for manual review. Elevated fraud probability."
}
```

---

### GET `/api/v1/transactions`

List all processed transactions (paginated, newest first).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `page_size` | int | 50 | Results per page (max 200) |
| `status` | string | — | Filter: `APPROVED`, `FLAGGED`, or `BLOCKED` |
| `min_fraud_prob` | float | — | Filter by minimum fraud probability |

---

### GET `/api/v1/transactions/{transaction_id}`

Get a single transaction by ID.

---

## Risk Classification

| fraud_probability | Status | Meaning |
|---|---|---|
| < 0.40 | ✅ **APPROVED** | Low risk — transaction proceeds normally |
| 0.40 – 0.74 | ⚠️ **FLAGGED** | Elevated risk — flagged for manual review |
| ≥ 0.75 | 🚫 **BLOCKED** | High risk — transaction blocked |

Thresholds are configurable in `.env`:
```
APPROVED_THRESHOLD=0.40
BLOCK_THRESHOLD=0.75
```

---

## Connecting a Real Fraud Detection Model

By default the API uses a built-in **rule-based mock model**.
To use your real ML model, set `FRAUD_MODEL_URL` in `.env`:

```
FRAUD_MODEL_URL=http://your-model-server/predict
FRAUD_MODEL_API_KEY=your-api-key-here   # optional
```

Your model must accept a `POST` request with the transaction JSON body and return:
```json
{ "fraud_probability": 0.87 }
```

If the external call fails for any reason, the API **automatically falls back** to the mock model so transactions are never lost.

---

## Testing with curl

```powershell
curl -X POST http://localhost:8000/api/v1/transactions `
  -H "Content-Type: application/json" `
  -d '{
    "customer_id": "CUST-001042",
    "bank_id": "BNK-001",
    "merchant_name": "Binance",
    "amount": 15000,
    "currency": "USD",
    "merchant_country": "Nigeria",
    "merchant_country_code": "NG",
    "mcc_code": "6051",
    "mcc_label": "Crypto Exchange",
    "channel": "wire_transfer"
  }'
```

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB_NAME` | `fraudshield` | Database name |
| `FRAUD_MODEL_URL` | _(empty)_ | External model endpoint. Leave empty to use mock |
| `FRAUD_MODEL_API_KEY` | _(empty)_ | Bearer token for external model (optional) |
| `APPROVED_THRESHOLD` | `0.40` | Below this → APPROVED |
| `BLOCK_THRESHOLD` | `0.75` | Above this → BLOCKED |
