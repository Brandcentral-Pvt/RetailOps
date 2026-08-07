import React, { useEffect, useState, useCallback } from 'react';

const LOGO_SOURCES = [
  import.meta.env.VITE_MAINTENANCE_LOGO,
  '/brandcentral-logo.png',
  'https://brandcentral.in/wp-content/uploads/2024/09/logo.png',
].filter(Boolean);

const TITLE =
  import.meta.env.VITE_MAINTENANCE_TITLE ||
  'We\'re Experiencing Unusually High Traffic';
const MESSAGE =
  import.meta.env.VITE_MAINTENANCE_MESSAGE ||
  'We are currently experiencing unusually high request volumes, which has temporarily affected system availability. Our engineering team is actively working to stabilize the platform and restore normal service as quickly as possible. Please try again shortly or visit the status page for live updates.';
const ETA = (import.meta.env.VITE_MAINTENANCE_ETA || '').trim();
const STATUS_PAGE =
  import.meta.env.VITE_STATUS_PAGE || 'https://data.brandcentral.in';
const SUPPORT_EMAIL =
  import.meta.env.VITE_MAINTENANCE_EMAIL || 'developer@brandcentral.in';

function BrandLogo() {
  const [idx, setIdx] = useState(0);
  if (idx >= LOGO_SOURCES.length) return null;
  return (
    <img
      src={LOGO_SOURCES[idx]}
      alt="BrandCentral"
      onError={() => setIdx((i) => i + 1)}
      style={{ height: 32, maxWidth: 180, objectFit: 'contain' }}
    />
  );
}

function PulsingDot({ size = 8, color = '#ef4444' }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        animation: 'bc-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        flexShrink: 0,
      }}
    />
  );
}

function TrafficIcon() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 88,
        height: 88,
        borderRadius: 28,
        background: 'linear-gradient(145deg, #fef2f2, #fee2e2)',
        border: '1px solid #fecaca',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* Outer ring animation */}
      <div
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: 34,
          border: '2px solid rgba(239, 68, 68, 0.12)',
          animation: 'bc-ring-pulse 3s ease-in-out infinite',
        }}
      />
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#dc2626"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Server/traffic icon */}
        <rect x="2" y="2" width="20" height="6" rx="2" />
        <rect x="2" y="10" width="20" height="6" rx="2" />
        <line x1="6" y1="5" x2="6.01" y2="5" strokeWidth="2.5" />
        <line x1="6" y1="13" x2="6.01" y2="13" strokeWidth="2.5" />
        <path d="M10 22l2-4 2 4" />
        <line x1="12" y1="18" x2="12" y2="16" />
        {/* Activity lines */}
        <line x1="10" y1="5" x2="18" y2="5" opacity="0.5" />
        <line x1="10" y1="13" x2="16" y2="13" opacity="0.5" />
      </svg>
    </div>
  );
}

function ProgressBar() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(72), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 220,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#f1f5f9',
        overflow: 'hidden',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 2,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          width: `${width}%`,
          transition: 'width 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
        }}
      />
    </div>
  );
}

function LiveClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatTime(currentTime)}
    </span>
  );
}

