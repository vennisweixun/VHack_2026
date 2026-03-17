/**
 * useTransactions
 * ================
 * Simulates a bank sending transactions to the FastAPI backend every 8 seconds.
 * Each transaction is:
 *   1. Generated locally (dataset format, no scores)
 *   2. POSTed to http://localhost:8000/api/v1/transactions
 *   3. XGBoost model scores it → returns APPROVED / FLAGGED / BLOCKED
 *   4. Stored in MongoDB by the API
 *   5. Displayed in the dashboard
 *
 * Additionally, every 30 seconds the hook syncs from MongoDB (GET /transactions)
 * to catch any transactions that may have been submitted outside the dashboard.
 *
 * If the API is unreachable, a rule-based fallback score is used instead.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateRawTransaction, applyFallbackScores, normalizeTransaction } from '../data/dummyData';

const API_BASE      = 'http://localhost:8000/api/v1';
const INJECT_MS     = 6000;   // 1 transaction every 6 s  → 10 per minute
const SYNC_MS       = 30000;  // sync from DB every 30 s
const INITIAL_FETCH = 100;    // how many historical records to load on mount

// ─── Console debug helper ─────────────────────────────────────────────────────

const LOG_STYLE = {
  header:   'color:#6366f1;font-weight:bold',
  ok:       'color:#10b981;font-weight:bold',
  warn:     'color:#f59e0b;font-weight:bold',
  error:    'color:#e11d48;font-weight:bold',
  blocked:  'color:#e11d48;font-weight:bold',
  flagged:  'color:#f59e0b;font-weight:bold',
  approved: 'color:#10b981;font-weight:bold',
  muted:    'color:#6b7280',
  sync:     'color:#0ea5e9;font-weight:bold',
};

function statusStyle(status) {
  return LOG_STYLE[status?.toLowerCase()] || LOG_STYLE.muted;
}

// ─── POST a single transaction to the API ────────────────────────────────────

async function postTransaction(raw) {
  const t0  = Date.now();
  const res = await fetch(`${API_BASE}/transactions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(raw),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }

  const data    = await res.json();
  const scored  = normalizeTransaction(data);
  const latency = Date.now() - t0;

  // ── Per-transaction debug line ──────────────────────────────────────────
  console.log(
    `%c[FraudShield]%c ✓ ${scored.transaction_id}` +
    `%c  →  ${scored.status}` +
    `%c  fraud_prob: ${(scored.fraud_probability * 100).toFixed(2)}%` +
    `%c  model: ${scored.fraud_model_source || 'api'}` +
    `%c  (${latency}ms)`,
    LOG_STYLE.header,
    LOG_STYLE.muted,
    statusStyle(scored.status),
    LOG_STYLE.muted,
    LOG_STYLE.muted,
    LOG_STYLE.muted,
  );

  return scored;
}

// ─── GET historical transactions from MongoDB ─────────────────────────────────

async function fetchFromDb(pageSize = INITIAL_FETCH) {
  const res = await fetch(`${API_BASE}/transactions?page=1&page_size=${pageSize}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return (data.transactions || []).map(normalizeTransaction);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransactions() {
  const [transactions,    setTransactions]    = useState([]);
  const [lastUpdated,     setLastUpdated]     = useState(() => new Date().toISOString());
  const [isRefreshing,    setIsRefreshing]    = useState(false);
  const [newCount,        setNewCount]        = useState(0);
  const [activityLog,     setActivityLog]     = useState([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [apiConnected,    setApiConnected]    = useState(null); // null = unknown

  const newCountTimer = useRef(null);
  const knownIds      = useRef(new Set());

  // ── Merge helper — prevents duplicate transaction_ids ──────────────────────
  const mergeIn = useCallback((incoming) => {
    const fresh = incoming.filter(t => !knownIds.current.has(String(t.transaction_id)));
    if (fresh.length === 0) return;
    fresh.forEach(t => knownIds.current.add(String(t.transaction_id)));
    setTransactions(prev =>
      [...fresh, ...prev].sort(
        (a, b) => new Date(b.timestamp || b.received_at) - new Date(a.timestamp || a.received_at)
      )
    );
  }, []);

  // ── Initial load from MongoDB ──────────────────────────────────────────────
  useEffect(() => {
    console.log('%c[FraudShield] 🔄 Initial load from MongoDB…', LOG_STYLE.sync);
    fetchFromDb(INITIAL_FETCH)
      .then(docs => {
        mergeIn(docs);
        setApiConnected(true);
        console.log(`%c[FraudShield] ✓ Loaded ${docs.length} historical transactions from MongoDB`, LOG_STYLE.ok);
      })
      .catch(err => {
        setApiConnected(false);
        console.warn('%c[FraudShield] ✗ Could not reach API on initial load:', LOG_STYLE.error, err.message);
        console.warn('%c[FraudShield]   Make sure FastAPI is running → uvicorn app.main:app --reload', LOG_STYLE.muted);
      });
  }, [mergeIn]);

  // ── Periodic DB sync (every 30 s) ─────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('%c[FraudShield] 🔄 Periodic sync from MongoDB…', LOG_STYLE.sync);
      fetchFromDb(INITIAL_FETCH)
        .then(docs => {
          mergeIn(docs);
          setApiConnected(true);
          console.log(`%c[FraudShield] ✓ Sync complete — ${docs.length} records in DB`, LOG_STYLE.ok);
        })
        .catch(err => {
          setApiConnected(false);
          console.warn('%c[FraudShield] ✗ DB sync failed:', LOG_STYLE.error, err.message);
        });
    }, SYNC_MS);
    return () => clearInterval(timer);
  }, [mergeIn]);

  // ── Inject new transactions (every 6 s → 10/min) ─────────────────────────
  const injectBatch = useCallback(async () => {
    const batchSize = 1;
    const rawBatch  = Array.from({ length: batchSize }, () => generateRawTransaction(0));
    const raw0      = rawBatch[0];

    console.groupCollapsed(
      `%c[FraudShield] ⚡ Submitting TXN  |  MYR ${raw0.amount.toFixed(2)}  |  ${raw0.channel}  |  ${raw0.merchant_country}`,
      LOG_STYLE.header,
    );
    console.log('%cPayload →', LOG_STYLE.muted, raw0);

    setProcessingCount(batchSize);

    const results = await Promise.allSettled(rawBatch.map(postTransaction));

    setProcessingCount(0);

    const succeeded = [];
    const logs      = [];

    results.forEach((result, i) => {
      const raw = rawBatch[i];
      const ts  = new Date().toISOString();

      if (result.status === 'fulfilled') {
        const scored = result.value;
        succeeded.push(scored);
        logs.push({
          id:               `LOG-${Date.now()}-${i}`,
          timestamp:        ts,
          transaction_id:   String(scored.transaction_id),
          amount:           scored.amount,
          status:           scored.status,
          fraud_probability: scored.fraud_probability,
          source:           scored.fraud_model_source || 'api',
          latency_ms:       0,
          error:            null,
        });
        setApiConnected(true);
      } else {
        // API unavailable — apply fallback scores locally
        const fallback = applyFallbackScores(raw);
        succeeded.push(fallback);
        logs.push({
          id:               `LOG-${Date.now()}-${i}`,
          timestamp:        ts,
          transaction_id:   String(raw.transaction_id),
          amount:           raw.amount,
          status:           fallback.status,
          fraud_probability: fallback.fraud_probability,
          source:           'offline',
          latency_ms:       0,
          error:            result.reason?.message || 'API unavailable',
        });
        setApiConnected(false);
        console.warn(
          `%c[FraudShield] ✗ API offline — local estimate only (no model scoring)  error: ${result.reason?.message}`,
          LOG_STYLE.error,
        );
      }
    });

    console.groupEnd();

    mergeIn(succeeded);
    setActivityLog(prev => [...logs, ...prev].slice(0, 100));
    setLastUpdated(new Date().toISOString());
    setNewCount(batchSize);

    if (newCountTimer.current) clearTimeout(newCountTimer.current);
    newCountTimer.current = setTimeout(() => setNewCount(0), 4000);
  }, [mergeIn]);

  useEffect(() => {
    const timer = setInterval(injectBatch, INJECT_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(newCountTimer.current);
    };
  }, [injectBatch]);

  // ── Manual refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    setIsRefreshing(true);
    injectBatch().finally(() => setIsRefreshing(false));
  }, [injectBatch]);

  // ── Update a transaction status in local state after PATCH ─────────────────
  const updateLocalStatus = useCallback((transaction_id, newStatus) => {
    const STATUS_TO_RISK = { BLOCKED: 'HIGH', FLAGGED: 'MEDIUM', APPROVED: 'LOW' };
    setTransactions(prev => prev.map(t =>
      String(t.transaction_id) === String(transaction_id)
        ? { ...t, status: newStatus, risk_level: STATUS_TO_RISK[newStatus] || t.risk_level }
        : t
    ));
  }, []);

  return {
    transactions,
    lastUpdated,
    isRefreshing,
    newCount,
    refresh,
    activityLog,
    processingCount,
    apiConnected,
    updateLocalStatus,
  };
}
