import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, X } from 'lucide-react';
import { useDateRange } from '../../contexts/DateRangeContext';

const getDateValue = (date) => {
  if (!date) return '';
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
};

const PRESETS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: 'last7', label: 'Last 7 days', days: 6 },
  { value: 'last30', label: 'Last 30 days', days: 29 },
  { value: 'last90', label: 'Last 90 days', days: 89 },
];

const ScheduleDate = () => {
  const { startDate, endDate, rangeType, updateDateRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(getDateValue(startDate));
  const [draftEnd, setDraftEnd] = useState(getDateValue(endDate));
  const [draftPreset, setDraftPreset] = useState(rangeType || 'last30');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setDraftStart(getDateValue(startDate));
      setDraftEnd(getDateValue(endDate));
      setDraftPreset(rangeType || 'custom');
    }
  }, [open, startDate, endDate, rangeType]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const selectedLabel = useMemo(() => {
    const preset = PRESETS.find((item) => item.value === rangeType);
    if (preset) return preset.label;
    return 'Custom range';
  }, [rangeType]);

  const displayRange = useMemo(() => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (!start || !end) return 'Choose dates';
    const format = (value) => value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${format(start)} - ${format(end)}`;
  }, [startDate, endDate]);

  const applyPreset = (preset) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - preset.days);
    setDraftStart(getDateValue(start));
    setDraftEnd(getDateValue(end));
    setDraftPreset(preset.value);
  };

  const apply = () => {
    if (!draftStart || !draftEnd || draftStart > draftEnd) return;
    updateDateRange({
      startDate: new Date(`${draftStart}T00:00:00`),
      endDate: new Date(`${draftEnd}T23:59:59`),
      rangeType: draftPreset || 'custom',
    });
    setOpen(false);
  };

  return (
    <div className="schedule-date" ref={containerRef}>
      <button
        type="button"
        className={`schedule-date-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarDays size={15} strokeWidth={1.8} />
        <span className="schedule-date-copy">
          <span className="schedule-date-label">{selectedLabel}</span>
          <span className="schedule-date-value">{displayRange}</span>
        </span>
        <ChevronDown size={13} className={open ? 'schedule-date-chevron is-open' : 'schedule-date-chevron'} />
      </button>

      {open && (
        <div className="schedule-date-popover" role="dialog" aria-label="Select date range">
          <div className="schedule-date-heading">
            <div>
              <span className="schedule-date-eyebrow">Workspace schedule</span>
              <h3>Select date range</h3>
              <p>Choose a preset or define a reporting window.</p>
            </div>
            <button type="button" className="schedule-date-close" onClick={() => setOpen(false)} aria-label="Close date range picker">
              <X size={15} />
            </button>
          </div>

          <div className="schedule-date-body">
            <div className="schedule-date-presets">
              <span className="schedule-date-section-label">Quick ranges</span>
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.value}
                  className={draftPreset === preset.value ? 'schedule-preset is-active' : 'schedule-preset'}
                  onClick={() => applyPreset(preset)}
                >
                  {draftPreset === preset.value && <Check size={13} />}
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="schedule-date-fields">
              <span className="schedule-date-section-label">Custom range</span>
              <label>
                <span>From</span>
                <input type="date" value={draftStart} onChange={(event) => { setDraftStart(event.target.value); setDraftPreset('custom'); }} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={draftEnd} min={draftStart} onChange={(event) => { setDraftEnd(event.target.value); setDraftPreset('custom'); }} />
              </label>
            </div>
          </div>

          <div className="schedule-date-footer">
            <button type="button" className="schedule-date-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="schedule-date-apply" onClick={apply} disabled={!draftStart || !draftEnd || draftStart > draftEnd}>Apply range</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleDate;
