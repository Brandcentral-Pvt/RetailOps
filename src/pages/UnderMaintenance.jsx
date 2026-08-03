/**
 * UnderMaintenance — standalone maintenance-mode screen.
 * Rendered directly (no router / providers) when VITE_MAINTENANCE_MODE=true.
 * Styled with the BrandCentral design tokens (src/styles/tokens.css).
 */
import React from 'react';

const MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE || 'We are performing scheduled maintenance. Our team is working hard to get everything back online shortly.';
const ETA = import.meta.env.VITE_MAINTENANCE_ETA || '';

export default function UnderMaintenance() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(1200px 600px at 50% -10%, var(--bc-ro-50, #E3F2FD), var(--bc-surface-page, #f8fafc) 60%)',
      padding: 24,
      fontFamily: 'var(--bc-font-sans, Inter, sans-serif)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        textAlign: 'center',
        background: 'var(--bc-surface-card, #fff)',
        border: '1px solid var(--bc-border-subtle, #e2e8f0)',
        borderRadius: 'var(--bc-radius-2xl, 16px)',
        boxShadow: 'var(--bc-shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.08))',
        padding: '48px 40px 40px',
      }}>
        {/* Animated brand tile */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--bc-radius-2xl, 16px)',
            background: 'linear-gradient(135deg, var(--bc-ro-500, #1976D2), var(--bc-ro-700, #0D47A1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(25, 118, 210, 0.35)',
          }}>
            {/* Cog icon — inline SVG so the page stays dependency-free */}
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: 'pems-spin 6s linear infinite' }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
        </div>

        {/* Status pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 'var(--bc-radius-full, 9999px)', background: 'var(--bc-amber-50, #fffbeb)', border: '1px solid var(--bc-amber-200, #fde68a)', marginBottom: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bc-amber-500, #f59e0b)', animation: 'pems-pulse 1.8s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bc-amber-700, #b45309)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Under Maintenance
          </span>
        </div>

        <h1 style={{
          margin: 0,
          fontSize: 'var(--bc-text-2xl, 24px)',
          fontWeight: 800,
          color: 'var(--bc-text-heading, #0f172a)',
          letterSpacing: '-0.02em',
        }}>
          We&apos;ll be back soon
        </h1>

        <p style={{
          margin: '12px 0 0',
          fontSize: 'var(--bc-text-sm, 13px)',
          lineHeight: 1.6,
          color: 'var(--bc-text-secondary, #64748b)',
        }}>
          {MESSAGE}
        </p>

        {ETA && (
          <div style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 'var(--bc-radius-lg, 8px)',
            background: 'var(--bc-surface-subtle, #f1f5f9)',
            border: '1px solid var(--bc-border-subtle, #e2e8f0)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bc-ro-600, #1565C0)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bc-ro-700, #0D47A1)' }}>
              Estimated completion: {ETA}
            </span>
          </div>
        )}

        <div style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: '1px solid var(--bc-border-subtle, #f1f5f9)',
          fontSize: 11,
          color: 'var(--bc-text-muted, #94a3b8)',
        }}>
          RetailOps · {new Date().getFullYear()} · Please check back later
        </div>
      </div>

      <style>{`
        @keyframes pems-spin { to { transform: rotate(360deg); } }
        @keyframes pems-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
