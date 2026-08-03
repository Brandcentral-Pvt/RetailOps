/**
 * UnderMaintenance — "Closed for Restock" edition.
 * A cinematic, dark luxury-storefront maintenance screen:
 *   • aurora background with drifting light blobs + fine grain + grid
 *   • glass status console with a LIVE system checklist (self-cycling)
 *   • shimmer restock-progress bar, ETA chip, support footer
 *   • mouse parallax + full prefers-reduced-motion support
 *
 * Rendered directly (no router / providers) when VITE_MAINTENANCE_MODE=true.
 *
 * Env overrides:
 *   VITE_MAINTENANCE_TITLE    "Line one |accent phrase| line three"  (pipe = accent)
 *   VITE_MAINTENANCE_MESSAGE  body copy
 *   VITE_MAINTENANCE_ETA      "30 minutes" etc. (shown as 'Back online · …')
 */
import React, { useEffect, useRef, useState } from 'react';

const TITLE = import.meta.env.VITE_MAINTENANCE_TITLE || "We're |restocking| the shelves.";
const MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE || 'We are performing scheduled maintenance. Our team is working hard to get everything back online shortly.';
const ETA = import.meta.env.VITE_MAINTENANCE_ETA || '';
const SUPPORT_EMAIL = import.meta.env.VITE_MAINTENANCE_EMAIL || 'support@retailops.in';

const [TITLE_PRE, TITLE_ACCENT, TITLE_POST] = (() => {
  const parts = TITLE.split('|').map(s => s.trim());
  return [parts[0] || '', parts[1] || '', parts[2] || ''];
})();

const CHECKLIST = ['Core API', 'Database pools', 'Pricing engine', 'Cache warming'];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/** Self-cycling checklist: fills 0→N, holds 4 s, resets (respects reduced motion). */
function useChecklistCycle(items, reduced) {
  const [done, setDone] = useState(reduced ? items.length : 0);
  useEffect(() => {
    if (reduced) return undefined;
    let i = 0;
    let interval = null;
    let holdTimer = null;
    const start = () => { interval = setInterval(tick, 700); };
    const tick = () => {
      i += 1;
      if (i >= items.length) {
        setDone(items.length);
        clearInterval(interval);
        holdTimer = setTimeout(() => { i = 0; setDone(0); start(); }, 4000);
        return;
      }
      setDone(i);
    };
    start();
    return () => { clearInterval(interval); clearTimeout(holdTimer); };
  }, [items.length, reduced]);
  return done;
}

