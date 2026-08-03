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
}

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
      background: 'linear-gradient(180deg, var(--bc-surface-page, #f8fafc) 0%, #ffffff 100%)',
      fontFamily: 'var(--bc-font-sans, Inter, -apple-system, "Segoe UI", sans-serif)',
      color: 'var(--bc-text-body, #334155)',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '72px 24px',
      }}>
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
    </div>
  );
}
