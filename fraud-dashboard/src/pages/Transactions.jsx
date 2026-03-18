import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import Header from '../components/Header';
import RiskBadge from '../components/RiskBadge';

const PAGE_SIZE = 20;

const COL_STYLE = {
  base: { padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' },
  header: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' },
};

function ScoreBar({ value, color }) {
  const bg = color === 'red' ? '#e11d48' : color === 'orange' ? '#f97316' : '#3b82f6';
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--bg-overlay)', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: bg, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', minWidth: 38, textAlign: 'right' }}>
        {value.toFixed(3)}
      </span>
    </div>
  );
}

export default function Transactions({ transactions, lastUpdated, isRefreshing, newCount, onRefresh }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [alertFilter, setAlertFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let data = [...transactions];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(t => t.transaction_id.toLowerCase().includes(q));
    }

    if (riskFilter !== 'ALL') data = data.filter(t => t.risk_level === riskFilter);

    if (alertFilter === 'FRAUD') data = data.filter(t => t.is_fraud_alert);
    else if (alertFilter === 'ANOMALY') data = data.filter(t => t.is_anomaly_alert);

    if (dateFilter !== 'ALL') {
      const now = new Date();
      const cutoff = new Date();
      if (dateFilter === 'TODAY') cutoff.setHours(0, 0, 0, 0);
      else if (dateFilter === '7D') cutoff.setDate(now.getDate() - 7);
      else if (dateFilter === '30D') cutoff.setDate(now.getDate() - 30);
      data = data.filter(t => new Date(t.timestamp) >= cutoff);
    }

    return data;
  }, [transactions, search, riskFilter, alertFilter, dateFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const riskBtnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '1px solid rgba(225,29,72,0.4)' : '1px solid var(--border-default)',
    background: active ? 'rgba(225,29,72,0.12)' : 'var(--bg-elevated)',
    color: active ? '#fb7185' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  const alertBtnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '1px solid rgba(234,179,8,0.4)' : '1px solid var(--border-default)',
    background: active ? 'rgba(234,179,8,0.12)' : 'var(--bg-elevated)',
    color: active ? '#fbbf24' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  const timeBtnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border-default)',
    background: active ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)',
    color: active ? '#60a5fa' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  const paginationBtnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '1px solid rgba(225,29,72,0.4)' : '1px solid var(--border-default)',
    background: active ? 'rgba(225,29,72,0.12)' : 'var(--bg-elevated)',
    color: active ? '#fb7185' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Transactions"
        subtitle={`${filtered.length.toLocaleString()} transactions found`}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        newCount={newCount}
      />

      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Filters */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}>
          {/* Search — Transaction ID only */}
          <div style={{ position: 'relative', flex: '1', minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
              placeholder="Search by Transaction ID..."
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <X size={13} onClick={() => { setSearch(''); resetPage(); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} />
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'var(--border-default)', flexShrink: 0 }} />

          {/* Risk Level Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 2 }}>Risk Level</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <Filter size={12} color="#fb7185" style={{ opacity: 0.7 }} />
              {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(r => (
                <button key={r} style={riskBtnStyle(riskFilter === r)}
                  onClick={() => { setRiskFilter(r); resetPage(); }}>
                  {r === 'ALL' ? 'All' : r}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'var(--border-default)', flexShrink: 0 }} />

          {/* Alert Type Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 2 }}>Alert Type</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[['ALL', 'All'], ['FRAUD', 'Fraud'], ['ANOMALY', 'Anomaly']].map(([v, l]) => (
                <button key={v} style={alertBtnStyle(alertFilter === v)}
                  onClick={() => { setAlertFilter(v); resetPage(); }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'var(--border-default)', flexShrink: 0 }} />

          {/* Time Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 2 }}>Time Range</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[['ALL', 'All Time'], ['TODAY', 'Today'], ['7D', '7 Days'], ['30D', '30 Days']].map(([v, l]) => (
                <button key={v} style={timeBtnStyle(dateFilter === v)}
                  onClick={() => { setDateFilter(v); resetPage(); }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          overflow: 'hidden',
          flex: 1,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Transaction ID', 'Amount', 'Currency', 'Country', 'Channel', 'Fraud Prob', 'Anomaly Score', 'Risk Score', 'Risk Level', 'Timestamp', ''].map(h => (
                    <th key={h} style={COL_STYLE.header}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      No transactions match your filters
                    </td>
                  </tr>
                ) : paginated.map((t, i) => (
                  <tr key={t.transaction_id}
                    onClick={() => navigate(`/transaction/${t.transaction_id}`)}
                    style={{
                      cursor: 'pointer',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      transition: 'background 0.1s',
                      animation: 'fade-in 0.2s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(225,29,72,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                  >
                    <td style={COL_STYLE.base}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#fb7185' }}>{t.transaction_id}</span>
                    </td>
                    <td style={{ ...COL_STYLE.base, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={COL_STYLE.base}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{t.currency}</span>
                    </td>
                    <td style={COL_STYLE.base}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>
                          {t.merchant_country_code ? String.fromCodePoint(...[...t.merchant_country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌍'}
                        </span>
                        <span style={{ fontSize: 12 }}>{t.merchant_country}</span>
                      </div>
                    </td>
                    <td style={COL_STYLE.base}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 5,
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                        textTransform: 'capitalize',
                      }}>
                        {t.channel}
                      </span>
                    </td>
                    <td style={{ ...COL_STYLE.base, minWidth: 130 }}>
                      <ScoreBar value={t.fraud_probability} color="red" />
                    </td>
                    <td style={{ ...COL_STYLE.base, minWidth: 130 }}>
                      <ScoreBar value={t.anomaly_score} color="orange" />
                    </td>
                    <td style={{ ...COL_STYLE.base, minWidth: 130 }}>
                      <ScoreBar value={t.risk_score} color="blue" />
                    </td>
                    <td style={COL_STYLE.base}>
                      <RiskBadge level={t.risk_level} />
                    </td>
                    <td style={COL_STYLE.base}>
                      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                        {new Date(t.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={COL_STYLE.base}>
                      <ExternalLink size={13} color="var(--text-muted)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...paginationBtnStyle(false), padding: '5px 10px', opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)} style={paginationBtnStyle(page === p)}>
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ ...paginationBtnStyle(false), padding: '5px 10px', opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
