import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  ShieldAlert,
  AlertTriangle,
  Settings,
  LogOut,
  Zap,
  Plug,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: List },
  { path: '/fraud-alerts', label: 'Fraud Alerts', icon: ShieldAlert },
  { path: '/anomaly-alerts', label: 'Anomaly Alerts', icon: AlertTriangle },
];

const systemItems = [
  { path: '/settings', label: 'API Settings', icon: Plug },
];

export default function Sidebar({ fraudCount, anomalyCount }) {
  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #be123c, #7f1d1d)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(190,18,60,0.4)',
          }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              FraudShield
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Admin Console
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 8 }}>
          Monitoring
        </div>
        {navItems.map(({ path, label, icon: Icon }) => {
          const badge = label === 'Fraud Alerts' ? fraudCount : label === 'Anomaly Alerts' ? anomalyCount : null;
          return (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 9,
                marginBottom: 2,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
                transition: 'all 0.15s',
                background: isActive ? 'rgba(225,29,72,0.12)' : 'transparent',
                color: isActive ? '#fb7185' : 'var(--text-secondary)',
                border: isActive ? '1px solid rgba(225,29,72,0.25)' : '1px solid transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {badge != null && badge > 0 && (
                    <span style={{
                      background: 'var(--red-700)',
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: 20,
                      minWidth: 20,
                      textAlign: 'center',
                    }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 8, marginTop: 24 }}>
          System
        </div>
        {systemItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 9, marginBottom: 2,
              textDecoration: 'none', fontSize: 13, fontWeight: 500,
              transition: 'all 0.15s',
              background: isActive ? 'rgba(225,29,72,0.12)' : 'transparent',
              color: isActive ? '#fb7185' : 'var(--text-secondary)',
              border: isActive ? '1px solid rgba(225,29,72,0.25)' : '1px solid transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #be123c, #7f1d1d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
        }}>
          JD
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            John Doe
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Super Admin</div>
        </div>
        <LogOut size={15} color="var(--text-muted)" style={{ cursor: 'pointer', flexShrink: 0 }} />
      </div>
    </aside>
  );
}
