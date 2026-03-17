import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

/* ── tiny sub-components ──────────────────────────────────────── */

function InputField({ id, label, type = 'text', icon: Icon, placeholder, value, onChange, rightSlot }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        }}>
          <Icon size={16} />
        </span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete="off"
          style={{
            width: '100%',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '11px 40px',
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.2s',
            fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--red-600)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
        />
        {rightSlot && (
          <span style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer',
          }}>
            {rightSlot}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── main component ───────────────────────────────────────────── */

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  const update = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isLogin && !form.name) {
      setError('Please enter your full name.');
      return;
    }
    if (!isLogin && form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin
        ? 'http://localhost:8000/api/v1/auth/login'
        : 'http://localhost:8000/api/v1/auth/register';

      const body = isLogin
        ? { email: form.email, password: form.password }
        : { email: form.email, full_name: form.name, password: form.password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Something went wrong. Please try again.');
        return;
      }

      // Persist token + basic user info
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      // Redirect to dashboard
      window.location.href = '/';
    } catch (err) {
      setError('Could not reach the server. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setForm({ name: '', email: '', password: '', confirm: '' });
    setError('');
    setShowPass(false);
    setShowConfirm(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow orbs */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(225,29,72,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(190,18,60,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 20,
        padding: '40px 36px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
        position: 'relative',
        zIndex: 1,
        animation: 'slide-in 0.35s ease forwards',
      }}>

        {/* Logo / Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--red-700), var(--red-900))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
            boxShadow: '0 8px 24px rgba(225,29,72,0.35)',
          }}>
            <ShieldCheck size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            FraudGuard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            AI-Powered Transaction Intelligence
          </p>
        </div>

        {/* Toggle tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 4,
          marginBottom: 28,
        }}>
          {['login', 'register'].map((tab) => (
            <button
              key={tab}
              id={`auth-tab-${tab}`}
              onClick={() => switchMode(tab)}
              style={{
                flex: 1,
                padding: '9px 0',
                border: 'none',
                borderRadius: 9,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.01em',
                transition: 'all 0.22s ease',
                background: mode === tab
                  ? 'linear-gradient(135deg, var(--red-700), var(--red-900))'
                  : 'transparent',
                color: mode === tab ? '#fff' : 'var(--text-muted)',
                boxShadow: mode === tab ? '0 4px 14px rgba(225,29,72,0.3)' : 'none',
              }}
            >
              {tab === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 4 }}>
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {isLogin
              ? 'Sign in to access your fraud monitoring dashboard.'
              : 'Get started with real-time fraud intelligence.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <div style={{ animation: 'slide-in 0.25s ease forwards' }}>
              <InputField
                id="auth-name"
                label="Full Name"
                icon={User}
                placeholder="John Doe"
                value={form.name}
                onChange={update('name')}
              />
            </div>
          )}

          <InputField
            id="auth-email"
            label="Email Address"
            type="email"
            icon={Mail}
            placeholder="you@example.com"
            value={form.email}
            onChange={update('email')}
          />

          <InputField
            id="auth-password"
            label="Password"
            type={showPass ? 'text' : 'password'}
            icon={Lock}
            placeholder="••••••••"
            value={form.password}
            onChange={update('password')}
            rightSlot={
              <span onClick={() => setShowPass(p => !p)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </span>
            }
            
          />

          {!isLogin && (
            <div style={{ animation: 'slide-in 0.25s ease forwards' }}>
              <InputField
                id="auth-confirm"
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                icon={Lock}
                placeholder="••••••••"
                value={form.confirm}
                onChange={update('confirm')}
                rightSlot={
                  <span onClick={() => setShowConfirm(p => !p)}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                }
              />
            </div>
          )}

          {isLogin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                id="auth-forgot-password"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--red-400)', fontFamily: 'inherit',
                  padding: 0,
                }}
                onMouseEnter={e => e.target.style.color = 'var(--red-300)'}
                onMouseLeave={e => e.target.style.color = 'var(--red-400)'}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(225,29,72,0.1)',
              border: '1px solid rgba(225,29,72,0.25)',
              borderRadius: 8, padding: '10px 12px',
              animation: 'fade-in 0.2s ease forwards',
            }}>
              <AlertCircle size={14} color="var(--red-400)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--red-400)' }}>{error}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              marginTop: 4,
              background: loading
                ? 'var(--bg-overlay)'
                : 'linear-gradient(135deg, var(--red-600), var(--red-800))',
              color: loading ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 10,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
              letterSpacing: '0.01em',
              boxShadow: loading ? 'none' : '0 6px 20px rgba(225,29,72,0.35)',
            }}
            onMouseEnter={e => {
              if (!loading) e.currentTarget.style.boxShadow = '0 8px 28px rgba(225,29,72,0.5)';
            }}
            onMouseLeave={e => {
              if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(225,29,72,0.35)';
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid var(--text-muted)',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                {isLogin ? 'Signing in…' : 'Creating account…'}
              </>
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Switch prompt */}
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            id={isLogin ? 'auth-switch-register' : 'auth-switch-login'}
            type="button"
            onClick={() => switchMode(isLogin ? 'register' : 'login')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--red-400)', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, padding: 0,
            }}
            onMouseEnter={e => e.target.style.color = 'var(--red-300)'}
            onMouseLeave={e => e.target.style.color = 'var(--red-400)'}
          >
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>

      {/* Spinning keyframe via style tag */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