export default function UnderMaintenance() {
  const [isHoveringRefresh, setIsHoveringRefresh] = useState(false);
  const [isHoveringStatus, setIsHoveringStatus] = useState(false);
  const [isHoveringEmail, setIsHoveringEmail] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = 'System Unavailable · BrandCentral';
    return () => {
      document.title = prev;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        @keyframes bc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }

        @keyframes bc-ring-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.06); }
        }

        @keyframes bc-fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bc-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bc-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes bc-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes bc-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .bc-maintenance-root * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .bc-main-card {
          animation: bc-slide-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .bc-nav-fade {
          animation: bc-fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }

        .bc-footer-fade {
          animation: bc-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both;
        }

        .bc-icon-float {
          animation: bc-float 5s ease-in-out infinite;
        }

        .bc-btn-primary:focus-visible,
        .bc-btn-secondary:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .bc-link-hover:hover {
          text-decoration: underline !important;
        }

        @media (max-width: 480px) {
          .bc-card-inner {
            padding: 36px 24px 32px !important;
          }
          .bc-nav-bar {
            padding: 12px 16px !important;
          }
          .bc-title {
            font-size: 22px !important;
          }
          .bc-message {
            font-size: 14px !important;
          }
          .bc-btn-group {
            flex-direction: column !important;
          }
          .bc-btn-group > * {
            width: 100% !important;
            justify-content: center !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bc-main-card,
          .bc-nav-fade,
          .bc-footer-fade {
            animation: none !important;
            opacity: 1 !important;
          }
          .bc-icon-float {
            animation: none !important;
          }
          * {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div
        className="bc-maintenance-root"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px 40px',
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: '#475569',
          textAlign: 'center',
          background: '#f8fafc',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decorations */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59, 130, 246, 0.04), transparent),
              radial-gradient(ellipse 60% 40% at 85% 100%, rgba(139, 92, 246, 0.03), transparent),
              radial-gradient(ellipse 40% 30% at 10% 60%, rgba(236, 72, 153, 0.02), transparent)
            `,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.015) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        {/* Fixed top navigation bar */}
        <nav
          className="bc-nav-fade bc-nav-bar"
          role="banner"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 28px',
            zIndex: 100,
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            backgroundColor: 'rgba(248, 250, 252, 0.85)',
          }}
        >
          <BrandLogo />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
            }}
          >
            <PulsingDot size={7} color="#ef4444" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#dc2626',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Elevated Traffic
            </span>
          </div>
        </nav>

        {/* Main card */}
        <main
          className="bc-main-card bc-card-inner"
          role="main"
          aria-labelledby="maintenance-title"
          aria-describedby="maintenance-message"
          style={{
            width: '100%',
            maxWidth: 540,
            padding: '52px 44px 44px',
            borderRadius: 24,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow:
              '0 0 0 1px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.03), 0 8px 16px rgba(0,0,0,0.04), 0 24px 48px rgba(0,0,0,0.06)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Subtle top accent line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 32,
              right: 32,
              height: 3,
              borderRadius: '0 0 4px 4px',
              background:
                'linear-gradient(90deg, #ef4444, #f97316, #ef4444)',
              backgroundSize: '200% 100%',
              animation: 'bc-gradient-shift 4s ease infinite',
              opacity: 0.8,
            }}
          />

          {/* Icon */}
          <div className="bc-icon-float" style={{ marginBottom: 28 }}>
            <TrafficIcon />
          </div>

          {/* Status badge */}
          <div
            role="status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              marginBottom: 24,
            }}
          >
            <PulsingDot size={6} color="#ef4444" />
            Elevated Request Volume
          </div>

          {/* Title */}
          <h1
            id="maintenance-title"
            className="bc-title"
            style={{
              margin: '0 0 14px',
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.25,
              color: '#0f172a',
            }}
          >
            {TITLE}
          </h1>

          {/* Message */}
          <p
            id="maintenance-message"
            className="bc-message"
            style={{
              margin: '0 auto 28px',
              fontSize: 15,
              lineHeight: 1.75,
              color: '#64748b',
              maxWidth: 420,
            }}
          >
            {MESSAGE}
          </p>

          {/* Progress section */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: 16,
              backgroundColor: '#f8fafc',
              border: '1px solid #f1f5f9',
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  animation: 'bc-pulse 1.5s ease infinite',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#3b82f6',
                  letterSpacing: '0.03em',
                }}
              >
                Service Restoration in Progress
              </span>
            </div>
            <ProgressBar />
            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                fontWeight: 500,
                color: '#94a3b8',
                letterSpacing: '0.01em',
              }}
            >
              Our team is actively working to stabilize services
            </p>
          </div>

          {/* ETA */}
          {ETA && (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 20px',
                borderRadius: 14,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                marginBottom: 28,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d97706"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
              </svg>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#92400e',
                }}
              >
                Estimated restoration: {ETA}
              </span>
            </div>
          )}

          {/* Divider */}
          <div
            style={{
              width: '100%',
              height: 1,
              background:
                'linear-gradient(90deg, transparent, #e5e7eb, transparent)',
              marginBottom: 28,
            }}
          />

          {/* Action buttons */}
          <div
            className="bc-btn-group"
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh this page"
              className="bc-btn-primary"
              onMouseEnter={() => setIsHoveringRefresh(true)}
              onMouseLeave={() => setIsHoveringRefresh(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 30px',
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#fff',
                background: isHoveringRefresh
                  ? 'linear-gradient(135deg, #1d4ed8, #1e40af)'
                  : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: isHoveringRefresh
                  ? '0 10px 28px rgba(37,99,235,0.35), 0 0 0 3px rgba(37,99,235,0.08)'
                  : '0 4px 14px rgba(37,99,235,0.2)',
                transform: isHoveringRefresh
                  ? 'translateY(-2px)'
                  : 'translateY(0)',
                transition:
                  'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23,4 23,10 17,10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Try Again
            </button>
            <a
              href={STATUS_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open system status page"
              className="bc-btn-secondary"
              onMouseEnter={() => setIsHoveringStatus(true)}
              onMouseLeave={() => setIsHoveringStatus(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 30px',
                borderRadius: 14,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#1e293b',
                textDecoration: 'none',
                backgroundColor: isHoveringStatus
                  ? '#f1f5f9'
                  : '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: isHoveringStatus
                  ? '0 6px 16px rgba(0,0,0,0.07), 0 0 0 3px rgba(59,130,246,0.06)'
                  : '0 1px 4px rgba(0,0,0,0.04)',
                transform: isHoveringStatus
                  ? 'translateY(-2px)'
                  : 'translateY(0)',
                transition:
                  'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              System Status
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.4 }}
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7,7 17,7 17,17" />
              </svg>
            </a>
          </div>

          {/* Quick links row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              aria-label={`Email ${SUPPORT_EMAIL}`}
              className="bc-link-hover"
              onMouseEnter={() => setIsHoveringEmail(true)}
              onMouseLeave={() => setIsHoveringEmail(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                color: isHoveringEmail ? '#2563eb' : '#64748b',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Contact Support
            </a>
            <span
              style={{
                width: 1,
                height: 14,
                backgroundColor: '#e2e8f0',
                flexShrink: 0,
              }}
            />
            <a
              href={STATUS_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="bc-link-hover"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                color: '#64748b',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Live Status
            </a>
          </div>
        </main>

        {/* Footer */}
        <footer
          className="bc-footer-fade"
          role="contentinfo"
          style={{
            marginTop: 36,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#94a3b8',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.6 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            <span>
              Last checked: <LiveClock />
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#cbd5e1',
              letterSpacing: '0.01em',
            }}
          >
            &copy; {new Date().getFullYear()} BrandCentral &middot; All
            rights reserved
          </div>
        </footer>
      </div>
    </>
  );
}