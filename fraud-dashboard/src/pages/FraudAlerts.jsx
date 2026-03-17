import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert, Search, ChevronLeft, ChevronRight, X,
  CheckCircle, Ban, RefreshCw, AlertTriangle, Clock, TrendingUp,
} from 'lucide-react';
import Header from '../components/Header';
import RiskBadge from '../components/RiskBadge';
import { normalizeTransaction } from '../data/dummyData';

const API_BASE   = 'http://localhost:8000/api/v1';
const PAGE_SIZE  = 20;
const POLL_MS    = 20000; // re-fetch from MongoDB every 20 s

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchAlerts(status, pageSize = 200) {
  const res = await fetch(`${API_BASE}/transactions?status=${status}&page_size=${pageSize}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return (data.transactions || []).map(normalizeTransaction);
}

async function patchStatus(transaction_id, newStatus) {
  const res = await fetch(`${API_BASE}/transactions/${transaction_id}/status`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status: newStatus }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = {
    FLAGGED:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', color: '#fbbf24', label: 'Flagged' },
    BLOCKED:  { bg: 'rgba(225,29,72,0.12)',  border: 'rgba(225,29,72,0.25)',  color: '#fb7185', label: 'Blocked' },
    APPROVED: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', color: '#34d399', label: 'Approved' },
  }[status] || { bg: 'var(--bg-elevated)', border: 'var(--border-default)', color: 'var(--text-muted)', label: status };

  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {cfg.label}
    </span>
  );
}

function ActionPanel({ txn, onApprove, onBlock, onClose, loading }) {
  return (
    <tr>
      <td colSpan={10} style={{ padding: 0 }}>
        <div style={{
          background: 'rgba(245,158,11,0.05)',
          borderLeft: '3px solid #f59e0b',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '18px 24px',
          display: 'flex',
          gap: 32,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}>
          {/* Transaction details */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Review Required — Flagged Transaction
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px 24px' }}>
              {[
                ['Transaction ID', txn.transaction_id],
                ['Amount',         `MYR ${txn.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                ['Merchant',       txn.merchant_name || '—'],
                ['Country',        txn.merchant_country || '—'],
                ['Channel',        txn.channel || '—'],
                ['Card Brand',     txn.card_brand?.toUpperCase() || '—'],
                ['Fraud Prob',     `${((txn.fraud_probability || 0) * 100).toFixed(1)}%`],
                ['Timestamp',      txn.timestamp ? new Date(txn.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, fontFamily: label === 'Transaction ID' ? 'JetBrains Mono, monospace' : 'inherit' }}>{val}</div>
                </div>
              ))}
            </div>
            {txn.flags?.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {txn.flags.map(f => (
                  <span key={f} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171',
                  }}>
                    ⚠ {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'center', minWidth: 180 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Take Action</div>
            <button
              onClick={() => onApprove(txn.transaction_id)}
              disabled={loading}
              style={{
                padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'var(--bg-elevated)' : 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.35)',
                color: loading ? 'var(--text-muted)' : '#34d399',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; }}
            >
              <CheckCircle size={15} /> Mark as Approved
            </button>
            <button
              onClick={() => onBlock(txn.transaction_id)}
              disabled={loading}
              style={{
                padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'var(--bg-elevated)' : 'rgba(225,29,72,0.15)',
                border: '1px solid rgba(225,29,72,0.35)',
                color: loading ? 'var(--text-muted)' : '#fb7185',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(225,29,72,0.25)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'rgba(225,29,72,0.15)'; }}
            >
              <Ban size={15} /> Mark as Blocked
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border-default)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FraudAlerts({ lastUpdated, isRefreshing, newCount, onRefresh, onStatusUpdate }) {
  const [statusFilter, setStatusFilter] = useState('FLAGGED');
  const [alerts,       setAlerts]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState(null);
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [sort,         setSort]         = useState({ key: 'fraud_probability', dir: 'desc' });
  const [expandedId,   setExpandedId]   = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast,        setToast]        = useState(null); // { msg, type }
  const pollRef = useRef(null);

  // ── Fetch from MongoDB ──────────────────────────────────────────────────────
  const loadAlerts = useCallback(async (status) => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchAlerts(status);
      setAlerts(data);
    } catch (e) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts(statusFilter);
    setPage(1);
    setExpandedId(null);
  }, [statusFilter, loadAlerts]);

  // Auto-poll every 20 s
  useEffect(() => {
    pollRef.current = setInterval(() => loadAlerts(statusFilter), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [statusFilter, loadAlerts]);

  // Re-fetch when parent triggers refresh
  useEffect(() => {
    if (isRefreshing) loadAlerts(statusFilter);
  }, [isRefreshing, statusFilter, loadAlerts]);

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAction = async (transaction_id, newStatus) => {
    setActionLoading(true);
    try {
      await patchStatus(transaction_id, newStatus);
      // Remove from local list (status changed, no longer in this filter)
      setAlerts(prev => prev.filter(t => String(t.transaction_id) !== String(transaction_id)));
      setExpandedId(null);
      if (onStatusUpdate) onStatusUpdate(transaction_id, newStatus);
      showToast(
        newStatus === 'APPROVED'
          ? `Transaction ${transaction_id} approved.`
          : `Transaction ${transaction_id} blocked.`,
        newStatus === 'APPROVED' ? 'success' : 'danger'
      );
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtering & sorting ────────────────────────────────────────────────────
  const filtered = alerts.filter(t => {
    if (!search.trim()) return true;
    return t.transaction_id.toLowerCase().includes(search.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === 'number') return sort.dir === 'desc' ? bv - av : av - bv;
    return sort.dir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortBy = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const SortIcon = ({ col }) => sort.key === col
    ? <span style={{ color: '#fbbf24', marginLeft: 4 }}>{sort.dir === 'desc' ? '↓' : '↑'}</span>
    : <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>↕</span>;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const colH = {
    padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    borderBottom: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  };
  const colC = {
    padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
  };

  const filterTab = (active, color) => ({
    padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: active ? `1px solid ${color}40` : '1px solid var(--border-default)',
    background: active ? `${color}18` : 'var(--bg-elevated)',
    color: active ? color : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  const flaggedCount  = statusFilter === 'FLAGGED' ? alerts.length : null;
  const blockedCount  = statusFilter === 'BLOCKED'  ? alerts.length : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Fraud Alerts"
        subtitle={`${filtered.length} ${statusFilter.toLowerCase()} transaction${filtered.length !== 1 ? 's' : ''} — fetched from MongoDB`}
        lastUpdated={lastUpdated}
        onRefresh={() => loadAlerts(statusFilter)}
        isRefreshing={loading}
        newCount={newCount}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : toast.type === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.15)',
          border: toast.type === 'success' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)',
          color: toast.type === 'success' ? '#34d399' : '#f87171',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'fade-in 0.2s ease',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Shown',      value: filtered.length,                                                                             color: '#e11d48' },
            { label: 'Avg Fraud Prob',   value: filtered.length > 0 ? `${(filtered.reduce((s, t) => s + (t.fraud_probability || 0), 0) / filtered.length * 100).toFixed(1)}%` : '—', color: '#fb7185' },
            { label: 'Critical (>90%)',  value: filtered.filter(t => (t.fraud_probability || 0) > 0.9).length,                              color: '#f87171' },
            { label: 'Total Value',      value: `$${filtered.reduce((s, t) => s + (t.amount || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: '#fda4af' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Filters bar */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12,
          padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by Transaction ID..."
              style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            {search && <X size={13} onClick={() => { setSearch(''); setPage(1); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} />}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'var(--border-default)', flexShrink: 0 }} />

          {/* Status filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 2 }}>View Status</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={filterTab(statusFilter === 'FLAGGED', '#fbbf24')} onClick={() => setStatusFilter('FLAGGED')}>
                ⚠ Flagged {flaggedCount !== null ? `(${flaggedCount})` : ''}
              </button>
              <button style={filterTab(statusFilter === 'BLOCKED', '#fb7185')} onClick={() => setStatusFilter('BLOCKED')}>
                🚫 Blocked {blockedCount !== null ? `(${blockedCount})` : ''}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'var(--border-default)', flexShrink: 0 }} />

          {/* Refresh */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 2 }}>Sync</span>
            <button
              onClick={() => loadAlerts(statusFilter)}
              style={{
                padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {statusFilter === 'FLAGGED' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={12} /> Click a row to Approve or Block
              </span>
            </div>
          )}
        </div>

        {/* Error state */}
        {fetchError && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, padding: '14px 18px', color: '#f87171', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertTriangle size={15} />
            <span>Could not reach API: <strong>{fetchError}</strong> — showing last known data.</span>
          </div>
        )}

        {/* Table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', flex: 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={colH} onClick={() => sortBy('transaction_id')}>Transaction ID <SortIcon col="transaction_id" /></th>
                  <th style={colH} onClick={() => sortBy('amount')}>Amount <SortIcon col="amount" /></th>
                  <th style={colH}>Currency</th>
                  <th style={colH} onClick={() => sortBy('fraud_probability')}>Fraud Prob <SortIcon col="fraud_probability" /></th>
                  <th style={colH} onClick={() => sortBy('risk_level')}>Risk <SortIcon col="risk_level" /></th>
                  <th style={colH}>Country</th>
                  <th style={colH}>Merchant</th>
                  <th style={colH}>Channel</th>
                  <th style={colH} onClick={() => sortBy('timestamp')}>Timestamp <SortIcon col="timestamp" /></th>
                  <th style={colH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && alerts.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <RefreshCw size={16} className="spin" /> Loading from MongoDB…
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      No {statusFilter.toLowerCase()} transactions found
                    </td>
                  </tr>
                ) : paginated.map((t, i) => {
                  const isExpanded   = String(expandedId) === String(t.transaction_id);
                  const isFlagged    = t.status === 'FLAGGED';
                  const criticalFlag = (t.fraud_probability || 0) > 0.9;

                  return (
                    <React.Fragment key={t.transaction_id}>
                      <tr
                        onClick={() => {
                          if (!isFlagged) return;
                          setExpandedId(isExpanded ? null : t.transaction_id);
                        }}
                        style={{
                          cursor: isFlagged ? 'pointer' : 'default',
                          background: isExpanded
                            ? 'rgba(245,158,11,0.08)'
                            : criticalFlag ? 'rgba(225,29,72,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                          transition: 'background 0.1s',
                          borderLeft: isExpanded ? '3px solid #f59e0b' : criticalFlag ? '3px solid rgba(225,29,72,0.5)' : '3px solid transparent',
                        }}
                        onMouseEnter={e => { if (isFlagged) e.currentTarget.style.background = 'rgba(245,158,11,0.06)'; }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = isExpanded
                            ? 'rgba(245,158,11,0.08)'
                            : criticalFlag ? 'rgba(225,29,72,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)';
                        }}
                      >
                        <td style={colC}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ShieldAlert size={12} color={isFlagged ? '#f59e0b' : '#e11d48'} />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: isFlagged ? '#fbbf24' : '#fb7185' }}>
                              {t.transaction_id}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...colC, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {(t.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={colC}>
                          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>MYR</span>
                        </td>
                        <td style={colC}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden', minWidth: 70 }}>
                              <div style={{
                                width: `${(t.fraud_probability || 0) * 100}%`, height: '100%', borderRadius: 3,
                                background: (t.fraud_probability || 0) > 0.9 ? '#e11d48' : (t.fraud_probability || 0) > 0.75 ? '#f43f5e' : '#fb7185',
                              }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#fb7185', minWidth: 40, fontFamily: 'JetBrains Mono, monospace' }}>
                              {((t.fraud_probability || 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={colC}><RiskBadge level={t.risk_level} /></td>
                        <td style={colC}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>
                              {t.merchant_country_code ? String.fromCodePoint(...[...t.merchant_country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌍'}
                            </span>
                            <span style={{ fontSize: 12 }}>{t.merchant_country}</span>
                          </div>
                        </td>
                        <td style={{ ...colC, maxWidth: 140 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{t.merchant_name || '—'}</span>
                        </td>
                        <td style={colC}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                            {t.channel}
                          </span>
                        </td>
                        <td style={colC}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={10} color="var(--text-muted)" />
                            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                              {t.timestamp ? new Date(t.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                          </div>
                        </td>
                        <td style={colC}><StatusBadge status={t.status} /></td>
                      </tr>

                      {/* Expanded action panel — only for FLAGGED */}
                      {isExpanded && isFlagged && (
                        <ActionPanel
                          txn={t}
                          loading={actionLoading}
                          onApprove={(id) => handleAction(id, 'APPROVED')}
                          onBlock={(id)   => handleAction(id, 'BLOCKED')}
                          onClose={() => setExpandedId(null)}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {sorted.length === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages || p < 1) return null;
                const active = page === p;
                return (
                  <button key={p} onClick={() => setPage(p)} style={{
                    padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: active ? '1px solid rgba(225,29,72,0.4)' : '1px solid var(--border-default)',
                    background: active ? 'rgba(225,29,72,0.12)' : 'var(--bg-elevated)',
                    color: active ? '#fb7185' : 'var(--text-secondary)',
                  }}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: (page === totalPages || totalPages === 0) ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
