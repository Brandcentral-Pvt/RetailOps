import React, { useState } from 'react';
import { Button, DatePicker, Popover, Typography } from 'antd';
import { CalendarOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDateRange } from '../../contexts/DateRangeContext';

const PRESETS = [
  { key: 'today', label: 'Today', range: n => [n, n] },
  { key: 'yesterday', label: 'Yesterday', range: n => [n.subtract(1, 'day'), n.subtract(1, 'day')] },
  { key: 'last7', label: 'Last 7 days', range: n => [n.subtract(6, 'day'), n] },
  { key: 'last30', label: 'Last 30 days', range: n => [n.subtract(29, 'day'), n] },
  { key: 'mtd', label: 'Month to date', range: n => [n.startOf('month'), n] },
  { key: 'lastMonth', label: 'Last month', range: n => [n.subtract(1, 'month').startOf('month'), n.subtract(1, 'month').endOf('month')] },
  { key: 'qtd', label: 'Quarter to date', range: n => [n.startOf('month').subtract(n.month() % 3, 'month'), n] },
  { key: 'ytd', label: 'Year to date', range: n => [n.startOf('year'), n] },
];

export default function DateRangeSelector({ loading = false }) {
  const { startDate, endDate, updateDateRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const preset = PRESETS.find(p => {
    const [s, e] = p.range(dayjs());
    return start.isSame(s, 'day') && end.isSame(e, 'day');
  });
  const label = preset?.label || 'Custom';
  const formatted = start.isSame(end, 'day')
    ? start.format('DD MMM YYYY')
    : start.format(start.year() === end.year() ? 'DD MMM' : 'DD MMM YYYY') + ' – ' + end.format('DD MMM YYYY');
  const apply = (s, e, rangeType) => {
    if (!s?.isValid() || !e?.isValid() || e.isBefore(s, 'day')) return;
    updateDateRange({ startDate: s.startOf('day').toDate(), endDate: e.endOf('day').toDate(), rangeType });
    setOpen(false);
  };
  const changeOpen = (next) => {
    if (next) { setFrom(start); setTo(end); }
    setOpen(next);
  };
  const valid = from?.isValid() && to?.isValid() && !to.isBefore(from, 'day');
  const content = (
    <div className="ro-header-date-content" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
      <Typography.Text strong>Quick ranges</Typography.Text>
      <div className="ro-header-date-presets">
        {PRESETS.map(p => (
          <Button key={p.key} type={preset?.key === p.key ? 'primary' : 'text'} size="small"
            onClick={() => { const [s, e] = p.range(dayjs()); apply(s, e, p.key); }}>
            {p.label}
          </Button>
        ))}
      </div>
      <Typography.Text strong>Custom range</Typography.Text>
      <div className="ro-header-date-fields">
        <label>From<DatePicker value={from} onChange={setFrom} format="DD MMM YYYY"
          disabledDate={d => Boolean(to && d.isAfter(to, 'day'))}
          getPopupContainer={trigger => trigger.parentElement} /></label>
        <label>To<DatePicker value={to} onChange={setTo} format="DD MMM YYYY"
          disabledDate={d => Boolean(from && d.isBefore(from, 'day'))}
          getPopupContainer={trigger => trigger.parentElement} /></label>
      </div>
      <Button type="primary" block disabled={!valid} onClick={() => apply(from, to, 'custom')}>Apply range</Button>
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={changeOpen}
      placement="bottomRight" arrow={false}>
      <Button className="ro-header-date-trigger" loading={loading}
        icon={<CalendarOutlined />} aria-label={`Date range: ${formatted}`} aria-expanded={open}
        title={formatted}>
        <span className="ro-header-date-label">
          <span className="ro-header-date-preset">{label}</span>
          <span className="ro-header-date-range">{formatted}</span>
        </span>
        <DownOutlined className="ro-header-date-chevron" />
      </Button>
    </Popover>
  );
}
