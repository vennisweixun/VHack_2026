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
const INJECT_MS     = 8000;   // new transaction every 8 s
const SYNC_MS       = 30000;  // sync from DB every 30 s
const INITIAL_FETCH = 100;    // how many historical records to load on mount

// ─── POST a single transaction to the API ────────────────────────────────────

async function postTransaction(raw) {
  const res = await fetch(`${API_BASE}/transactions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(raw),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }

  const data = await res.json();
  return normalizeTransaction(data);
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
    fetchFromDb(INITIAL_FETCH)
      .then(docs => {
        mergeIn(docs);
        setApiConnected(true);
      })
      .catch(() => setApiConnected(false));
  }, [mergeIn]);

  // ── Periodic DB sync (every 30 s) ─────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      fetchFromDb(INITIAL_FETCH)
        .then(docs => { mergeIn(docs); setApiConnected(true); })
        .catch(() => setApiConnected(false));
    }, SYNC_MS);
    return () => clearInterval(timer);
  }, [mergeIn]);

  // ── Inject new transactions (every 8 s) ───────────────────────────────────
  const injectBatch = useCallback(async () => {
    const batchSize = Math.floor(Math.random() * 3) + 1;
    const rawBatch  = Array.from({ length: batchSize }, () => generateRawTransaction(0));

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
          source:           'fallback',
          latency_ms:       0,
          error:            result.reason?.message || 'API unavailable',
        });
        setApiConnected(false);
      }
    });

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

  return {
    transactions,
    lastUpdated,
    isRefreshing,
    newCount,
    refresh,
    activityLog,
    processingCount,
    apiConnected,
  };
}
