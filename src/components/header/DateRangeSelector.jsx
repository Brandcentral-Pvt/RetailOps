import React from 'react';
import { CalendarOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDateRange } from '../../contexts/DateRangeContext';

const PRESETS = [
  { key: 'today', label: 'Today', getRange: () => [dayjs(), dayjs()] },
  { key: 'yesterday', label: 'Yesterday', getRange: () => [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { key: 'last7', label: 'Last 7 days', getRange: () => [dayjs().subtract(6, 'day'), dayjs()] },
  { key: 'last30', label: 'Last 30 days', getRange: () => [dayjs().subtract(29, 'day'), dayjs()] },
  { key: 'mtd', label: 'Month to date', getRange: () => [dayjs().startOf('month'), dayjs()] },
  { key: 'lastMonth', label: 'Last month', getRange: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { key: 'qtd', label: 'Quarter to date', getRange: () => [dayjs().startOf('quarter'), dayjs()] },
  { key: 'ytd', label: 'Year to date', getRange: () => [dayjs().startOf('year'), dayjs()] },
];

const DateRangeSelector = () => {
  const { startDate, endDate, rangeType, openPicker } = useDateRange();

  const currentPreset = PRESETS.find((p) => {
    const [s, e] = p.getRange();
    return dayjs(startDate).isSame(s, 'day') && dayjs(endDate).isSame(e, 'day');
  });

  const formatRange = () => {
    const s = dayjs(startDate);
    const e = dayjs(endDate);
    if (s.isSame(e, 'day')) return s.format('DD MMM YYYY');
    if (s.year() === e.year()) {
      return `${s.format('DD MMM')} – ${e.format('DD MMM YYYY')}`;
    }
    return `${s.format('DD MMM YY')} – ${e.format('DD MMM YY')}`;
  };

  return (
    <button className="date-range-trigger" onClick={openPicker} type="button">
        <CalendarOutlined className="date-range-icon" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <span className="date-range-preset-label">{currentPreset?.label || (rangeType === 'custom' ? 'Custom range' : 'Schedule')}</span>
          <span style={{ lineHeight: 1.2, fontSize: 11 }}>{formatRange()}</span>
        </div>
        <DownOutlined style={{ fontSize: 9, color: '#8c8e8f' }} />
      </button>
  );
};

export default DateRangeSelector;
