<<<<<<< HEAD
import React, { useEffect } from 'react';

const LOGO_SOURCES = [
  import.meta.env.VITE_MAINTENANCE_LOGO,
  '/brandcentral-logo.png',
  'https://brandcentral.in/wp-content/uploads/2024/09/logo.png',
].filter(Boolean);

const ETA = (import.meta.env.VITE_MAINTENANCE_ETA || '30 Minutes').trim();
const STATUS_PAGE = import.meta.env.VITE_STATUS_PAGE || 'https://status.brandcentral.in';
const SUPPORT_EMAIL = import.meta.env.VITE_MAINTENANCE_EMAIL || 'support@brandcentral.in';

const FONT = "var(--bc-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)";

function BrandLogo() {
  const [idx, setIdx] = React.useState(0);
  if (idx >= LOGO_SOURCES.length) return null;
  return (
    <img
      src={LOGO_SOURCES[idx]}
      alt="BrandCentral"
      onError={() => setIdx(i => i + 1)}
      style={{ height: 36, maxWidth: 200, objectFit: 'contain' }}
    />
  );
=======
/**
 * UnderMaintenance — RetailOps branded maintenance screen.
 *
 * Built around the project's own identity (same logo + palette as the app's
 * sidebar): light product theme, the real RetailOps wordmark (rich black +
 * enterprise gold), DM Sans, quiet motion.
 *
 * Env overrides:
 *   VITE_MAINTENANCE_TITLE    headline — "text |accent word| text" renders the
 *                             pipe-wrapped word in brand gold serif-italic
 *   VITE_MAINTENANCE_MESSAGE  body copy
 *   VITE_MAINTENANCE_ETA      any length ("ASAP", "~2–3 hours"…) — wraps cleanly
 *   VITE_MAINTENANCE_EMAIL    support address shown in footer
 *   VITE_MAINTENANCE_LOGO     optional custom logo URL; falls back to the
 *                             RetailOps wordmark on error
 */
import React, { useEffect, useState } from 'react';
import { RetailOpsWordmark } from '../components/common/BrandLogo';

const TITLE = import.meta.env.VITE_MAINTENANCE_TITLE || "We'll be right back";
const MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE ||
  'We are performing scheduled maintenance right now. The platform will be back online shortly — thank you for your patience.';
const ETA = import.meta.env.VITE_MAINTENANCE_ETA || '';
const SUPPORT_EMAIL = import.meta.env.VITE_MAINTENANCE_EMAIL || 'support@brandcentral.in';
const LOGO_URL = import.meta.env.VITE_MAINTENANCE_LOGO || '';

// "We're |restocking| the shelves." → pre="We're", accent="restocking", post="the shelves."
const [TITLE_PRE, TITLE_ACCENT, TITLE_POST] = (() => {
  const parts = TITLE.split('|').map(s => s.trim());
  return [parts[0] || '', parts[1] || '', parts[2] || ''];
})();

/** Renders the project wordmark, or a custom logo if provided (with fallback). */
function Logo() {
  const [failed, setFailed] = useState(false);
  if (LOGO_URL && !failed) {
    return (
      <img
        src={LOGO_URL}
        alt="RetailOps"
        draggable={false}
        onError={() => setFailed(true)}
        style={{ height: 44, width: 'auto', maxWidth: 240, objectFit: 'contain', userSelect: 'none' }}
      />
    );
  }
  return <RetailOpsWordmark size={40} />;
>>>>>>> 228763dced2c67fe9061d459abe9b36605058bbc
}

const ICON = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 56,
  height: 56,
  borderRadius: 16,
  color: '#fff',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  boxShadow: '0 10px 24px rgba(37,99,235,.35)',
};

const BTN = {
  padding: '11px 22px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  boxShadow: '0 6px 16px rgba(37,99,235,.28)',
  textDecoration: 'none',
};

const LINK = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#1d4ed8',
  fontWeight: 600,
  fontSize: 12,
  textDecoration: 'none',
};

export default function UnderMaintenance() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'RetailOps · Under Maintenance';
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
<<<<<<< HEAD
      alignItems: 'center',
      justifyContent: 'center',
      gap: 34,
      padding: 40,
      fontFamily: FONT,
      color: '#475569',
      textAlign: 'center',
      background: 'linear-gradient(180deg, #f8fafc, #eef2f7)',
=======
      background: 'linear-gradient(180deg, var(--bc-surface-page, #f8fafc) 0%, #ffffff 100%)',
      fontFamily: 'var(--bc-font-sans, Inter, -apple-system, "Segoe UI", sans-serif)',
      color: 'var(--bc-text-body, #334155)',
      WebkitFontSmoothing: 'antialiased',
>>>>>>> 228763dced2c67fe9061d459abe9b36605058bbc
    }}>
      <main style={{
        width: '100%',
        maxWidth: 440,
        boxSizing: 'border-box',
        padding: '40px 32px',
        borderRadius: 20,
        background: '#fff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 18px 50px rgba(15,23,42,.10)',
      }}>
