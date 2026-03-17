import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  ShieldAlert, AlertTriangle, TrendingUp, DollarSign, Activity, Database,
} from 'lucide-react';
import Header from '../components/Header';
import MetricCard from '../components/MetricCard';
import {
  getMetrics, getFraudTrendData, getRiskDistribution,
  getFraudByCountry, getFraudByMCC, getHourlyVolume,
} from '../data/dummyData';

const CHART_BG = 'var(--bg-elevated)';
const BORDER = 'var(--border-subtle)';

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-0.01em' }}>
      {children}
    </h2>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
      padding: '20px 24px',
      ...style,
    }}>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000
            ? `$${p.value.toLocaleString()}`
            : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Overview({ transactions, lastUpdated, isRefreshing, newCount, onRefresh }) {
  const metrics = useMemo(() => getMetrics(transactions), [transactions]);
  const trendData = useMemo(() => getFraudTrendData(transactions), [transactions]);
  const riskDist = useMemo(() => getRiskDistribution(transactions), [transactions]);
  const byCountry = useMemo(() => getFraudByCountry(transactions), [transactions]);
  const byMCC = useMemo(() => getFraudByMCC(transactions), [transactions]);
  const hourlyVol = useMemo(() => getHourlyVolume(transactions), [transactions]);

  const formatCurrency = (v) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Overview Dashboard"
        subtitle={`Monitoring ${metrics.totalTransactions.toLocaleString()} transactions · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        newCount={newCount}
      />

      <div style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          <MetricCard
            title="Transactions Today"
            value={metrics.totalTransactionsToday.toLocaleString()}
            subtitle="Since midnight"
            icon={Database}
            color="blue"
            trend={12}
          />
          <MetricCard
            title="Fraud Alerts Today"
            value={metrics.totalFraudAlerts.toLocaleString()}
            subtitle={`${metrics.allTimeFraudAlerts} all time`}
            icon={ShieldAlert}
            color="red"
            trend={8}
          />
          <MetricCard
            title="Anomaly Alerts Today"
            value={metrics.totalAnomalyAlerts.toLocaleString()}
            subtitle={`${metrics.allTimeAnomalyAlerts} all time`}
            icon={AlertTriangle}
            color="orange"
            trend={5}
          />
          <MetricCard
            title="Fraud Rate"
            value={`${metrics.fraudRate}%`}
            subtitle="Of today's transactions"
            icon={TrendingUp}
            color="yellow"
            trend={-3}
          />
          <MetricCard
            title="Volume Today"
            value={formatCurrency(metrics.totalVolumeToday)}
            subtitle="Total processed"
            icon={DollarSign}
            color="green"
            trend={18}
          />
          <MetricCard
            title="High Risk"
            value={metrics.highRiskCount.toLocaleString()}
            subtitle={`${metrics.mediumRiskCount} medium, ${metrics.lowRiskCount} low`}
            icon={Activity}
            color="red"
            trend={4}
          />
        </div>

        {/* Fraud Trend + Risk Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card>
            <SectionTitle>Fraud & Anomaly Trend (14 days)</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 12 }} />
                <Area type="monotone" dataKey="fraud" name="Fraud Alerts" stroke="#e11d48" strokeWidth={2} fill="url(#fraudGrad)" dot={false} />
                <Area type="monotone" dataKey="anomaly" name="Anomaly Alerts" stroke="#f97316" strokeWidth={2} fill="url(#anomalyGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle>Risk Level Distribution</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {riskDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riskDist.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Hourly Volume */}
        <Card style={{ marginBottom: 20 }}>
          <SectionTitle>Hourly Transaction Volume (Today)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyVol} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="volume" name="Volume ($)" fill="#be123c" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Fraud by Country + MCC */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <SectionTitle>Fraud Alerts by Country</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byCountry} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="country" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Fraud Alerts" fill="#9f1239" radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle>Fraud Alerts by Merchant Category</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byMCC} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Fraud Alerts" fill="#be123c" radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
