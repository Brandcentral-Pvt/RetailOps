import React, { useMemo, memo } from 'react';
import { Select, DatePicker } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useDateRange } from '../../contexts/DateRangeContext';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DashboardHeader = ({
  filters,
  setFilters,
  userSellers = [],
  managers = [],
  onSync,
  loading
}) => {
  const { startDate, endDate, updateDateRange } = useDateRange();

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters?.sellerId && filters.sellerId !== 'all') count++;
    if (filters?.managerId && filters.managerId !== 'all') count++;
    if (filters?.goalType && filters.goalType !== 'all') count++;
    return count;
  }, [filters]);

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 0px',
        flexWrap: 'wrap',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 'var(--font-size-xl)',
          fontWeight: 600,
          color: 'var(--text-primary, #0f172a)',
          letterSpacing: '-0.3px',
          whiteSpace: 'nowrap',
        }}>
          Dashboard
        </h1>

        <div className="dash-header-filter" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <RangePicker
            value={[dayjs(startDate), dayjs(endDate)]}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                updateDateRange({
                  startDate: dates[0].toDate(),
                  endDate: dates[1].toDate(),
                  rangeType: 'custom',
                });
                setFilters(prev => ({
                  ...prev,
                  dateRange: { start: dates[0].toDate(), end: dates[1].toDate() }
                }));
              }
            }}
            size="middle"
            style={{ minWidth: 240 }}
            separator={<span style={{ color: 'var(--text-secondary, #64748b)' }}>—</span>}
          />

          <Select
            value={filters?.sellerId || 'all'}
            onChange={(val) => setFilters(prev => ({ ...prev, sellerId: val }))}
            style={{ minWidth: 140 }}
            placeholder="All Brands"
            options={[
              { value: 'all', label: 'All Brands' },
              ...userSellers.map(s => ({ value: s.id, label: s.name }))
            ]}
          />

          <Select
            value={filters?.managerId || 'all'}
            onChange={(val) => setFilters(prev => ({ ...prev, managerId: val }))}
            style={{ minWidth: 140 }}
            placeholder="All Managers"
            options={[
              { value: 'all', label: 'All Managers' },
              ...managers.map(m => ({ value: m.id, label: m.name }))
            ]}
          />

          <Select
            value={filters?.goalType || 'all'}
            onChange={(val) => setFilters(prev => ({ ...prev, goalType: val }))}
            style={{ minWidth: 120 }}
            placeholder="All Goals"
            options={[
              { value: 'all', label: 'All Goals' },
              { value: 'GMS', label: 'GMS' },
              { value: 'ADS', label: 'ADS' },
              { value: 'ACOS', label: 'ACoS' },
            ]}
          />

          <button
            onClick={onSync}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 14px',
              background: loading ? 'var(--text-secondary, #64748b)' : 'var(--text-brand, #1976D2)',
              color: 'var(--bg-primary, #fff)',
              border: 'none',
              borderRadius: 'var(--radius-md, 8px)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: loading ? 'dash-spin 1s linear infinite' : 'none' }}
            />
            {loading ? 'Syncing...' : 'Sync'}
          </button>

          {activeFiltersCount > 0 && (
            <span style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--text-secondary, #64748b)',
              background: 'var(--bg-secondary, #f8fafc)',
              padding: '2px 8px',
              borderRadius: "var(--radius-sm)",
            }}>
              {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default memo(DashboardHeader);
