/**
 * Transaction generator matching the training dataset format.
 * These "fake bank transactions" are sent to the FastAPI for real scoring.
 *
 * Dataset fields: card_id, customer_id, merchant_id, amount, merchant_country (2-letter),
 * mcc (int), channel, card_present_flag, entry_mode, issuer_country, home_country,
 * card_brand, avs_result, cvc_result, three_ds_result, ip_country, device_id_hash,
 * network_token_used_flag.
 */

// ─── Lookup tables (matching dataset distributions) ───────────────────────────

const MERCHANT_COUNTRIES = ['SG', 'MY', 'TH', 'JP', 'US', 'NL', 'AU', 'ID', 'GB', 'IE'];

export const COUNTRY_LABELS = {
  SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand', JP: 'Japan',
  US: 'United States', NL: 'Netherlands', AU: 'Australia',
  ID: 'Indonesia', GB: 'United Kingdom', IE: 'Ireland',
};

// MCC codes from dataset
const MCC_LIST = [
  { code: 5411, label: 'Grocery Stores' },
  { code: 5812, label: 'Eating Places' },
  { code: 5912, label: 'Drug Stores' },
  { code: 7011, label: 'Hotels & Lodging' },
  { code: 4111, label: 'Transportation' },
  { code: 5734, label: 'Electronics' },
  { code: 5045, label: 'Computers & Software' },
  { code: 6012, label: 'Financial Services' },
  { code: 5999, label: 'Misc Retail' },
  { code: 7995, label: 'Gambling' },
  { code: 6051, label: 'Crypto Exchange' },
  { code: 4816, label: 'Online Services' },
  { code: 5094, label: 'Jewelry & Watches' },
  { code: 5691, label: 'Clothing Stores' },
  { code: 5541, label: 'Service Stations' },
  { code: 4121, label: 'Taxis & Rideshares' },
  { code: 5311, label: 'Department Stores' },
  { code: 5065, label: 'Electrical Parts' },
];

// Channel config: each channel has specific associated field values
const CHANNEL_CFG = {
  ecommerce: {
    card_present_flag: 0,
    entry_modes:   ['manual', 'tokenized'],
    avs:           ['pass', 'fail', 'unchecked', 'unavailable', 'missing'],
    cvc:           ['pass', 'fail', 'unchecked', 'missing'],
    three_ds:      ['frictionless', 'challenge_passed', 'not_applied', 'unavailable', 'challenge_failed'],
    has_ip: true, has_device: true,
  },
  in_app: {
    card_present_flag: 0,
    entry_modes:   ['tokenized', 'manual'],
    avs:           ['pass', 'unchecked', 'missing'],
    cvc:           ['pass', 'unchecked', 'missing'],
    three_ds:      ['frictionless', 'challenge_passed', 'not_applied'],
    has_ip: true, has_device: true,
  },
  pos: {
    card_present_flag: 1,
    entry_modes:   ['chip', 'contactless', 'swipe'],
    avs:           [null],
    cvc:           [null],
    three_ds:      [null],
    has_ip: false, has_device: false,
  },
  moto: {
    card_present_flag: 0,
    entry_modes:   ['manual'],
    avs:           ['pass', 'fail', 'unchecked', 'unavailable'],
    cvc:           ['pass', 'fail', 'unchecked'],
    three_ds:      ['not_applied', 'unavailable'],
    has_ip: false, has_device: false,
  },
};

const CARD_BRANDS    = ['visa', 'mastercard', 'other', 'amex'];
const ISSUER_CTYS    = ['MY', 'SG', 'ID', 'TH', 'PH', 'VN', 'US', 'GB', 'AU'];
const IP_CTYS        = ['MY', 'SG', 'ID', 'TH', 'PH', 'VN', 'US', 'GB', 'AU', 'CN'];

