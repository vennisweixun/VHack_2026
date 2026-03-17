import React from 'react';

export default function MetricCard({ title, value, subtitle, icon: Icon, color = 'red', trend }) {
  const colorMap = {
    red: { accent: '#e11d48', bg: 'rgba(225,29,72,0.08)', border: 'rgba(225,29,72,0.2)', glow: 'rgba(225,29,72,0.15)' },
    orange: { accent: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', glow: 'rgba(249,115,22,0.12)' },
    yellow: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', glow: 'rgba(245,158,11,0.1)' },
    green: { accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', glow: 'rgba(16,185,129,0.1)' },
    blue: { accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', glow: 'rgba(59,130,246,0.1)' },
  };
  const c = colorMap[color] || colorMap.red;

  const trendColor = trend > 0 ? '#f87171' : '#34d399';
  const trendSymbol = trend > 0 ? '↑' : '↓';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${c.border}`,
        borderRadius: '14px',
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 0 30px ${c.glow}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 40px ${c.glow}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = `0 0 30px ${c.glow}`;
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: c.glow,
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {title}
        </span>
        {Icon && (
          <div style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: c.bg,
            border: `1px solid ${c.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={18} color={c.accent} strokeWidth={1.8} />
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
        {(subtitle || trend !== undefined) && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {subtitle && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subtitle}</span>
            )}
            {trend !== undefined && (
              <span style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>
                {trendSymbol} {Math.abs(trend)}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
