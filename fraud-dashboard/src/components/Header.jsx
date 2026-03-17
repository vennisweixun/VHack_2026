import React from 'react';
import { RefreshCw, Bell, Search } from 'lucide-react';

export default function Header({ title, subtitle, lastUpdated, onRefresh, isRefreshing, newCount }) {
  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header style={{
      padding: '16px 28px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backdropFilter: 'blur(10px)',
    }}>
      {/* Title */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</p>
        )}
      </div>

      {/* Live indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px',
        borderRadius: 20,
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.2)',
        fontSize: 11, fontWeight: 600, color: '#34d399',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#10b981',
          animation: 'live-pulse 2s ease-in-out infinite',
        }} />
        LIVE
      </div>

      {/* Last updated */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
        <div>Last updated</div>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
          {formatTime(lastUpdated)}
        </div>
      </div>

      {/* New transactions badge */}
      {newCount > 0 && (
        <div style={{
          padding: '5px 12px',
          borderRadius: 20,
          background: 'rgba(225,29,72,0.12)',
          border: '1px solid rgba(225,29,72,0.3)',
          fontSize: 11, fontWeight: 700, color: '#fb7185',
          animation: 'fade-in 0.3s ease',
        }}>
          +{newCount} new
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 9,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(225,29,72,0.4)'; e.currentTarget.style.color = '#fb7185'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        title="Refresh data"
      >
        <RefreshCw size={15} style={{ transition: 'transform 0.4s', transform: isRefreshing ? 'rotate(360deg)' : 'none' }} />
      </button>

      {/* Notification bell */}
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 9,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        cursor: 'pointer',
        position: 'relative',
        color: 'var(--text-secondary)',
      }}>
        <Bell size={15} />
        {newCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, borderRadius: '50%',
            background: '#e11d48',
            border: '2px solid var(--bg-elevated)',
          }} />
        )}
      </button>
    </header>
  );
}
