import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Search, ChevronLeft, ChevronRight, ExternalLink, X, Activity } from 'lucide-react';
import Header from '../components/Header';
import RiskBadge from '../components/RiskBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PAGE_SIZE = 25;
const ANOMALY_THRESHOLD = 0.60;

export default function AnomalyAlerts({ transactions, lastUpdated, isRefreshing, newCount, onRefresh }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState(ANOMALY_THRESHOLD);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'anomaly_score', dir: 'desc' });

  const anomalyTxns = useMemo(() => {
    let data = transactions.filter(t => t.anomaly_score >= threshold);

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        t.transaction_id.toLowerCase().includes(q) ||
        t.merchant_country.toLowerCase().includes(q) ||
        t.mcc_label.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'number') return sort.dir === 'desc' ? bv - av : av - bv;
      return sort.dir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });

    return data;
  }, [transactions, threshold, search, sort]);

  // Distribution chart data
  const distributionData = useMemo(() => {
    const buckets = [
      { range: '0.6–0.7', min: 0.6, max: 0.7 },
      { range: '0.7–0.8', min: 0.7, max: 0.8 },
      { range: '0.8–0.9', min: 0.8, max: 0.9 },
      { range: '0.9–1.0', min: 0.9, max: 1.01 },
    ];
    return buckets.map(b => ({
      range: b.range,
      count: anomalyTxns.filter(t => t.anomaly_score >= b.min && t.anomaly_score < b.max).length,
    }));
  }, [anomalyTxns]);

  const totalPages = Math.ceil(anomalyTxns.length / PAGE_SIZE);
  const paginated = anomalyTxns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortBy = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const SortIcon = ({ col }) => {
    if (sort.key !== col) return <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>↕</span>;
    return <span style={{ color: '#fb923c', marginLeft: 4 }}>{sort.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  const colH = { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap', cursor: 'pointer' };
  const colC = { padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const btnStyle = (active) => ({
    padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid rgba(249,115,22,0.4)' : '1px solid var(--border-default)',
    background: active ? 'rgba(249,115,22,0.12)' : 'var(--bg-elevated)',
    color: active ? '#fb923c' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Anomaly Alerts"
        subtitle={`${anomalyTxns.length} transactions with anomaly score ≥ ${(threshold * 100).toFixed(0)}%`}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        newCount={newCount}
      />

      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top section: stats + chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Total Anomalies', value: anomalyTxns.length, color: '#f97316' },
              { label: 'Avg Anomaly Score', value: anomalyTxns.length > 0 ? `${(anomalyTxns.reduce((s, t) => s + t.anomaly_score, 0) / anomalyTxns.length * 100).toFixed(1)}%` : '—', color: '#fb923c' },
              { label: 'Severe (>85%)', value: anomalyTxns.filter(t => t.anomaly_score > 0.85).length, color: '#fdba74' },
              { label: 'Also Fraud Flagged', value: anomalyTxns.filter(t => t.is_fraud_alert).length, color: '#fb7185' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Distribution chart */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Score Distribution</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={distributionData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="range" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: '#fb923c' }}
                />
                <Bar dataKey="count" name="Transactions" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by ID, category, country..."
              style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
            {search && <X size={13} onClick={() => { setSearch(''); setPage(1); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Threshold:</span>
            {[0.4, 0.6, 0.75, 0.9].map(v => (
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
                  <th style={colH} onClick={() => sortBy('anomaly_score')}>Anomaly Score <SortIcon col="anomaly_score" /></th>
                  <th style={colH} onClick={() => sortBy('fraud_probability')}>Fraud Prob <SortIcon col="fraud_probability" /></th>
                  <th style={colH} onClick={() => sortBy('risk_level')}>Risk Level <SortIcon col="risk_level" /></th>
                  <th style={colH}>MCC Category</th>
                  <th style={colH}>Country</th>
                  <th style={colH}>Channel</th>
                  <th style={colH} onClick={() => sortBy('timestamp')}>Timestamp <SortIcon col="timestamp" /></th>
                  <th style={colH}>Flags</th>
                  <th style={colH}></th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No anomaly alerts found</td></tr>
                ) : paginated.map((t, i) => (
                  <tr key={t.transaction_id}
                    onClick={() => navigate(`/transaction/${t.transaction_id}`)}
                    style={{
                      cursor: 'pointer',
                      background: t.anomaly_score > 0.85 ? 'rgba(249,115,22,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      transition: 'background 0.1s',
                      borderLeft: t.anomaly_score > 0.85 ? '2px solid rgba(249,115,22,0.5)' : '2px solid transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = t.anomaly_score > 0.85 ? 'rgba(249,115,22,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                  >
                    <td style={colC}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={12} color="#f97316" />
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#fb923c' }}>{t.transaction_id}</span>
                      </div>
                    </td>
                    <td style={{ ...colC, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={colC}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                          <div style={{ width: `${t.anomaly_score * 100}%`, height: '100%', background: t.anomaly_score > 0.85 ? '#f97316' : '#fb923c', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', minWidth: 40, fontFamily: 'JetBrains Mono, monospace' }}>
                          {(t.anomaly_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={colC}>
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: t.is_fraud_alert ? '#fb7185' : 'var(--text-muted)' }}>
                        {(t.fraud_probability * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td style={colC}><RiskBadge level={t.risk_level} /></td>
                    <td style={colC}><span style={{ fontSize: 12 }}>{t.mcc_label}</span></td>
                    <td style={colC}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>
                          {t.merchant_country_code ? String.fromCodePoint(...[...t.merchant_country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌍'}
                        </span>
                        <span style={{ fontSize: 12 }}>{t.merchant_country}</span>
                      </div>
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
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t.flags.length > 0 ? `${t.flags.length} flag${t.flags.length > 1 ? 's' : ''}` : '—'}
                      </span>
                    </td>
                    <td style={colC}><ExternalLink size={13} color="var(--text-muted)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, anomalyTxns.length)}–{Math.min(page * PAGE_SIZE, anomalyTxns.length)} of {anomalyTxns.length}
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
