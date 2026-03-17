import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, CheckCircle, XCircle, Loader, Wifi, WifiOff,
  Activity, Database, Cpu, ArrowRight, Info, RefreshCw,
  TrendingUp, Clock, AlertTriangle, Ban, BarChart2,
} from 'lucide-react';
import Header from '../components/Header';
import RiskBadge from '../components/RiskBadge';

const API_BASE = 'http://localhost:8000';

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, accent = '#e11d48', children }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, overflow: 'hidden', marginBottom: 20,
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-elevated)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${accent}18`, border: `1px solid ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={accent} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  );
}

function StatusChip({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(225,29,72,0.12)',
      color: ok ? '#10b981' : '#e11d48',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(225,29,72,0.25)'}`,
    }}>
      {ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  );
}

function KV({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function ThresholdBar({ approved = 0.40, blocked = 0.75 }) {
  const zones = [
    { label: 'APPROVED', from: 0,        to: approved, color: '#10b981', textColor: '#10b981' },
    { label: 'FLAGGED',  from: approved, to: blocked,  color: '#f59e0b', textColor: '#f59e0b' },
    { label: 'BLOCKED',  from: blocked,  to: 1,        color: '#e11d48', textColor: '#e11d48' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
        {zones.map(z => (
          <div key={z.label} style={{
            flex: (z.to - z.from),
            background: `${z.color}22`,
            border: `1px solid ${z.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: z.color,
          }}>
            {z.label}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>0.0</span>
        <span style={{ color: '#f59e0b' }}>▲ {approved} (FLAG)</span>
        <span style={{ color: '#e11d48' }}>▲ {blocked} (BLOCK)</span>
        <span>1.0</span>
      </div>
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {zones.map(z => (
          <div key={z.label} style={{
            padding: '10px 14px', borderRadius: 10,
            background: `${z.color}10`, border: `1px solid ${z.color}25`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: z.color, marginBottom: 3 }}>{z.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {z.label === 'APPROVED'
                ? `fraud_prob < ${z.to}`
                : z.label === 'FLAGGED'
                  ? `${z.from} ≤ prob < ${z.to}`
                  : `prob ≥ ${z.from}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineFlow() {
  const steps = [
    { icon: Database,    label: 'Bank Transaction',   sub: 'Dashboard generates dataset-format transaction',          color: '#6366f1' },
    { icon: ArrowRight,  label: '',                    sub: '',                                                        color: 'transparent' },
    { icon: Wifi,        label: 'FastAPI',             sub: 'POST /api/v1/transactions · localhost:8000',             color: '#0ea5e9' },
    { icon: ArrowRight,  label: '',                    sub: '',                                                        color: 'transparent' },
    { icon: Cpu,         label: 'XGBoost Model',       sub: 'fraud_model.pkl · 35 features · predict_proba()',       color: '#e11d48' },
    { icon: ArrowRight,  label: '',                    sub: '',                                                        color: 'transparent' },
    { icon: Database,    label: 'MongoDB',             sub: 'fraudshield.transactions · stored with full metadata',   color: '#10b981' },
    { icon: ArrowRight,  label: '',                    sub: '',                                                        color: 'transparent' },
    { icon: BarChart2,   label: 'Dashboard',           sub: 'Real-time display · APPROVED / FLAGGED / BLOCKED',      color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', gap: 4 }}>
      {steps.map((s, i) => {
        if (s.label === '') return (
          <ArrowRight key={i} size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        );
        return (
          <div key={i} style={{
            flex: 1, minWidth: 100,
            padding: '12px 10px', borderRadius: 10,
            background: `${s.color}12`, border: `1px solid ${s.color}30`,
            textAlign: 'center',
          }}>
            <s.icon size={18} color={s.color} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function LogRow({ entry }) {
  const statusColor = entry.status === 'BLOCKED' ? '#e11d48' : entry.status === 'FLAGGED' ? '#f59e0b' : '#10b981';
  const isError     = !!entry.error;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8, marginBottom: 4,
      background: isError ? 'rgba(225,29,72,0.05)' : 'var(--bg-elevated)',
      border: `1px solid ${isError ? 'rgba(225,29,72,0.2)' : 'var(--border-subtle)'}`,
    }}>
      <span style={{
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color: 'var(--text-muted)', minWidth: 55,
      }}>
        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
      </span>
      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', flex: 1 }}>
        {String(entry.transaction_id).slice(-10)}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 70, textAlign: 'right' }}>
        MYR {Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span style={{
        fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
        color: statusColor, minWidth: 44, fontWeight: 700,
      }}>
        {(entry.fraud_probability * 100).toFixed(1)}%
      </span>
      <span style={{
        fontSize: 10, padding: '2px 7px', borderRadius: 12, fontWeight: 700,
        background: `${statusColor}18`, color: statusColor,
        border: `1px solid ${statusColor}30`, minWidth: 64, textAlign: 'center',
      }}>
        {entry.status || '—'}
      </span>
      <span style={{
        fontSize: 10, padding: '2px 7px', borderRadius: 12,
        background: entry.source === 'api' ? 'rgba(6,182,212,0.12)' : 'rgba(100,116,139,0.12)',
        color: entry.source === 'api' ? '#06b6d4' : 'var(--text-muted)',
        border: `1px solid ${entry.source === 'api' ? 'rgba(6,182,212,0.25)' : 'transparent'}`,
      }}>
        {entry.source === 'api' ? 'XGBoost' : entry.source === 'fallback' ? 'fallback' : entry.source}
      </span>
      {isError && (
        <span style={{ fontSize: 10, color: '#e11d48', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.error}
        </span>
      )}
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────

export default function Settings({
  activityLog = [],
  processingCount = 0,
  apiConnected = null,
  transactions = [],
  lastUpdated,
  isRefreshing,
  newCount,
  onRefresh,
}) {
  const [health, setHealth]     = useState(null);
  const [testing, setTesting]   = useState(false);
  const [testError, setTestError] = useState(null);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setTestError(err.message);
      setHealth(null);
    } finally {
      setTesting(false);
    }
  }, []);

  // Auto-ping on mount
  useEffect(() => { testConnection(); }, [testConnection]);

  const modelLoaded    = health?.model?.loaded ?? false;
  const hasEncoders    = health?.model?.has_encoders ?? false;
  const apiOk          = !!health && !testError;

  // Stats from activity log
  const apiCalls    = activityLog.filter(l => l.source === 'api').length;
  const fallbacks   = activityLog.filter(l => l.source === 'fallback').length;
  const blocked     = activityLog.filter(l => l.status === 'BLOCKED').length;
  const flagged     = activityLog.filter(l => l.status === 'FLAGGED').length;

  return (
    <div style={{ padding: '0 0 40px' }}>
      <Header
        title="API & Model Settings"
        subtitle="FraudShield backend status, XGBoost model info, and scoring configuration"
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        newCount={newCount}
        onRefresh={onRefresh}
      />

      {/* ── Status summary bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24,
      }}>
        {[
          {
            label: 'FastAPI Backend',
            value: apiOk ? 'Connected' : testError ? 'Offline' : 'Unknown',
            icon: apiOk ? Wifi : WifiOff,
            color: apiOk ? '#10b981' : '#e11d48',
            sub: apiOk ? `${API_BASE}` : testError || 'Checking…',
          },
          {
            label: 'XGBoost Model',
            value: modelLoaded ? (hasEncoders ? 'Loaded + Encoders' : 'Loaded (no encoders)') : 'Not Loaded',
            icon: Cpu,
            color: modelLoaded ? (hasEncoders ? '#10b981' : '#f59e0b') : '#e11d48',
            sub: modelLoaded
              ? `${health?.model?.features} features · ${health?.model?.type}`
              : 'Run patch_pkl.py and restart API',
          },
          {
            label: 'API Calls (session)',
            value: apiCalls,
            icon: Activity,
            color: '#6366f1',
            sub: fallbacks > 0 ? `${fallbacks} fallback(s)` : 'All real predictions',
          },
          {
            label: 'Processing Now',
            value: processingCount > 0 ? `${processingCount} txn…` : 'Idle',
            icon: processingCount > 0 ? Loader : CheckCircle,
            color: processingCount > 0 ? '#f59e0b' : '#10b981',
            sub: `${transactions.length} total transactions`,
          },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--bg-card)', border: `1px solid ${card.color}22`,
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{card.label}</span>
              <card.icon size={14} color={card.color} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: card.color, marginBottom: 3 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Backend health ─────────────────────────────────────────────────── */}
      <Section title="Backend API Status" icon={Wifi} accent="#0ea5e9">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <code style={{
            flex: 1, padding: '9px 14px', borderRadius: 8,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)',
          }}>{API_BASE}/health</code>
          <button
            onClick={testConnection}
            disabled={testing}
            style={{
              padding: '9px 18px', borderRadius: 8, cursor: testing ? 'default' : 'pointer',
              background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)',
              color: '#0ea5e9', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {testing ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
            {testing ? 'Checking…' : 'Test Connection'}
          </button>
          <StatusChip ok={apiOk} label={apiOk ? 'Online' : 'Offline'} />
        </div>

        {testError && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 12,
            background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)',
            fontSize: 12, color: '#e11d48',
          }}>
            <strong>Connection failed:</strong> {testError}
            <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
              Make sure the FastAPI server is running: <code>uvicorn app.main:app --reload</code>
            </div>
          </div>
        )}

        {health && (
          <div>
            <KV label="Status"      value={health.status} />
            <KV label="MongoDB DB"  value={health.mongodb_db} mono />
            <KV label="Model Type"  value={health.model?.type}    />
            <KV label="Features"    value={health.model?.features} />
            <KV label="Has Encoders" value={health.model?.has_encoders ? 'Yes' : 'No — run patch_pkl.py'} />
            <KV label="Model Path"  value={health.model?.path} mono />
          </div>
        )}

        {!modelLoaded && !testing && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 8,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
            fontSize: 12, color: '#f59e0b',
          }}>
            <strong>XGBoost model not loaded.</strong> Steps to fix:
            <ol style={{ margin: '6px 0 0 16px', lineHeight: 1.8 }}>
              <li>Run <code>python patch_pkl.py</code> in the VhACK folder</li>
              <li>Restart the FastAPI server: <code>uvicorn app.main:app --reload</code> (inside fraud-api/)</li>
              <li>Click "Test Connection" above to verify</li>
            </ol>
          </div>
        )}
      </Section>

      {/* ── Scoring thresholds ─────────────────────────────────────────────── */}
      <Section title="Fraud Scoring Thresholds" icon={ShieldAlert} accent="#e11d48">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          The XGBoost model outputs a <strong>fraud_probability</strong> between 0.0 and 1.0.
          This score is mapped to a transaction status using the thresholds below.
          Thresholds are set in <code style={{ fontSize: 12 }}>fraud-api/.env</code>.
        </p>
        <ThresholdBar
          approved={health?.thresholds?.approved_below ?? 0.003}
          blocked={health?.thresholds?.blocked_above ?? 0.012}
        />
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>SCORE INTERPRETATION</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            The XGBoost model was trained on <strong>3.4M Malaysian bank transactions</strong> with
            {' '}<strong>scale_pos_weight ≈ 668</strong> (fraud rate ≈ 0.15%). Due to this class-imbalance
            weighting, the model outputs <strong>compressed probabilities</strong> — most scores fall
            in the <code>0.0001–0.05</code> range rather than the full 0–1 range.
            Thresholds are calibrated to this distribution.
            As cards accumulate transaction history in MongoDB, <strong>behavioural features</strong>
            (amount z-score, velocity, device patterns) become active and scores become more varied.
          </div>
        </div>
      </Section>

      {/* ── Transaction pipeline ───────────────────────────────────────────── */}
      <Section title="Transaction Processing Pipeline" icon={Activity} accent="#6366f1">
        <PipelineFlow />
        <div style={{
          marginTop: 16, padding: '12px 14px', borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8,
        }}>
          <strong>35 model features:</strong>{' '}
          amount, card_present_flag, network_token_used_flag, year, month, day, hour, minute,
          day_of_week, is_weekend, merchant_country, channel, entry_mode, issuer_country,
          home_country, card_brand, avs_result, cvc_result, three_ds_result, ip_country,
          time_since_last_txn_sec, card_avg_amount, card_std_amount, card_unique_mcc_countries,
          card_channel_diversity, card_txn_per_day, merchant_txn_per_day, device_txn_count,
          device_unique_cards, amount_zscore, card_id_freq, customer_id_freq, merchant_id_freq,
          mcc_freq, device_id_hash_freq.
        </div>
      </Section>

      {/* ── Session stats ──────────────────────────────────────────────────── */}
      <Section title="Session Statistics" icon={BarChart2} accent="#10b981">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Total Injected', value: activityLog.length, color: 'var(--text-primary)' },
            { label: 'Via XGBoost API', value: apiCalls, color: '#0ea5e9' },
            { label: 'Fallback Scored', value: fallbacks, color: '#6b7280' },
            { label: 'Blocked', value: blocked, color: '#e11d48' },
            { label: 'Flagged', value: flagged, color: '#f59e0b' },
            { label: 'Approved', value: activityLog.length - blocked - fallbacks, color: '#10b981' },
            { label: 'Total in DB', value: transactions.length, color: '#6366f1' },
            { label: 'API Status', value: apiConnected === true ? 'Online' : apiConnected === false ? 'Offline' : 'Unknown', color: apiConnected ? '#10b981' : '#e11d48' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Activity log ───────────────────────────────────────────────────── */}
      <Section title={`Transaction Processing Log  (last ${activityLog.length})`} icon={Clock} accent="#6366f1">
        {processingCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, marginBottom: 10,
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            fontSize: 12, color: '#6366f1',
          }}>
            <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
            Scoring {processingCount} transaction{processingCount > 1 ? 's' : ''} with XGBoost…
          </div>
        )}

        {activityLog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No transactions processed yet — waiting for first injection…
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <div style={{
              display: 'flex', gap: 10, padding: '6px 12px', marginBottom: 4,
              fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>
              <span style={{ minWidth: 55 }}>Time</span>
              <span style={{ flex: 1 }}>TXN ID</span>
              <span style={{ minWidth: 70, textAlign: 'right' }}>Amount</span>
              <span style={{ minWidth: 44 }}>Score</span>
              <span style={{ minWidth: 64, textAlign: 'center' }}>Status</span>
              <span>Source</span>
            </div>
            {activityLog.map(entry => <LogRow key={entry.id} entry={entry} />)}
          </div>
        )}
      </Section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
