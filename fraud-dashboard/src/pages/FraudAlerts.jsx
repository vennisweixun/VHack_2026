import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Search, ChevronLeft, ChevronRight, ExternalLink, X, TrendingUp } from 'lucide-react';
import Header from '../components/Header';
import RiskBadge from '../components/RiskBadge';

const PAGE_SIZE = 25;
const FRAUD_THRESHOLD = 0.65;

export default function FraudAlerts({ transactions, lastUpdated, isRefreshing, newCount, onRefresh }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState(FRAUD_THRESHOLD);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'fraud_probability', dir: 'desc' });

  const fraudTxns = useMemo(() => {
    let data = transactions.filter(t => t.fraud_probability >= threshold);

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        t.transaction_id.toLowerCase().includes(q) ||
        t.merchant_country.toLowerCase().includes(q) ||
        t.merchant_name.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'number') return sort.dir === 'desc' ? bv - av : av - bv;
      return sort.dir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });

    return data;
  }, [transactions, threshold, search, sort]);

  const totalPages = Math.ceil(fraudTxns.length / PAGE_SIZE);
  const paginated = fraudTxns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortBy = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const SortIcon = ({ col }) => {
    if (sort.key !== col) return <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>↕</span>;
    return <span style={{ color: '#fb7185', marginLeft: 4 }}>{sort.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  const colH = { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap', cursor: 'pointer' };
  const colC = { padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };

  const btnStyle = (active) => ({
    padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid rgba(225,29,72,0.4)' : '1px solid var(--border-default)',
    background: active ? 'rgba(225,29,72,0.12)' : 'var(--bg-elevated)',
    color: active ? '#fb7185' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Fraud Alerts"
        subtitle={`${fraudTxns.length} transactions flagged with fraud probability ≥ ${(threshold * 100).toFixed(0)}%`}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        newCount={newCount}
      />

      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary banner */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}>
          {[
            { label: 'Total Alerts', value: fraudTxns.length, color: '#e11d48' },
            { label: 'Avg Fraud Prob', value: fraudTxns.length > 0 ? `${(fraudTxns.reduce((s, t) => s + t.fraud_probability, 0) / fraudTxns.length * 100).toFixed(1)}%` : '—', color: '#fb7185' },
            { label: 'Critical (>90%)', value: fraudTxns.filter(t => t.fraud_probability > 0.9).length, color: '#f87171' },
            { label: 'Unreviewed', value: fraudTxns.filter(t => !t.reviewed).length, color: '#fca5a5' },
            { label: 'Total Value at Risk', value: `$${fraudTxns.reduce((s, t) => s + t.amount, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: '#fda4af' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12,
          padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search transaction ID, merchant, country..."
              style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
            {search && <X size={13} onClick={() => { setSearch(''); setPage(1); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Threshold:</span>
            {[0.5, 0.65, 0.75, 0.9].map(v => (
              <button key={v} style={btnStyle(threshold === v)} onClick={() => { setThreshold(v); setPage(1); }}>
                {(v * 100).toFixed(0)}%+
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', flex: 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={colH} onClick={() => sortBy('transaction_id')}>Transaction ID <SortIcon col="transaction_id" /></th>
                  <th style={colH} onClick={() => sortBy('amount')}>Amount <SortIcon col="amount" /></th>
                  <th style={colH}>Currency</th>
                  <th style={colH} onClick={() => sortBy('fraud_probability')}>Fraud Probability <SortIcon col="fraud_probability" /></th>
                  <th style={colH} onClick={() => sortBy('risk_level')}>Risk Level <SortIcon col="risk_level" /></th>
                  <th style={colH}>Country</th>
                  <th style={colH}>Merchant</th>
                  <th style={colH}>Channel</th>
                  <th style={colH} onClick={() => sortBy('timestamp')}>Timestamp <SortIcon col="timestamp" /></th>
                  <th style={colH}>Status</th>
                  <th style={colH}></th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No fraud alerts found</td></tr>
                ) : paginated.map((t, i) => {
                  const criticalLevel = t.fraud_probability > 0.9;
                  return (
                    <tr key={t.transaction_id}
                      onClick={() => navigate(`/transaction/${t.transaction_id}`)}
                      style={{
                        cursor: 'pointer',
                        background: criticalLevel ? 'rgba(225,29,72,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                        transition: 'background 0.1s',
                        borderLeft: criticalLevel ? '2px solid rgba(225,29,72,0.5)' : '2px solid transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(225,29,72,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = criticalLevel ? 'rgba(225,29,72,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                    >
                      <td style={colC}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldAlert size={12} color="#e11d48" />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#fb7185' }}>{t.transaction_id}</span>
                        </div>
                      </td>
                      <td style={{ ...colC, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={colC}><span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{t.currency}</span></td>
                      <td style={colC}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                            <div style={{ width: `${t.fraud_probability * 100}%`, height: '100%', background: t.fraud_probability > 0.9 ? '#e11d48' : t.fraud_probability > 0.75 ? '#f43f5e' : '#fb7185', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.fraud_probability > 0.9 ? '#f87171' : '#fb7185', minWidth: 40, fontFamily: 'JetBrains Mono, monospace' }}>
                            {(t.fraud_probability * 100).toFixed(1)}%
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
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{t.merchant_name}</span>
                      </td>
                      <td style={colC}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {t.channel}
                        </span>
                      </td>
                      <td style={colC}>
                        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                          {new Date(t.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td style={colC}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                          background: t.reviewed ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          color: t.reviewed ? '#34d399' : '#fbbf24',
                          border: `1px solid ${t.reviewed ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                          textTransform: 'uppercase',
                        }}>
                          {t.reviewed ? 'Reviewed' : 'Pending'}
                        </span>
                      </td>
                      <td style={colC}><ExternalLink size={13} color="var(--text-muted)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, fraudTxns.length)}–{Math.min(page * PAGE_SIZE, fraudTxns.length)} of {fraudTxns.length}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ ...btnStyle(false), padding: '5px 10px', opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages || p < 1) return null;
                return <button key={p} onClick={() => setPage(p)} style={btnStyle(page === p)}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ ...btnStyle(false), padding: '5px 10px', opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
