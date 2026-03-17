import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children, fraudCount, anomalyCount }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Sidebar fraudCount={fraudCount} anomalyCount={anomalyCount} />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}
