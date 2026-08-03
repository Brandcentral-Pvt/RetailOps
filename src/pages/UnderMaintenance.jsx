<<<<<<< HEAD
import React, { useEffect } from 'react';
=======
import React, { useEffect, useState } from 'react';
>>>>>>> 17b09baabb760bd50af401783fcec59049a38d03

const LOGO_SOURCES = [
  import.meta.env.VITE_MAINTENANCE_LOGO,
  '/brandcentral-logo.png',
  'https://brandcentral.in/wp-content/uploads/2024/09/logo.png',
].filter(Boolean);

const TITLE = import.meta.env.VITE_MAINTENANCE_TITLE || "We're upgrading BrandCentral";
const MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE || 'Scheduled maintenance in progress. We\'ll be back shortly.';
const ETA = (import.meta.env.VITE_MAINTENANCE_ETA || '30 Minutes').trim();
const STATUS_PAGE = import.meta.env.VITE_STATUS_PAGE || 'https://status.brandcentral.in';
const SUPPORT_EMAIL = import.meta.env.VITE_MAINTENANCE_EMAIL || 'support@brandcentral.in';

const FONT = "var(--bc-font-sans, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)";

// "We're |restocking| the shelves." → pre="We're", accent="restocking", post="the shelves."
const [TITLE_PRE, TITLE_ACCENT, TITLE_POST] = (() => {
  const parts = TITLE.split('|').map(s => s.trim());
  return [parts[0] || '', parts[1] || '', parts[2] || ''];
})();

function BrandLogo() {
  const [idx, setIdx] = useState(0);
  if (idx >= LOGO_SOURCES.length) return null;
  return (
    <img
      src={LOGO_SOURCES[idx]}
      alt="BrandCentral"
      onError={() => setIdx(i => i + 1)}
      style={{ height: 36, maxWidth: 200, objectFit: 'contain' }}
    />
  );
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
    document.title = 'Under Maintenance · BrandCentral';
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 34,
      padding: 40,
      fontFamily: FONT,
      color: '#475569',
      textAlign: 'center',
      background: 'linear-gradient(180deg, #f8fafc, #eef2f7)',
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
          {TITLE_PRE}{TITLE_ACCENT ? ' ' : ''}
          {TITLE_ACCENT && (
            <em style={{ fontStyle: 'italic', fontWeight: 600, color: '#2563eb' }}>{TITLE_ACCENT}</em>
          )}{TITLE_POST ? ' ' : ''}{TITLE_POST}
        </h1>

        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          {MESSAGE}
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
    </div>
  );
}
