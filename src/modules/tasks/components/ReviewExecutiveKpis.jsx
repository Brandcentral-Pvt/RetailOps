import React from 'react';
import { Skeleton } from 'antd';
import {
  InboxOutlined, AlertOutlined, WarningOutlined, CalendarOutlined,
  FieldTimeOutlined, SafetyCertificateOutlined, RollbackOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
} from '@ant-design/icons';

/** minutes → "45m" / "3.2h" / "1.4d"  (null → "—") */
export function formatMinutes(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return '—';
  if (min < 60) return `${Math.max(0, Math.round(min))}m`;
  if (min < 60 * 24) return `${(min / 60).toFixed(1).replace(/\.0$/, '')}h`;
  return `${(min / 1440).toFixed(1).replace(/\.0$/, '')}d`;
}

/**
 * Trend chip. `goodWhen` = 'up' | 'down' decides which direction is green.
 * value === null → no prior-period data, so nothing is shown (never fabricated).
 */
function Trend({ value, unit, goodWhen }) {
  if (value === null || value === undefined) return null;
  if (value === 0) return <span className="rv-trend flat"><MinusOutlined style={{ fontSize: 9 }} /> 0{unit}</span>;
  const up = value > 0;
  const good = goodWhen === 'up' ? up : !up;
  return (
    <span className={`rv-trend ${good ? 'good' : 'bad'}`}>
      {up ? <ArrowUpOutlined style={{ fontSize: 9 }} /> : <ArrowDownOutlined style={{ fontSize: 9 }} />}
      {Math.abs(value)}{unit}
    </span>
  );
}

function Kpi({ label, value, color, icon, sub, trend, onClick, active }) {
  const Icon = icon;
  return (
    <div
      className={`rv-kpi${onClick ? ' clickable' : ''}${active ? ' active' : ''}`}
      style={{ '--rv-accent': color }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <span className="rv-kpi__icon" style={{ background: `${color}14`, color }}><Icon /></span>
      <div>
        <div className="rv-kpi__label">{label}</div>
        <div className="rv-kpi__value">{value}</div>
      </div>
      <div className="rv-kpi__sub">{sub}{trend}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, ${color}B3, ${color}14)` }} />
    </div>
  );
}

/**
 * Review KPI strip.
 *  counts  – live queue counts (from the queue API, so they always match the list)
 *  stats   – /pems/reviews/stats (30-day performance + week-over-week trends)
 *  Queue cards filter the list when clicked; performance cards are informational.
 */
export function ReviewExecutiveKpis({ counts = {}, stats, loading, activeView, onSelectView }) {
  if (loading && !stats && counts.ALL === undefined) {
    return <div className="rv-kpi-grid">{[0, 1, 2, 3, 4, 5, 6].map(i => <div key={i} className="rv-kpi"><Skeleton active paragraph={{ rows: 1 }} title={false} /></div>)}</div>;
  }
  const w = stats?.window30 || {};
  const t = stats?.trends || {};
  const teamLabel = stats?.scope === 'mine' ? 'your reviews' : 'team';
  const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
  const noData = <span>No reviews in 30d</span>;

  return (
    <div className="rv-kpi-grid">
      <Kpi label="Awaiting review" value={counts.ALL ?? '—'} color="#1976D2" icon={InboxOutlined}
        sub={<span>{counts.RESUBMITTED ? `${counts.RESUBMITTED} resubmitted` : 'Submitted + under review'}</span>}
        onClick={() => onSelectView('ALL')} active={activeView === 'ALL'} />
      <Kpi label="Critical" value={counts.CRITICAL ?? '—'} color="#D32F2F" icon={AlertOutlined}
        sub={<span>Priority = critical</span>} onClick={() => onSelectView('CRITICAL')} active={activeView === 'CRITICAL'} />
      <Kpi label="Overdue" value={counts.OVERDUE ?? '—'} color="#E65100" icon={WarningOutlined}
        sub={<span>Past due date</span>} onClick={() => onSelectView('OVERDUE')} active={activeView === 'OVERDUE'} />
      <Kpi label="Due today" value={counts.DUE_TODAY ?? '—'} color="#ED6C02" icon={CalendarOutlined}
        sub={<span>Due before midnight</span>} onClick={() => onSelectView('DUE_TODAY')} active={activeView === 'DUE_TODAY'} />
      <Kpi label="Avg turnaround" value={formatMinutes(w.avgTurnaroundMin)} color="#7B1FA2" icon={FieldTimeOutlined}
        sub={w.decided ? <span>Submit → decision · 30d</span> : noData}
        trend={<Trend value={t.avgTurnaroundPct} unit="%" goodWhen="down" />} />
      <Kpi label="On-time approvals" value={pct(w.slaCompliance)} color="#2E7D32" icon={SafetyCertificateOutlined}
        sub={w.decided ? <span>Approved by due date · {teamLabel}</span> : noData}
        trend={<Trend value={t.slaCompliancePts} unit=" pts" goodWhen="up" />} />
      <Kpi label="Sent-back rate" value={pct(w.reworkRate)} color="#C2410C" icon={RollbackOutlined}
        sub={w.decided ? <span>{w.rejected}/{w.decided} reviews · 30d</span> : noData}
        trend={<Trend value={t.reworkRatePts} unit=" pts" goodWhen="down" />} />
    </div>
  );
}

export default ReviewExecutiveKpis;
