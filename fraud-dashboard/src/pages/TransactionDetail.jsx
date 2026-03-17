import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldAlert, AlertTriangle, CreditCard,
  Globe, User, Hash, Clock, Smartphone, Monitor, Wifi,
  CheckCircle, XCircle, Info, Activity, DollarSign,
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';

function DetailRow({ label, value, mono = false, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      padding: '10px 0',
      borderBottom: '1px solid var(--border-subtle)',
      gap: 16,
    }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, paddingTop: 1 }}>{label}</span>
      {children || (
        <span style={{
          fontSize: 13, color: 'var(--text-primary)',
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
          wordBreak: 'break-all',
        }}>
          {value ?? '—'}
        </span>
      )}
    </div>
  );
}

function ScoreGauge({ label, value, color, description }) {
  const pct = Math.round(value * 100);
  const colorMap = { red: '#e11d48', orange: '#f97316', blue: '#3b82f6' };
  const c = colorMap[color] || colorMap.blue;
  const bgColor = color === 'red' ? 'rgba(225,29,72,0.08)' : color === 'orange' ? 'rgba(249,115,22,0.08)' : 'rgba(59,130,246,0.08)';
  const borderColor = color === 'red' ? 'rgba(225,29,72,0.2)' : color === 'orange' ? 'rgba(249,115,22,0.2)' : 'rgba(59,130,246,0.2)';

  return (
    <div style={{
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: c, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {pct}%
      </div>
      <div style={{ marginTop: 10, height: 6, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{description}</div>
    </div>
  );
}

// ── Detect flag type ──────────────────────────────────────────────────────────
function flagType(flag) {
  if (flag.startsWith('[derived]')) return 'derived';
  if (flag.startsWith('[rule]'))    return 'rule';
  return 'shap';
}

const FLAG_THEME = {
  'shap':    { bg: 'rgba(225,29,72,0.06)',   border: 'rgba(225,29,72,0.18)',   icon: ShieldAlert,   color: '#fb7185',  label: 'XGBoost SHAP — fraud risk factor' },
  'derived': { bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.18)',  icon: AlertTriangle, color: '#fbbf24',  label: 'Derived from transaction data (SHAP unavailable)' },
  'rule':    { bg: 'rgba(99,102,241,0.06)',  border: 'rgba(99,102,241,0.18)',  icon: Info,          color: '#a5b4fc',  label: 'Rule-based model (XGBoost pkl not loaded)' },
};

function FlagItem({ flag }) {
  const type  = flagType(flag);
  const theme = FLAG_THEME[type];
  const Icon  = theme.icon;

  const displayText = flag
    .replace(/^\[derived\]\s*/, '')
    .replace(/^\[rule\]\s*/,    '');

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px',
      background: theme.bg,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: theme.bg, border: `1px solid ${theme.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        <Icon size={14} color={theme.color} />
      </div>
      <div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {displayText}
        </span>
        {theme.label && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {theme.label}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Client-side explanation builder (last-resort for MEDIUM/HIGH with no flags) ──
// Used when: API offline + MEDIUM/HIGH risk, OR historical data with flags:[]
function buildClientExplanation(t) {
  const flags = [];
  const fp = t.fraud_probability || 0;

  if (fp >= 0.75)
    flags.push(`[derived] XGBoost fraud score ${(fp*100).toFixed(2)}% — exceeds BLOCK threshold (≥75%)`);
  else if (fp >= 0.40)
    flags.push(`[derived] XGBoost fraud score ${(fp*100).toFixed(2)}% — exceeds FLAG threshold (≥40%)`);
  else
    flags.push(`[derived] Fraud probability ${(fp*100).toFixed(2)}% — classified as ${t.risk_level} risk`);

  const amount = t.amount || 0;
  if (amount >= 10000)
    flags.push(`[derived] Very high transaction amount: MYR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  else if (amount >= 3000)
    flags.push(`[derived] Above-average transaction amount: MYR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

  const channel = t.channel || '';
  if (['ecommerce','in_app','moto'].includes(channel) && !t.card_present_flag)
    flags.push(`[derived] Card-not-present transaction via ${channel}`);

  if (['fail','missing'].includes((t.avs_result || '').toLowerCase()))
    flags.push('[derived] AVS address verification failed or missing');
  if (['fail','missing'].includes((t.cvc_result || '').toLowerCase()))
    flags.push('[derived] CVC card security code failed or missing');
  if (['challenge_failed','unavailable'].includes((t.three_ds_result || '').toLowerCase()))
    flags.push('[derived] 3DS authentication challenge failed or unavailable');

  const issuer   = t.issuer_country   || t.home_country || '';
  const merchant = t.merchant_country_code || '';
  if (issuer && merchant && issuer !== merchant)
    flags.push(`[derived] Cross-border transaction: card from ${issuer}, merchant in ${merchant}`);

  const HIGH_RISK_MCC = { 'Gambling': true, 'Crypto Exchange': true, 'Financial Services': true };
  if (t.mcc_label && HIGH_RISK_MCC[t.mcc_label])
    flags.push(`[derived] High-risk merchant category: ${t.mcc_label}`);

  return flags;
}

export default function TransactionDetail({ transactions }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const transaction = useMemo(() =>
    transactions.find(t => t.transaction_id === id),
    [transactions, id]
  );

  if (!transaction) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <XCircle size={48} color="var(--text-muted)" />
        <div style={{ fontSize: 18, color: 'var(--text-muted)' }}>Transaction not found</div>
        <button onClick={() => navigate(-1)} style={{
          padding: '8px 20px', borderRadius: 8, background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 13,
        }}>
          Go Back
        </button>
      </div>
    );
  }

  const t = transaction;
  const isFraud = t.is_fraud_alert;
  const isAnomaly = t.is_anomaly_alert;

  const channelIcon = { online: Monitor, mobile: Smartphone, atm: CreditCard, pos: CreditCard, wire_transfer: Wifi };
  const ChannelIcon = channelIcon[t.channel] || Monitor;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 28px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {t.transaction_id}
            </h1>
            <RiskBadge level={t.risk_level} size="lg" />
            {isFraud && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#fb7185', background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.25)', borderRadius: 6, padding: '3px 8px' }}>
                <ShieldAlert size={11} /> FRAUD ALERT
              </span>
            )}
            {isAnomaly && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#fb923c', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 6, padding: '3px 8px' }}>
                <AlertTriangle size={11} /> ANOMALY
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date(t.timestamp).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
          background: t.reviewed ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          color: t.reviewed ? '#34d399' : '#fbbf24',
          border: `1px solid ${t.reviewed ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {t.reviewed ? <CheckCircle size={12} /> : <Clock size={12} />}
          {t.reviewed ? 'Reviewed' : 'Pending Review'}
        </span>
      </div>

      <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <ScoreGauge label="Fraud Probability" value={t.fraud_probability} color="red" description="Likelihood of fraudulent activity" />
          <ScoreGauge label="Anomaly Score" value={t.anomaly_score} color="orange" description="Deviation from normal patterns" />
          <ScoreGauge label="Risk Score" value={t.risk_score} color="blue" description="Combined weighted risk metric" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          {/* Transaction Details */}
          <div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                <CreditCard size={15} color="var(--text-muted)" /> Transaction Information
              </h2>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />
              <DetailRow label="Transaction ID" value={t.transaction_id} mono />
              <DetailRow label="Customer ID" value={t.customer_id} mono />
              <DetailRow label="Bank ID" value={t.bank_id} mono />
              <DetailRow label="Amount">
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>{t.currency}</span>
                </span>
              </DetailRow>
              <DetailRow label="Merchant" value={t.merchant_name} />
              <DetailRow label="MCC Code">
                <span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{t.mcc_code}</span>
                  {t.mcc_label}
                </span>
              </DetailRow>
              <DetailRow label="Merchant Country">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>
                    {t.merchant_country_code ? String.fromCodePoint(...[...t.merchant_country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌍'}
                  </span>
                  <span>{t.merchant_country}</span>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>({t.merchant_country_code})</span>
                </div>
              </DetailRow>
              <DetailRow label="Channel">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChannelIcon size={14} color="var(--text-muted)" />
                  <span style={{ textTransform: 'capitalize' }}>{t.channel.replace('_', ' ')}</span>
                </div>
              </DetailRow>
            </div>

            {/* Technical Details */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Monitor size={15} color="var(--text-muted)" /> Technical Information
              </h2>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />
              <DetailRow label="Device ID" value={t.device_id} mono />
              <DetailRow label="IP Address" value={t.ip_address} mono />
              <DetailRow label="Timestamp" value={t.timestamp} mono />
            </div>
          </div>

          {/* Risk Analysis */}
          <div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Activity size={15} color="var(--text-muted)" /> Risk Analysis
              </h2>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />
              <DetailRow label="Risk Level">
                <RiskBadge level={t.risk_level} size="lg" />
              </DetailRow>
              <DetailRow label="Fraud Probability">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#fb7185', fontWeight: 700 }}>
                  {(t.fraud_probability * 100).toFixed(2)}%
                </span>
              </DetailRow>
              <DetailRow label="Anomaly Score">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#fb923c', fontWeight: 700 }}>
                  {(t.anomaly_score * 100).toFixed(2)}%
                </span>
              </DetailRow>
              <DetailRow label="Risk Score">
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa', fontWeight: 700 }}>
                  {(t.risk_score * 100).toFixed(2)}%
                </span>
              </DetailRow>
              <DetailRow label="Fraud Alert">
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {isFraud
                    ? <><ShieldAlert size={14} color="#e11d48" /><span style={{ color: '#fb7185', fontWeight: 600, fontSize: 12 }}>Yes — above threshold</span></>
                    : <><CheckCircle size={14} color="#10b981" /><span style={{ color: '#34d399', fontSize: 12 }}>No</span></>
                  }
                </div>
              </DetailRow>
              <DetailRow label="Anomaly Alert">
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {isAnomaly
                    ? <><AlertTriangle size={14} color="#f97316" /><span style={{ color: '#fb923c', fontWeight: 600, fontSize: 12 }}>Yes — unusual pattern</span></>
                    : <><CheckCircle size={14} color="#10b981" /><span style={{ color: '#34d399', fontSize: 12 }}>No</span></>
                  }
                </div>
              </DetailRow>
            </div>

            {/* Explainability */}
            {(() => {
              const isHighOrMedium = t.risk_level === 'HIGH' || t.risk_level === 'MEDIUM';
              const isOffline      = t.scored_by === 'offline';
              const isMock         = t.scored_by === 'mock';
              const isXgb          = t.scored_by === 'pkl_model';
              const hasShap        = t.scored_by === 'pkl_model' && (t.flags || []).some(f => !f.startsWith('[derived]') && !f.startsWith('[rule]'));
              const hasDerived     = (t.flags || []).some(f => f.startsWith('[derived]'));
              const hasRule        = (t.flags || []).some(f => f.startsWith('[rule]'));
              const hasFlags       = (t.flags || []).length > 0;

              // Resolve what flags to actually display
              let displayFlags = t.flags || [];

              // Last resort: MEDIUM/HIGH with no flags at all → build client-side explanation
              if (isHighOrMedium && !hasFlags && !isOffline) {
                displayFlags = buildClientExplanation(t);
              }

              // Resolve source badge label
              const sourceBadge = isOffline ? { label: '⚡ Offline — local estimate',         bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)', color: '#94a3b8' }
                : isMock         ? { label: '⚙ Rule-based model (no pkl loaded)',             bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)',  color: '#a5b4fc' }
                : hasShap        ? { label: '🧠 XGBoost + SHAP',                             bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)',  color: '#a5b4fc' }
                : (hasDerived || displayFlags.some(f => f.startsWith('[derived]')))
                                 ? { label: '⚠ XGBoost score — derived explanation',         bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)',  color: '#fbbf24' }
                :                  { label: '🧠 XGBoost',                                    bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)',  color: '#a5b4fc' };

              return (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px' }}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Info size={15} color="var(--text-muted)" /> Explainability
                  </h2>

                  {/* Source badge */}
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 5,
                      background: sourceBadge.bg, border: `1px solid ${sourceBadge.border}`,
                      color: sourceBadge.color, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {sourceBadge.label}
                    </span>
                  </div>

                  {/* API offline */}
                  {isOffline ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 8, marginBottom: isHighOrMedium ? 12 : 0 }}>
                        <XCircle size={18} color="#64748b" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>The API is offline now.</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            The fraud score shown is a local estimate only. Start the FastAPI backend to get real XGBoost + SHAP explanations.
                          </div>
                        </div>
                      </div>
                      {/* Still show derived explanation for MEDIUM/HIGH offline transactions */}
                      {isHighOrMedium && buildClientExplanation(t).map((f, i) => <FlagItem key={i} flag={f} />)}
                    </>

                  ) : displayFlags.length === 0 ? (
                    // Low risk, no flags — clean pass
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8 }}>
                      <CheckCircle size={16} color="#10b981" />
                      <span style={{ fontSize: 13, color: '#34d399' }}>No significant risk factors detected — transaction appears normal</span>
                    </div>

                  ) : (
                    <>
                      {/* Contextual description */}
                      {hasShap && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                          The following factors from this transaction contributed most to the fraud score, as calculated by XGBoost SHAP analysis.
                        </p>
                      )}
                      {(hasDerived || displayFlags.some(f => f.startsWith('[derived]'))) && !hasShap && (
                        <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 12, lineHeight: 1.5,
                          padding: '8px 12px', background: 'rgba(245,158,11,0.07)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.18)' }}>
                          SHAP feature contributions were unavailable for this transaction. The explanations below are
                          derived directly from the transaction fields — each factor is a known fraud risk indicator.
                        </p>
                      )}
                      {hasRule && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                          Scored by the rule-based model (pkl not loaded). Each flag directly increased the fraud score.
                          Load <code style={{ fontSize: 11, background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4 }}>fraud_model.pkl</code> for SHAP explanations.
                        </p>
                      )}
                      {displayFlags.map((flag, i) => <FlagItem key={i} flag={flag} />)}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
