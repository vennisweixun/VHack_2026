# FraudShield Dashboard — Setup & Run Guide

## Prerequisites

Before you start, make sure you have the following installed on your machine:

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | v18 or higher | `node --version` |
| **npm** | v9 or higher | `npm --version` |

> Download Node.js from [https://nodejs.org](https://nodejs.org) (LTS version recommended).  
> npm is included automatically with Node.js.

---

## Step 1 — Open a Terminal

1. Open **File Explorer** and navigate to your project folder:
   ```
   C:\Users\Vennis\OneDrive\Desktop\VhACK\fraud-dashboard
   ```

2. Click the address bar at the top, type `powershell`, and press **Enter**.  
   This opens PowerShell directly inside the project folder.

   **Or** open PowerShell manually and run:
   ```powershell
   cd "C:\Users\Vennis\OneDrive\Desktop\VhACK\fraud-dashboard"
   ```

---

## Step 2 — Install Dependencies (first time only)

Run this command once to install all required packages:

```powershell
npm install
```

You should see output ending with something like:
```
added 114 packages in 30s
```

> You only need to do this once. Skip this step on future runs.

---

## Step 3 — Start the Development Server

```powershell
npm run dev
```

You will see output like this:

```
  VITE v6.4.1  ready in 630 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 4 — Open the Dashboard in Your Browser

Open any browser (Chrome, Edge, Firefox) and go to:

```
http://localhost:5173
```

The FraudShield Admin Dashboard will load automatically.

> If port `5173` is already in use, Vite will try `5174`, `5175`, etc.  
> Check the terminal output for the exact URL.

---

## Navigating the Dashboard

Once the browser is open, use the **left sidebar** to navigate:

| Page | URL | Description |
|------|-----|-------------|
| Overview | `/` | Key metrics, fraud trend charts, country/MCC breakdowns |
| Transactions | `/transactions` | All transactions with filters and pagination |
| Fraud Alerts | `/fraud-alerts` | Transactions flagged as potential fraud |
| Anomaly Alerts | `/anomaly-alerts` | Transactions with unusual patterns |
| API Settings | `/settings` | Configure your fraud & anomaly detection model APIs |

---

## Connecting Your Detection Models (Optional)

To use real fraud/anomaly detection APIs instead of dummy scores:

1. Go to **API Settings** in the sidebar
2. Under **Fraud Detection Model API**:
   - Paste your model endpoint URL
   - Add your API key (optional)
   - Toggle **Enable** on
   - Click **Test Connection** to verify
3. Do the same for **Anomaly Detection Model API**
4. Click **Save Settings**

Your API must accept a `POST` request with this JSON body:

```json
{
  "transaction_id": "TXN-00000001",
  "amount": 1234.56,
  "currency": "USD",
  "merchant_country": "United States",
  "mcc_code": "5411",
  "channel": "online",
  "customer_id": "CUST-001001",
  "timestamp": "2026-03-15T10:00:00.000Z"
}
```

And return:

```json
{ "fraud_probability": 0.87 }
```
or
```json
{ "anomaly_score": 0.73 }
```

> If no API is configured, the dashboard uses simulated random scores automatically.

---

## Stopping the Server

Press `Ctrl + C` in the terminal to stop the development server.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm` is not recognized | Install Node.js from [nodejs.org](https://nodejs.org) |
| Port already in use | Check terminal for the new port (e.g. `5174`) and use that URL |
| Page shows blank/white | Open browser DevTools (F12) → Console tab and check for errors |
| Packages missing error | Run `npm install` again |
| Changes not reflecting | Hard refresh with `Ctrl + Shift + R` |