<<<<<<< HEAD
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
          <BrandLogo />
        </div>

        <div aria-hidden="true" style={ICON}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1 style={{ margin: '18px 0 8px', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: '#0f172a' }}>
          We&apos;re upgrading BrandCentral
        </h1>

        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          Scheduled maintenance in progress. We&apos;ll be back shortly.
        </p>

        {ETA && (
          <p role="status" style={{ margin: '16px 0 0', fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
            Expected completion: {ETA}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginTop: 28 }}>
          <button type="button" onClick={() => window.location.reload()} aria-label="Refresh this page" style={BTN}>
            Refresh
          </button>
          <a href={STATUS_PAGE} target="_blank" rel="noopener noreferrer" aria-label="Open system status page" style={BTN}>
            System Status
          </a>
        </div>
      </main>

      <footer style={{ fontSize: 12 }}>
        Need help?{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} aria-label={`Email ${SUPPORT_EMAIL}`} style={LINK}>
          {SUPPORT_EMAIL}
        </a>
      </footer>
=======
        <div style={{
          width: '100%',
          maxWidth: 540,
          textAlign: 'center',
          animation: 'um-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
          {/* Project logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 44 }}>
            <Logo />
          </div>

          {/* Status eyebrow */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px 6px 12px',
            borderRadius: 'var(--bc-radius-full, 9999px)',
            background: 'var(--bc-surface-card, #fff)',
            border: '1px solid var(--bc-border-default, #e2e8f0)',
            boxShadow: 'var(--bc-shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
          }}>
            <span className="um-dot" aria-hidden="true" style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--bc-amber-500, #f59e0b)',
            }} />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--bc-text-secondary, #64748b)',
            }}>
              Under Maintenance
            </span>
          </div>

          {/* Headline — pipe-wrapped word renders in brand gold serif-italic */}
          <h1 style={{
            margin: '22px 0 0',
            fontSize: 'clamp(30px, 5vw, 42px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.18,
            color: 'var(--bc-text-heading, #0f172a)',
          }}>
            {TITLE_PRE}{TITLE_ACCENT ? ' ' : ''}
            {TITLE_ACCENT && (
              <em style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontStyle: 'italic',
                fontWeight: 500,
                color: '#CA8A04',            // enterprise gold — the wordmark's accent
                whiteSpace: 'nowrap',
              }}>{TITLE_ACCENT}</em>
            )}{TITLE_POST ? ' ' : ''}{TITLE_POST}
          </h1>

          {/* Body copy */}
          {MESSAGE && (
            <p style={{
              margin: '14px auto 0',
              maxWidth: 440,
              fontSize: 14.5,
              lineHeight: 1.7,
              color: 'var(--bc-text-secondary, #64748b)',
            }}>
              {MESSAGE}
            </p>
          )}

          {/* ETA — designed for long values (wraps, never truncates) */}
          {ETA && (
            <div style={{
              margin: '30px auto 0',
              maxWidth: 440,
              padding: '18px 24px 20px',
              borderRadius: 'var(--bc-radius-xl, 12px)',
              background: 'var(--bc-surface-card, #fff)',
              border: '1px solid var(--bc-border-default, #e2e8f0)',
              boxShadow: 'var(--bc-shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
            }}>
              <div style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--bc-text-muted, #94a3b8)',
                marginBottom: 8,
              }}>
                Estimated downtime
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.45,
                letterSpacing: '-0.01em',
                color: 'var(--bc-text-heading, #0f172a)',
                wordBreak: 'normal',
                overflowWrap: 'anywhere',
              }}>
                {ETA}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '20px 24px',
        textAlign: 'center',
        borderTop: '1px solid var(--bc-border-subtle, #f1f5f9)',
        background: 'var(--bc-surface-card, #fff)',
      }}>
        <span style={{ fontSize: 12.5, color: 'var(--bc-text-muted, #94a3b8)' }}>
          © {new Date().getFullYear()} BrandCentral Pvt. Ltd. ·{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{
              color: 'var(--bc-text-secondary, #64748b)',
              textDecoration: 'none',
              borderBottom: '1px solid transparent',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--bc-ro-600, #1565C0)';
              e.currentTarget.style.borderBottomColor = 'var(--bc-ro-300, #90CAF9)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--bc-text-secondary, #64748b)';
              e.currentTarget.style.borderBottomColor = 'transparent';
            }}
          >
            {SUPPORT_EMAIL}
          </a>
        </span>
      </footer>

      <style>{`
        @keyframes um-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes um-dot-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
        .um-dot { animation: um-dot-pulse 2.2s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .um-dot { animation: none !important; }
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
>>>>>>> 228763dced2c67fe9061d459abe9b36605058bbc
    </div>
  );
}