const MERCHANT_NAMES = {
  5411: ['Giant', 'Tesco', 'Aeon', 'Jaya Grocer', 'Village Grocer'],
  5812: ["McDonald's", 'KFC', 'Starbucks', 'Subway', 'Pizza Hut'],
  5734: ['Harvey Norman', 'Courts', 'Samsung Store', 'Apple Store'],
  5045: ['Dell', 'Lenovo', 'HP', 'Lazada Tech', 'Shopee'],
  7011: ['Hilton', 'Marriott', 'Airbnb', 'Agoda', 'Booking.com'],
  4111: ['KTM', 'RapidKL', 'MRT Corp', 'Grab Transit'],
  6012: ['Maybank', 'CIMB', 'RHB Bank', 'Public Bank'],
  6051: ['Luno', 'Coinbase', 'Binance', 'MX Global'],
  5999: ['Mydin', 'Senheng', 'Parkson', 'Petaling Street'],
  7995: ['Genting Casino', 'Sports Toto', '4D Magnum'],
  4816: ['Netflix', 'Spotify', 'iQIYI', 'YouTube Premium'],
  5094: ['Habib Jewels', 'Wah Chan Gold', 'Poh Kong', 'Tomei'],
  5912: ['Watsons', 'Guardian', 'Big Pharmacy'],
  4121: ['Grab', 'AirAsia RIDE', 'InDrive', 'MyCar'],
  5311: ['Parkson', 'SOGO', 'Isetan', 'Metrojaya'],
  5691: ['Zara', 'H&M', 'Uniqlo', 'Padini'],
  5541: ['Petron', 'Shell', 'BHPetrol', 'Petronas'],
  5065: ['RS Components', 'Farnell', 'Digi-Key'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rand    = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick    = (arr) => arr[randInt(0, arr.length - 1)];

// Unique counter for transaction IDs
let _counter = Date.now();
const nextTxnId = () => String(++_counter);

/**
 * Format timestamp matching dataset: "2024-03-15 14:30:00+08:00"
 */
function makeTimestamp(hoursAgo = 0) {
  const d = new Date();
  d.setTime(d.getTime() - hoursAgo * 3_600_000 + randInt(-1800, 1800) * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  // Use UTC+8 (Malaysia/Singapore)
  const utc8 = new Date(d.getTime() + 8 * 3_600_000);
  return (
    `${utc8.getUTCFullYear()}-${pad(utc8.getUTCMonth() + 1)}-${pad(utc8.getUTCDate())} ` +
    `${pad(utc8.getUTCHours())}:${pad(utc8.getUTCMinutes())}:${pad(utc8.getUTCSeconds())}+08:00`
  );
}

/**
 * Generate a single raw transaction matching dataset format.
 * No fraud scores — those come from the FastAPI / XGBoost model.
 */
export function generateRawTransaction(hoursAgo = 0) {
  const channel = pick(Object.keys(CHANNEL_CFG));
  const cfg     = CHANNEL_CFG[channel];
  const mcc     = pick(MCC_LIST);
  const country = pick(MERCHANT_COUNTRIES);

  // Realistic amount distribution (log-normal-ish)
  const roll = Math.random();
  let amount;
  if      (roll < 0.50) amount = parseFloat(rand(5, 150).toFixed(2));
  else if (roll < 0.75) amount = parseFloat(rand(150, 800).toFixed(2));
  else if (roll < 0.92) amount = parseFloat(rand(800, 4000).toFixed(2));
  else                  amount = parseFloat(rand(4000, 30000).toFixed(2));

  const issuer  = Math.random() < 0.72 ? 'MY' : pick(ISSUER_CTYS);
  const home    = issuer;

  const names   = MERCHANT_NAMES[mcc.code] || ['Unknown Merchant'];

  return {
    transaction_id: nextTxnId(),
    card_id:        randInt(1, 200000),
    customer_id:    randInt(1, 180000),
    merchant_id:    randInt(1, 7900),
    account_id:     null,
    event_ts_utc:   makeTimestamp(hoursAgo),
    amount,
    merchant_country:       country,
    merchant_country_label: COUNTRY_LABELS[country] || country,
    mcc:            mcc.code,
    mcc_label:      mcc.label,
    merchant_name:  pick(names),
    channel,
    card_present_flag:       cfg.card_present_flag,
    entry_mode:              pick(cfg.entry_modes),
    issuer_country:          issuer,
    home_country:            home,
    card_brand:              pick(CARD_BRANDS),
    avs_result:              pick(cfg.avs),
    cvc_result:              pick(cfg.cvc),
    three_ds_result:         pick(cfg.three_ds),
    ip_country:              cfg.has_ip  ? pick(IP_CTYS)        : null,
    device_id_hash:          cfg.has_device ? randInt(100000, 9_999_999) : null,
    network_token_used_flag: Math.random() < 0.30 ? 1 : 0,
  };
}

// ─── Fallback scoring (when API is unreachable) ───────────────────────────────

function classifyStatus(prob) {
  if (prob >= 0.75) return 'BLOCKED';
  if (prob >= 0.40) return 'FLAGGED';
  return 'APPROVED';
}

export function applyFallbackScores(raw) {
  const roll = Math.random();
  let fp;
  if      (roll < 0.07)  fp = parseFloat(rand(0.75, 0.99).toFixed(4));
  else if (roll < 0.20)  fp = parseFloat(rand(0.40, 0.74).toFixed(4));
  else                   fp = parseFloat(rand(0.01, 0.39).toFixed(4));

  const status = classifyStatus(fp);

  return normalizeTransaction({
    ...raw,
    fraud_probability:  fp,
    risk_score:         fp,
    status,
    flags:              [],          // no fabricated flags — API is offline
    fraud_model_source: 'offline',   // signals the dashboard to show offline notice
    received_at:        new Date().toISOString(),
    processed_at:       new Date().toISOString(),
    message:            `Score estimated locally (API unavailable): ${status}`,
  });
}

/**
 * Map an API response (TransactionResponse or TransactionDocument)
 * to the internal format used by all dashboard pages.
 */
export function normalizeTransaction(data) {
  const STATUS_TO_RISK = { BLOCKED: 'HIGH', FLAGGED: 'MEDIUM', APPROVED: 'LOW' };
  return {
    ...data,
    // Risk display fields (backward compat with existing pages)
    risk_level:       STATUS_TO_RISK[data.status] || 'LOW',
    is_fraud_alert:   data.status === 'FLAGGED' || data.status === 'BLOCKED',
    is_anomaly_alert: false,
    anomaly_score:    data.anomaly_score ?? 0,
    risk_score:       data.risk_score ?? data.fraud_probability ?? 0,
    // Display-friendly country name
    merchant_country: data.merchant_country_label || COUNTRY_LABELS[data.merchant_country] || data.merchant_country,
    merchant_country_code: data.merchant_country,  // keep original 2-letter code
    // Unified timestamp
    timestamp: data.event_ts_utc || data.received_at,
    currency:  'MYR',
    // Backward compat fields
    mcc_code:  String(data.mcc ?? data.mcc_code ?? ''),
    bank_id:   data.card_brand ? `${data.card_brand.toUpperCase()}` : 'N/A',
    scored_by: data.fraud_model_source || 'api',
    // 'offline'   = API unreachable, score estimated locally, no explainability
    // 'mock'      = API online but pkl model not loaded, rule-based flags
    // 'pkl_model' = API online + XGBoost model, real SHAP flags
  };
}

// ─── Metric helpers (used by Overview, Charts) ────────────────────────────────

export function getTodayTransactions(transactions) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return transactions.filter(t => new Date(t.timestamp || t.received_at) >= startOfDay);
}

export function getMetrics(transactions) {
  const today        = getTodayTransactions(transactions);
  const fraudAlerts  = today.filter(t => t.is_fraud_alert);
  const anomalyAlerts = today.filter(t => t.is_anomaly_alert);
  const totalVolume  = today.reduce((s, t) => s + t.amount, 0);
  const fraudRate    = today.length > 0
    ? ((fraudAlerts.length / today.length) * 100).toFixed(1)
    : '0.0';

  return {
    totalTransactionsToday: today.length,
    totalFraudAlerts:       fraudAlerts.length,
    totalAnomalyAlerts:     anomalyAlerts.length,
    fraudRate:              parseFloat(fraudRate),
    totalVolumeToday:       totalVolume,
    allTimeFraudAlerts:     transactions.filter(t => t.is_fraud_alert).length,
    allTimeAnomalyAlerts:   transactions.filter(t => t.is_anomaly_alert).length,
    totalTransactions:      transactions.length,
    highRiskCount:   transactions.filter(t => t.risk_level === 'HIGH').length,
    mediumRiskCount: transactions.filter(t => t.risk_level === 'MEDIUM').length,
    lowRiskCount:    transactions.filter(t => t.risk_level === 'LOW').length,
    blockedCount:    transactions.filter(t => t.status === 'BLOCKED').length,
    flaggedCount:    transactions.filter(t => t.status === 'FLAGGED').length,
    approvedCount:   transactions.filter(t => t.status === 'APPROVED').length,
  };
}

export function getFraudTrendData(transactions) {
  const days = 14;
  return Array.from({ length: days }, (_, i) => {
    const d    = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const label    = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd   = new Date(dayStart.getTime() + 86_400_000);
    const dayTxns  = transactions.filter(t => {
      const ts = new Date(t.timestamp || t.received_at);
      return ts >= dayStart && ts < dayEnd;
    });
    return {
      date:    label,
      fraud:   dayTxns.filter(t => t.is_fraud_alert).length,
      anomaly: dayTxns.filter(t => t.is_anomaly_alert).length,
      total:   dayTxns.length,
    };
  });
}

export function getRiskDistribution(transactions) {
  const m = getMetrics(transactions);
  return [
    { name: 'Low Risk',    value: m.lowRiskCount,    color: '#10b981' },
    { name: 'Medium Risk', value: m.mediumRiskCount,  color: '#f59e0b' },
    { name: 'High Risk',   value: m.highRiskCount,    color: '#e11d48' },
  ];
}

export function getFraudByCountry(transactions) {
  const byCountry = {};
  transactions.filter(t => t.is_fraud_alert).forEach(t => {
    byCountry[t.merchant_country] = (byCountry[t.merchant_country] || 0) + 1;
  });
  return Object.entries(byCountry)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function getFraudByMCC(transactions) {
  const byMCC = {};
  transactions.filter(t => t.is_fraud_alert).forEach(t => {
    const label = t.mcc_label || t.mcc_code || 'Unknown';
    byMCC[label] = (byMCC[label] || 0) + 1;
  });
  return Object.entries(byMCC)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function getHourlyVolume(transactions) {
  const today = getTodayTransactions(transactions);
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    volume: 0,
    count: 0,
  }));
  today.forEach(t => {
    const h = new Date(t.timestamp || t.received_at).getHours();
    if (h >= 0 && h < 24) {
      hours[h].volume += t.amount;
      hours[h].count  += 1;
    }
  });
  return hours.map(h => ({ ...h, volume: parseFloat(h.volume.toFixed(2)) }));
}
