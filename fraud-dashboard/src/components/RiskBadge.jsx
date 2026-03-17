import React from 'react';

const styles = {
  HIGH: {
    background: 'rgba(225,29,72,0.15)',
    color: '#fb7185',
    border: '1px solid rgba(225,29,72,0.35)',
    dot: '#e11d48',
  },
  MEDIUM: {
    background: 'rgba(245,158,11,0.12)',
    color: '#fbbf24',
    border: '1px solid rgba(245,158,11,0.3)',
    dot: '#f59e0b',
  },
  LOW: {
    background: 'rgba(16,185,129,0.1)',
    color: '#34d399',
    border: '1px solid rgba(16,185,129,0.25)',
    dot: '#10b981',
  },
};

export default function RiskBadge({ level, size = 'sm' }) {
  const style = styles[level] || styles.LOW;
  const fontSize = size === 'lg' ? '13px' : '11px';
  const padding = size === 'lg' ? '5px 12px' : '3px 8px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        borderRadius: '20px',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: style.background,
        color: style.color,
        border: style.border,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: size === 'lg' ? 7 : 5,
          height: size === 'lg' ? 7 : 5,
          borderRadius: '50%',
          background: style.dot,
          flexShrink: 0,
          ...(level === 'HIGH' && {
            boxShadow: `0 0 6px ${style.dot}`,
            animation: 'pulse-red 1.5s ease-in-out infinite',
          }),
        }}
      />
      {level === 'HIGH' ? 'High Risk' : level === 'MEDIUM' ? 'Medium Risk' : 'Low Risk'}
    </span>
  );
}
