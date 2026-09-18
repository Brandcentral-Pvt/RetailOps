import React from 'react';

export const CorpCard = ({ title, subtitle, extra, children, footer, bodyClassName = '', className = '' }) => (
  <section className={`corp-card ${className}`}>
    {(title || extra) && (
      <header className="corp-card__head">
        <div style={{ minWidth: 0 }}>
          {title && <div className="corp-card__title">{title}</div>}
          {subtitle && <div className="corp-card__sub">{subtitle}</div>}
        </div>
        {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
      </header>
    )}
    <div className={`corp-card__body ${bodyClassName}`}>{children}</div>
    {footer && <footer className="corp-card__foot">{footer}</footer>}
  </section>
);

export const CorpMetric = ({ label, value, hint, delta, icon, spark, sparkColor = 'var(--corp-primary)' }) => {
  let deltaClass = 'corp-metric__delta--flat';
  let deltaText = null;
  if (delta) {
    if (delta.tone === 'up') deltaClass = 'corp-metric__delta--up';
    else if (delta.tone === 'down') deltaClass = 'corp-metric__delta--down';
    deltaText = delta.text;
  }
  return (
    <div className="corp-metric">
      <div className="corp-metric__label">
        <span>{label}</span>
        {icon}
      </div>
      <div className="corp-metric__value-row">
        <div className="corp-metric__value">{value}</div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      {deltaText && <div><span className={`corp-metric__delta ${deltaClass}`}>{deltaText}</span></div>}
      {hint && <div className="corp-metric__foot">{hint}</div>}
    </div>
  );
};

export const Sparkline = ({ data = [], color = 'var(--corp-primary)', width = 78, height = 26 }) => {
  const vals = (Array.isArray(data) ? data : []).map(Number).filter((v) => !isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const step = width / (vals.length - 1);
  const pts = vals
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / range) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <polygon points={`${pts} ${width},${height} 0,${height}`} stroke="none" fill={color} opacity={0.09} />
      <polyline points={pts} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const CorpChip = ({ children, tone = 'neutral', soft = true, dot = false }) => (
  <span className={`corp-chip ${soft ? `corp-chip--${tone}` : ''}`}>
    {dot && <span className="corp-chip__dot" />}
    {children}
  </span>
);

export const CorpMeter = ({ value = 0, tone = '' }) => (
  <div className={`corp-meter ${tone ? `corp-meter--${tone}` : ''}`}>
    <div className="corp-meter__fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

export const CorpEmpty = ({ title = 'No data yet', subtitle = 'Nothing to display for this period.' }) => (
  <div className="corp-empty">
    <div className="corp-empty__title">{title}</div>
    {subtitle && <div className="corp-empty__sub">{subtitle}</div>}
  </div>
);

export const CorpSel = ({ value, onChange, options, labelKey = 'name', valueKey = 'id', allLabel = null, style }) => (
  <select className="corp-select" value={value} onChange={(e) => onChange(e.target.value)} style={style}>
    {allLabel !== null && <option value="all">{allLabel}</option>}
    {options.map((o, i) => (
      <option key={o[valueKey] ?? i} value={o[valueKey]}>{o[labelKey]}</option>
    ))}
  </select>
);

export const CorpStat = ({ label, value, pct, swatch }) => (
  <div className="corp-legend__row">
    {swatch && <span className="corp-legend__swatch" style={{ background: swatch }} />}
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    <span className="corp-legend__val">{value}</span>
    {pct !== undefined && <span className="corp-legend__pct">{pct}%</span>}
  </div>
);