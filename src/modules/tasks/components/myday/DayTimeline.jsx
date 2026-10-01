import React from 'react';
import { Typography, Empty } from 'antd';
import { CoffeeOutlined, AuditOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { formatDuration, FRIENDLY_STATUS } from '../../utils/dayPlanner';
import { accentFor, REVIEW_ACCENT, BREAK_ACCENT } from './myDayTheme';

const { Text } = Typography;
const hm = (ms) => dayjs(ms).format('h:mm A');

/** A task slot is a button, not a div, so it is reachable by keyboard. */
function slotKey(handler) {
  return (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } };
}

function TaskSlot({ slot, isNext, onOpen }) {
  const t = slot.entry.task;
  return (
    <div
      className={`md-slot__card${isNext ? ' is-next' : ''}`}
      style={{ '--md-accent': accentFor(t) }}
      onClick={() => onOpen(t.Id)}
      role="button"
      tabIndex={0}
      onKeyDown={slotKey(() => onOpen(t.Id))}
    >
      <div className="md-slot__head">
        <Text strong className="md-slot__title" ellipsis>{t.Title || t.TemplateName}</Text>
        <Text className="md-slot__meta">
          {formatDuration(slot.minutes)}{slot.part ? ` · part ${slot.part}/${slot.of}` : ''}
        </Text>
      </div>
      <div className="md-slot__tags">
        {slot.entry.reasons.filter(r => r.tone !== 'auto').slice(0, 3).map(r => (
          <span key={r.text} className={`md-reason md-reason--${r.tone}`}>{r.text}</span>
        ))}
        {t.Source === 'RULESET' && <span className="md-reason md-reason--auto"><ThunderboltOutlined /> Automation</span>}
        <Text className="md-mini__sub">
          {FRIENDLY_STATUS[t.Status]}{t.SellerName ? ` · ${t.SellerName}` : ''}
        </Text>
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

  const accentForSlot = (s) => (
    s.type === 'review' ? REVIEW_ACCENT : s.type === 'break' ? BREAK_ACCENT : accentFor(s.entry?.task)
  );

  return (
    <div>
      {inDay && <div className="md-now">NOW · {dayjs(now).format('h:mm A')}</div>}
      {isTomorrow && (
        <div className="md-note md-note--info md-note--sm">
          Working hours are over — this is your plan for <b>tomorrow morning</b>.
        </div>
      )}
      {visible.map(s => (
        <div className="md-slot" key={`${s.key}-${s.start}`} style={{ '--md-accent': accentForSlot(s) }}>
          <div className="md-slot__time">
            {hm(s.start)}
            <small>{s.type === 'break' ? '' : `→ ${hm(s.end)}`}</small>
          </div>
          <div className="md-slot__rail"><span className="md-slot__dot" /></div>
          {s.type === 'break' ? (
            <div className="md-slot__card break"><CoffeeOutlined /> {s.label} · {formatDuration(s.minutes)}</div>
          ) : s.type === 'review' ? (
            <div
              className="md-slot__card review"
              style={{ '--md-accent': REVIEW_ACCENT }}
              onClick={() => navigate('/tasks/reviews')}
              role="button"
              tabIndex={0}
              onKeyDown={slotKey(() => navigate('/tasks/reviews'))}
            >
              <div className="md-slot__head">
                <Text strong className="md-slot__review-title"><AuditOutlined /> Review block</Text>
                <Text className="md-slot__meta">{formatDuration(s.minutes)}</Text>
              </div>
              <Text className="md-slot__tags">
                {s.count} task{s.count > 1 ? 's' : ''} waiting for your review — clear them so teammates aren&rsquo;t blocked.
              </Text>
            </div>
          ) : (
            <TaskSlot slot={s} isNext={s.key === nextKey} onOpen={onOpen} />
          )}
        </div>
      ))}

      {overflow.length > 0 && (
        <div className="md-overflow">
          <div className="md-card__title md-overflow__title">
            <span><WarningOutlined /> Won&rsquo;t fit in today&rsquo;s hours</span>
            <span>{overflow.length}</span>
          </div>
          {overflow.filter(o => o.type === 'task').map(o => {
            const t = o.entry.task;
            const must = o.entry.bucket === 'MUST';
            return (
              <div key={o.key} className="md-mini" onClick={() => onOpen(t.Id)}>
                <span className="md-dot" style={{ '--dot': accentFor(t) }} />
                <div className="md-mini__body">
                  <div className="md-mini__title">{t.Title || t.TemplateName}</div>
                  <Text className={must ? 'md-mini__sub md-mini__sub--must' : 'md-mini__sub'}>
                    {must ? 'Must-do with no time left — ask for help or renegotiate the deadline' : 'Nice-to-have — slips to tomorrow'}
                    {' · '}{formatDuration(o.minutes)}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}