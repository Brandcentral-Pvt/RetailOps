import React from 'react';
import { Typography, Button, Empty } from 'antd';
import { CoffeeOutlined, AuditOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { formatDuration, FRIENDLY_STATUS } from '../../utils/dayPlanner';
import { accentFor } from './myDayTheme';

const { Text } = Typography;
const hm = (ms) => dayjs(ms).format('h:mm A');

function TaskSlot({ slot, isNext, onOpen }) {
  const t = slot.entry.task;
  return (
    <div className={`md-slot__card${isNext ? ' is-next' : ''}`} style={{ '--md-accent': accentFor(t) }}
      onClick={() => onOpen(t.Id)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t.Id); }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 14, color: 'var(--bc-text-heading, #0f172a)' }} ellipsis>{t.Title || t.TemplateName}</Text>
        <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)', flexShrink: 0 }}>{formatDuration(slot.minutes)}{slot.part ? ` · part ${slot.part}/${slot.of}` : ''}</Text>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
        {slot.entry.reasons.filter(r => r.tone !== 'auto').slice(0, 3).map(r => <span key={r.text} className={`md-reason ${r.tone}`}>{r.text}</span>)}
        {t.Source === 'RULESET' && <span className="md-reason auto"><ThunderboltOutlined /> Automation</span>}
        <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>{FRIENDLY_STATUS[t.Status]}{t.SellerName ? ` · ${t.SellerName}` : ''}</Text>
      </div>
    </div>
  );
}

/**
 * Agenda view of the plan. `nextKey` highlights the slot shown in the Up Next card.
 */
export default function DayTimeline({ plan, now, nextKey, onOpen }) {
  const navigate = useNavigate();
  const { slots, overflow, isTomorrow } = plan;
  const inDay = !isTomorrow && now >= plan.workday.start && now < plan.workday.end;
  const visible = slots.filter(s => s.type !== 'break' || slots.some(x => x.type !== 'break' && x.start >= s.end));

  if (!visible.some(s => s.type !== 'break')) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing is scheduled" />;
  }

  return (
    <div>
      {inDay && <div className="md-now">NOW · {dayjs(now).format('h:mm A')}</div>}
      {isTomorrow && <div className="md-note info" style={{ marginBottom: 12 }}>Working hours are over — this is your plan for <b>tomorrow morning</b>.</div>}
      {visible.map(s => (
        <div className="md-slot" key={`${s.key}-${s.start}`} style={{ '--md-accent': s.type === 'review' ? '#7B1FA2' : s.type === 'break' ? '#cbd5e1' : accentFor(s.entry?.task) }}>
          <div className="md-slot__time">{hm(s.start)}<small>{s.type === 'break' ? '' : `→ ${hm(s.end)}`}</small></div>
          <div className="md-slot__rail"><span className="md-slot__dot" /></div>
          {s.type === 'break' ? (
            <div className="md-slot__card break"><CoffeeOutlined /> {s.label} · {formatDuration(s.minutes)}</div>
          ) : s.type === 'review' ? (
            <div className="md-slot__card" style={{ '--md-accent': '#7B1FA2' }} onClick={() => navigate('/tasks/reviews')} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate('/tasks/reviews'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <Text strong style={{ fontSize: 14 }}><AuditOutlined style={{ color: '#7B1FA2' }} /> Review block</Text>
                <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>{formatDuration(s.minutes)}</Text>
              </div>
              <Text style={{ fontSize: 12, color: 'var(--bc-text-muted, #64748b)' }}>{s.count} task{s.count > 1 ? 's' : ''} waiting for your review — clear them so teammates aren't blocked.</Text>
            </div>
          ) : (
            <TaskSlot slot={s} isNext={s.key === nextKey} onOpen={onOpen} />
          )}
        </div>
      ))}

      {overflow.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="md-card__title" style={{ marginBottom: 6, color: '#b45309' }}><span><WarningOutlined /> Won't fit in today's hours</span><span>{overflow.length}</span></div>
          {overflow.filter(o => o.type === 'task').map(o => {
            const t = o.entry.task;
            const must = o.entry.bucket === 'MUST';
            return (
              <div key={o.key} className="md-mini" onClick={() => onOpen(t.Id)}>
                <span className="md-dot" style={{ background: accentFor(t) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="md-mini__title">{t.Title || t.TemplateName}</div>
                  <Text style={{ fontSize: 11, color: must ? '#b91c1c' : 'var(--bc-text-muted, #94a3b8)' }}>{must ? 'Must-do with no time left — ask for help or renegotiate the deadline' : 'Nice-to-have — slips to tomorrow'} · {formatDuration(o.minutes)}</Text>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
