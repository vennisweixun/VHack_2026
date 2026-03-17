import { useState, useCallback } from 'react';

const STORAGE_KEY = 'fraudshield_api_config';

const DEFAULT_CONFIG = {
  fraud: {
    enabled: false,
    url: '',
    apiKey: '',
    method: 'POST',
    responseField: 'fraud_probability',
    timeout: 5000,
    status: 'unconfigured', // 'unconfigured' | 'connected' | 'error' | 'testing'
    lastChecked: null,
    lastError: null,
    latencyMs: null,
  },
  anomaly: {
    enabled: false,
    url: '',
    apiKey: '',
    method: 'POST',
    responseField: 'anomaly_score',
    timeout: 5000,
    status: 'unconfigured',
    lastChecked: null,
    lastError: null,
    latencyMs: null,
  },
  thresholds: {
    fraud: 0.65,
    anomaly: 0.60,
  },
};

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    // Deep merge with defaults to handle new fields added later
    return {
      fraud: { ...DEFAULT_CONFIG.fraud, ...parsed.fraud },
      anomaly: { ...DEFAULT_CONFIG.anomaly, ...parsed.anomaly },
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...parsed.thresholds },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveToStorage(config) {
  try {
    // Don't persist transient status fields
    const toSave = {
      fraud: { ...config.fraud, status: config.fraud.url ? config.fraud.status : 'unconfigured', lastChecked: config.fraud.lastChecked, latencyMs: config.fraud.latencyMs },
      anomaly: { ...config.anomaly, status: config.anomaly.url ? config.anomaly.status : 'unconfigured', lastChecked: config.anomaly.lastChecked, latencyMs: config.anomaly.latencyMs },
      thresholds: config.thresholds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore storage errors
  }
}

export function useApiConfig() {
  const [config, setConfig] = useState(loadFromStorage);

  const updateConfig = useCallback((updates) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateModelConfig = useCallback((model, fields) => {
    setConfig(prev => {
      const next = {
        ...prev,
        [model]: { ...prev[model], ...fields },
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateThresholds = useCallback((fields) => {
    setConfig(prev => {
      const next = { ...prev, thresholds: { ...prev.thresholds, ...fields } };
      saveToStorage(next);
      return next;
    });
  }, []);

  /**
   * Test connection to a model endpoint with a sample payload
   */
  const testConnection = useCallback(async (model) => {
    const cfg = config[model];
    if (!cfg.url) return;

    updateModelConfig(model, { status: 'testing', lastError: null });

    const samplePayload = {
      transaction_id: 'TXN-TEST-0001',
      amount: 250.00,
      currency: 'USD',
      merchant_country: 'United States',
      merchant_country_code: 'US',
      mcc_code: '5411',
      mcc_label: 'Grocery Stores',
      channel: 'online',
      customer_id: 'CUST-TEST-001',
      timestamp: new Date().toISOString(),
    };

    const start = Date.now();
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), cfg.timeout);

      const res = await fetch(cfg.url, {
        method: cfg.method,
        headers,
        body: JSON.stringify(samplePayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const score = data[cfg.responseField];

      if (score === undefined || score === null) {
        throw new Error(`Response missing field "${cfg.responseField}". Got: ${JSON.stringify(data)}`);
      }
      if (typeof score !== 'number' || score < 0 || score > 1) {
        throw new Error(`"${cfg.responseField}" must be a number between 0 and 1. Got: ${score}`);
      }

      updateModelConfig(model, {
        status: 'connected',
        lastChecked: new Date().toISOString(),
        latencyMs,
        lastError: null,
      });
      return { success: true, score, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err.name === 'AbortError'
        ? `Request timed out after ${cfg.timeout}ms`
        : err.message;

      updateModelConfig(model, {
        status: 'error',
        lastChecked: new Date().toISOString(),
        latencyMs,
        lastError: message,
      });
      return { success: false, error: message, latencyMs };
    }
  }, [config, updateModelConfig]);

  /**
   * Call a model API with a real transaction. Returns the score or null on failure.
   */
  const callModel = useCallback(async (model, transaction) => {
    const cfg = config[model];
    if (!cfg.enabled || !cfg.url) return null;

    const payload = {
      transaction_id: transaction.transaction_id,
      amount: transaction.amount,
      currency: transaction.currency,
      merchant_country: transaction.merchant_country,
      merchant_country_code: transaction.merchant_country_code,
      mcc_code: transaction.mcc_code,
      mcc_label: transaction.mcc_label,
      channel: transaction.channel,
      customer_id: transaction.customer_id,
      bank_id: transaction.bank_id,
      device_id: transaction.device_id,
      ip_address: transaction.ip_address,
      timestamp: transaction.timestamp,
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), cfg.timeout);

      const res = await fetch(cfg.url, {
        method: cfg.method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;

      const data = await res.json();
      const score = data[cfg.responseField];
      if (typeof score === 'number' && score >= 0 && score <= 1) {
        return score;
      }
      return null;
    } catch {
      return null;
    }
  }, [config]);

  return { config, updateModelConfig, updateThresholds, testConnection, callModel };
}