export default function UnderMaintenance() {
  const reduced = useReducedMotion();
  const done = useChecklistCycle(CHECKLIST, reduced);
  const bgRef = useRef(null);
  const [progressPct] = useState(reduced ? 100 : 84);

  // Gentle mouse parallax on the aurora layer
  const handleMouseMove = (e) => {
    if (reduced || !bgRef.current) return;
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 2;   // -1..1
    const y = (e.clientY / innerHeight - 0.5) * 2;
    bgRef.current.style.setProperty('--um-x', x.toFixed(3));
    bgRef.current.style.setProperty('--um-y', y.toFixed(3));
  };

  return (
    <div
      className="um-root"
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: 'var(--bc-font-sans, Inter, -apple-system, sans-serif)',
        background: 'radial-gradient(1200px 800px at 70% -10%, #1c2a4d 0%, #0b1220 55%)',
        backgroundColor: '#0b1220',
        color: '#e2e8f0',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── Aurora layer (parallax) ── */}
      <div ref={bgRef} className="um-aurora" aria-hidden="true" style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        '--um-x': 0, '--um-y': 0,
      }}>
        <div className="um-blob um-blob-1" style={{
          position: 'absolute', width: 640, height: 640, left: '-8%', top: '-18%',
          borderRadius: '50%', filter: 'blur(90px)', opacity: 0.4,
          background: 'radial-gradient(circle at 30% 30%, rgba(99,102,241,0.55), transparent 65%)',
          transform: 'translate(calc(var(--um-x) * -28px), calc(var(--um-y) * -20px))',
        }} />
        <div className="um-blob um-blob-2" style={{
          position: 'absolute', width: 560, height: 560, right: '-6%', top: '10%',
          borderRadius: '50%', filter: 'blur(100px)', opacity: 0.32,
          background: 'radial-gradient(circle at 60% 40%, rgba(6,182,212,0.5), transparent 65%)',
          transform: 'translate(calc(var(--um-x) * 24px), calc(var(--um-y) * 18px))',
        }} />
        <div className="um-blob um-blob-3" style={{
          position: 'absolute', width: 520, height: 520, left: '30%', bottom: '-25%',
          borderRadius: '50%', filter: 'blur(110px)', opacity: 0.26,
          background: 'radial-gradient(circle at 50% 50%, rgba(167,139,250,0.5), transparent 65%)',
          transform: 'translate(calc(var(--um-x) * -18px), calc(var(--um-y) * 26px))',
        }} />
        {/* dotted grid, faded at edges */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(148,163,184,0.14) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
          opacity: 0.5,
        }} />
        {/* film grain */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'160\' height=\'160\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }} />
      </div>

      {/* ── Content ── */}
      <div style={{
        position: 'relative', zIndex: 2, width: '100%', maxWidth: 720, textAlign: 'center',
      }}>
        {/* Emblem: glass tile + rotating rings */}
        <div className="um-emblem" style={{
          position: 'relative', width: 84, height: 84, margin: '0 auto 30px',
        }}>
          <span className="um-ring um-ring-outer" style={{
            position: 'absolute', inset: -14, borderRadius: '50%',
            border: '1px dashed rgba(148,163,184,0.28)',
          }} />
          <span className="um-ring um-ring-inner" style={{
            position: 'absolute', inset: -7, borderRadius: '50%',
            border: '1px dashed rgba(148,163,184,0.18)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 12px 32px rgba(2,6,23,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--bc-font-display, "DM Sans", Inter, sans-serif)',
              fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #e2e8f0, #93c5fd)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>RO</span>
          </div>
        </div>

        {/* Status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          padding: '7px 18px', borderRadius: '9999px',
          background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)',
          marginBottom: 26,
        }}>
          <span className="um-dot" style={{
            width: 7, height: 7, borderRadius: '50%', background: '#fbbf24',
            boxShadow: '0 0 0 0 rgba(251,191,36,0.6)',
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: '#fcd34d',
          }}>Closed for maintenance</span>
        </div>

        {/* Headline with serif-italic accent */}
        <h1 style={{
          margin: 0,
          fontFamily: 'var(--bc-font-display, "DM Sans", Inter, sans-serif)',
          fontSize: 'clamp(40px, 7vw, 68px)',
          fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.04,
          color: '#f8fafc',
        }}>
          {TITLE_PRE}{' '}
          {TITLE_ACCENT && (
            <em style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic', fontWeight: 500, letterSpacing: '-0.01em',
              background: 'linear-gradient(100deg, #93c5fd 0%, #c4b5fd 45%, #f0abfc 90%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              paddingRight: '0.08em',
            }}>{TITLE_ACCENT}</em>
          )}{' '}
          {TITLE_POST}
        </h1>

        {/* Message */}
        <p style={{
          margin: '18px auto 0', maxWidth: 470,
          fontSize: 15, lineHeight: 1.75, color: '#94a3b8',
        }}>{MESSAGE}</p>

        {/* Live status console */}
        <div style={{
          maxWidth: 460, margin: '34px auto 0', textAlign: 'left',
          borderRadius: 18,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 18px 44px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
          padding: '18px 20px 14px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase',
              color: '#64748b',
            }}>System status</span>
            <span className="um-live" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#67e8f9', fontFamily: 'var(--bc-font-mono, monospace)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#67e8f9' }} />live
            </span>
          </div>

          {CHECKLIST.map((label, i) => {
            const state = i < done ? 'ok' : i === done ? 'working' : 'pending';
            return (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 2px', borderBottom: i < CHECKLIST.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                opacity: state === 'pending' ? 0.45 : 1,
                transition: 'opacity 0.4s ease',
              }}>
                <span style={{ fontSize: 13, color: state === 'pending' ? '#64748b' : '#cbd5e1', fontWeight: 500 }}>
                  {label}
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontFamily: 'var(--bc-font-mono, monospace)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>
                  {state === 'ok' && (
                    <>
                      <span style={{ color: '#34d399' }}>synced</span>
                      <span style={{ color: '#34d399', fontSize: 12 }}>✓</span>
                    </>
                  )}
                  {state === 'working' && (
                    <>
                      <span className="um-spin" style={{ color: '#67e8f9', display: 'inline-block' }}>⟳</span>
                      <span style={{ color: '#67e8f9' }}>working</span>
                    </>
                  )}
                  {state === 'pending' && (
                    <span style={{ color: '#475569' }}>queued</span>
                  )}
                </span>
              </div>
            );
          })}

          {/* blinking cursor line */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12,
            fontFamily: 'var(--bc-font-mono, monospace)', fontSize: 11, color: '#475569',
          }}>
            <span style={{ color: '#34d399' }}>❯</span>
            <span>maintenance --watch</span>
            <span className="um-cursor" style={{
              width: 7, height: 13, background: '#67e8f9', borderRadius: 1, opacity: 0.9,
            }} />
          </div>
        </div>

        {/* Restock progress */}
        <div style={{ maxWidth: 460, margin: '24px auto 0' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 8,
            fontFamily: 'var(--bc-font-mono, monospace)', fontSize: 10, letterSpacing: '0.16em',
            color: '#64748b', textTransform: 'uppercase',
          }}>
            <span>Restock progress</span>
            <span style={{ color: '#93c5fd' }}>{progressPct}%</span>
          </div>
          <div style={{
            height: 3, borderRadius: '9999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative',
          }}>
            <div className="um-fill" style={{
              position: 'absolute', inset: 0, borderRadius: '9999px',
              background: 'linear-gradient(90deg, #6366f1, #06b6d4, #67e8f9)',
              transformOrigin: 'left',
            }} />
          </div>
        </div>

        {/* ETA chip */}
        <div style={{ marginTop: 26 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '9px 18px', borderRadius: '9999px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
            fontSize: 12.5, color: '#cbd5e1', fontWeight: 500,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {ETA ? <>Back online · <strong style={{ color: '#f8fafc' }}>{ETA}</strong></> : <>Maintenance in progress</>}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 44, paddingTop: 22,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          maxWidth: 460, marginLeft: 'auto', marginRight: 'auto',
          fontFamily: 'var(--bc-font-mono, monospace)', fontSize: 11, color: '#475569',
        }}>
          <span>© {new Date().getFullYear()} RetailOps</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#64748b', textDecoration: 'none', transition: 'color 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      {/* ── Motion ── */}
      <style>{`
        .um-root { --um-x: 0; --um-y: 0; }
        .um-blob { transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1); }

        .um-blob-1 { animation: um-drift-1 26s ease-in-out infinite alternate; }
        .um-blob-2 { animation: um-drift-2 32s ease-in-out infinite alternate; }
        .um-blob-3 { animation: um-drift-3 38s ease-in-out infinite alternate; }

        @keyframes um-drift-1 { from { margin-left: 0; } to { margin-left: 6%; } }
        @keyframes um-drift-2 { from { margin-top: 0; } to { margin-top: 5%; } }
        @keyframes um-drift-3 { from { margin-left: 0; } to { margin-left: -6%; } }

        .um-ring-outer { animation: um-spin 22s linear infinite; }
        .um-ring-inner { animation: um-spin 16s linear infinite reverse; }
        @keyframes um-spin { to { transform: rotate(360deg); } }

        .um-dot { animation: um-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }
        @keyframes um-ping {
          0%   { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
          100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
        }

        .um-spin { animation: um-rotate 1.1s linear infinite; }
        @keyframes um-rotate { to { transform: rotate(360deg); } }

        .um-cursor { animation: um-blink 1.1s steps(2, start) infinite; }
        @keyframes um-blink { to { visibility: hidden; } }

        .um-fill {
          animation: um-fill 9s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both;
          animation-fill-mode: forwards;
        }
        @keyframes um-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(0.84); }
        }

        @media (prefers-reduced-motion: reduce) {
          .um-root *, .um-root *::before, .um-root *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
