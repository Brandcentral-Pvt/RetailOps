import React, { useState } from 'react';
import { Button, Popover, TimePicker, Switch, Typography } from 'antd';
import { SettingOutlined, InfoCircleOutlined, AuditOutlined, RightOutlined, CheckCircleFilled, HourglassOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DEFAULT_WORKDAY, formatDuration, FRIENDLY_STATUS } from '../../utils/dayPlanner';
import { accentFor } from './myDayTheme';

const { Text } = Typography;

/** Working-hours popover. Stored per browser; the plan re-flows immediately. */
export function WorkdaySettings({ workday, onChange }) {
  const [open, setOpen] = useState(false);
  const lunch = workday.breaks?.[0];
  const t = (hm) => dayjs(`2000-01-01 ${hm}`);
  const set = (patch) => onChange({ ...workday, ...patch });
  const setLunch = (patch) => set({ breaks: [{ label: 'Lunch', ...(lunch || DEFAULT_WORKDAY.breaks[0]), ...patch }] });
  const field = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0' };

  return (
    <Popover
      open={open} onOpenChange={setOpen} trigger="click" placement="bottomRight" title="Your working hours"
      content={(
        <div style={{ width: 260 }}>
          <div style={field}><Text>Start</Text><TimePicker format="HH:mm" minuteStep={15} allowClear={false} value={t(workday.start)} onChange={(v) => v && set({ start: v.format('HH:mm') })} /></div>
          <div style={field}><Text>End</Text><TimePicker format="HH:mm" minuteStep={15} allowClear={false} value={t(workday.end)} onChange={(v) => v && set({ end: v.format('HH:mm') })} /></div>
          <div style={field}><Text>Lunch break</Text><Switch checked={!!lunch} onChange={(on) => set({ breaks: on ? DEFAULT_WORKDAY.breaks : [] })} /></div>
          {lunch && (
            <div style={field}>
              <TimePicker format="HH:mm" minuteStep={15} allowClear={false} value={t(lunch.start)} onChange={(v) => v && setLunch({ start: v.format('HH:mm') })} style={{ width: 110 }} />
              <Text type="secondary">to</Text>
              <TimePicker format="HH:mm" minuteStep={15} allowClear={false} value={t(lunch.end)} onChange={(v) => v && setLunch({ end: v.format('HH:mm') })} style={{ width: 110 }} />
            </div>
          )}
          <Button size="small" type="link" icon={<UndoOutlined />} onClick={() => onChange(DEFAULT_WORKDAY)} style={{ padding: 0 }}>Reset to default</Button>
        </div>
      )}
    >
      <button type="button" className="md-btn"><SettingOutlined /> Working hours</button>
    </Popover>
  );
}

export function HowItWorks() {
  return (
    <Popover
      placement="bottomRight" title="How your plan is made"
      content={(
        <div style={{ width: 300, fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 6px' }}>Every task gets a score — the higher it is, the sooner it appears:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><b>Overdue</b> and <b>due today</b> come first</li>
            <li>Then <b>priority</b> (Critical → Low)</li>
            <li>Work sent back by a reviewer, escalations and SLA risks get a boost</li>
            <li>Tasks you already started rank higher — <i>finish before you start new</i></li>
          </ul>
          <p style={{ margin: '8px 0 0' }}>Time estimates come from the task template and shrink as you tick steps. The plan updates every minute. Use <b>Do later</b> to move something out of today.</p>
        </div>
      )}
    >
      <button type="button" className="md-btn"><InfoCircleOutlined /> How this works</button>
    </Popover>
  );
}

export function ReviewsCard({ reviews }) {
  const navigate = useNavigate();
  if (!reviews.length) return null;
  const oldest = reviews[0];
  const waitH = oldest.SubmittedAt ? Math.round((Date.now() - new Date(oldest.SubmittedAt).getTime()) / 3600000) : null;
  return (
    <div className="md-card md-card--review">
      <div className="md-card__title md-card__title--review">
        <span><AuditOutlined /> Waiting for your review</span>
        <span>{reviews.length}</span>
      </div>
      {reviews.slice(0, 3).map(r => (
        <div className="md-mini" key={r.Id} onClick={() => navigate(`/tasks/reviews?task=${r.Id}`)}>
          <span className="md-dot" style={{ '--dot': accentFor(r) }} />
          <div className="md-mini__body">
            <div className="md-mini__title">{r.Title}</div>
            <Text className="md-mini__sub">{r.AssigneeName || 'Teammate'}</Text>
          </div>
        </div>
      ))}
      <Button type="primary" block className="md-review-cta" onClick={() => navigate('/tasks/reviews')}>
        Review {reviews.length} task{reviews.length > 1 ? 's' : ''}{waitH >= 4 ? ` · oldest waiting ${waitH}h` : ''} <RightOutlined />
      </Button>
    </div>
  );
}

/** Compact list used for Later / Waiting / Done. */
export function MiniList({ title, icon, items, empty, onOpen, renderExtra, tone }) {
  if (!items.length && !empty) return null;
  return (
    <div className="md-card">
      <div className={`md-card__title${tone === 'done' ? ' md-card__title--done' : ''}`}>
        <span>{icon} {title}</span>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <Text className="md-mini__empty">{empty}</Text>
      ) : items.map(it => (
        <div className="md-mini" key={it.id} onClick={() => onOpen?.(it.id)}>
          <span className="md-dot" style={{ '--dot': it.color }} />
          <div className="md-mini__body">
            <div className="md-mini__title">{it.title}</div>
            <Text className="md-mini__sub">{it.sub}</Text>
          </div>
          {renderExtra?.(it)}
        </div>
      ))}
    </div>
  );
}

export const DoneIcon = <CheckCircleFilled className="md-done-icon" />;
export const WaitIcon = <HourglassOutlined />;
export { formatDuration, FRIENDLY_STATUS };