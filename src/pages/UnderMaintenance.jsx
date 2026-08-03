/**
 * UnderMaintenance — professional maintenance screen.
 *
 * Design notes (kept deliberately restrained):
 *   • Light theme matching the RetailOps product (design tokens, slate + brand blue)
 *   • Real brand logo with a resilient fallback chain:
 *       1. VITE_MAINTENANCE_LOGO   (explicit override)
 *       2. /brandcentral-logo.png  (drop the file in public/ for self-hosting)
 *       3. https://brandcentral.in/wp-content/uploads/2024/09/logo.png
 *       4. /retailops-logo.svg     (repo fallback — never a broken image)
 *   • One-time fade-up entrance + a subtle status-dot pulse. Nothing else
 *     loops — motion stays quiet and respects prefers-reduced-motion.
 *
 * Env overrides:
 *   VITE_MAINTENANCE_TITLE    headline text          (default: "We'll be right back")
 *   VITE_MAINTENANCE_MESSAGE  body copy
 *   VITE_MAINTENANCE_ETA      "30 minutes" etc.      (shown as 'Back online · …')
 *   VITE_MAINTENANCE_EMAIL    support address        (footer link)
 *   VITE_MAINTENANCE_LOGO     logo URL/path override
 */
import React, { useEffect, useState } from 'react';

const TITLE = import.meta.env.VITE_MAINTENANCE_TITLE || "We'll be right back";
const MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE ||
  'We are performing scheduled maintenance right now. The platform will be back online shortly — thank you for your patience.';
const ETA = import.meta.env.VITE_MAINTENANCE_ETA || '';
const SUPPORT_EMAIL = import.meta.env.VITE_MAINTENANCE_EMAIL || 'support@brandcentral.in';

const LOGO_SOURCES = [
  import.meta.env.VITE_MAINTENANCE_LOGO,
  '/brandcentral-logo.png',
  'https://brandcentral.in/wp-content/uploads/2024/09/logo.png',
  '/retailops-logo.svg',
].filter(Boolean);

/** Walks the fallback chain if an image fails to load. */
function BrandLogo() {
  const [idx, setIdx] = useState(0);
  if (idx >= LOGO_SOURCES.length) return null;

  return (
    <img
      src={LOGO_SOURCES[idx]}
      alt="BrandCentral"
      draggable={false}
      onError={() => setIdx(i => i + 1)}
      style={{
        height: 44,
        width: 'auto',
        maxWidth: 220,
        objectFit: 'contain',
        userSelect: 'none',
      }}
    />
  );
}

export default function UnderMaintenance() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Under Maintenance · BrandCentral';
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bc-surface-page, #f8fafc)',
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
          maxWidth: 520,
          textAlign: 'center',
          animation: 'um-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <BrandLogo />
          </div>

          {/* Status eyebrow */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px 5px 10px',
            borderRadius: 'var(--bc-radius-full, 9999px)',
            background: 'var(--bc-surface-card, #fff)',
            border: '1px solid var(--bc-border-default, #e2e8f0)',
            boxShadow: 'var(--bc-shadow-xs, 0 1px 2px rgba(0,0,0,0.04))',
          }}>
            <span className="um-dot" aria-hidden="true" style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--bc-amber-500, #f59e0b)',
            }} />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--bc-text-secondary, #64748b)',
            }}>
              Maintenance in progress
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            margin: '20px 0 0',
            fontSize: 'clamp(26px, 4.5vw, 32px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            color: 'var(--bc-text-heading, #0f172a)',
          }}>
            {TITLE}
          </h1>

          {/* Body copy */}
          <p style={{
            margin: '12px auto 0',
            maxWidth: 430,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: 'var(--bc-text-secondary, #64748b)',
          }}>
            {MESSAGE}
          </p>

          {/* ETA */}
          {ETA && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              marginTop: 26,
              padding: '7px 14px',
              borderRadius: 'var(--bc-radius-full, 9999px)',
              background: 'var(--bc-surface-card, #fff)',
              border: '1px solid var(--bc-border-default, #e2e8f0)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--bc-text-body, #334155)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--bc-ro-500, #1976D2)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Back online · <strong style={{ fontWeight: 600, color: 'var(--bc-text-heading, #0f172a)' }}>{ETA}</strong>
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
            style={{ color: 'var(--bc-text-secondary, #64748b)', textDecoration: 'none', borderBottom: '1px solid transparent', transition: 'color 0.15s ease, border-color 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--bc-ro-600, #1565C0)'; e.currentTarget.style.borderBottomColor = 'var(--bc-ro-300, #90CAF9)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--bc-text-secondary, #64748b)'; e.currentTarget.style.borderBottomColor = 'transparent'; }}
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
          .um-root *, .um-dot { animation: none !important; }
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
