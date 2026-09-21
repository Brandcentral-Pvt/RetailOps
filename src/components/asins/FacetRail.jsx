import React, { useMemo } from 'react';
import { Tooltip, Dropdown } from 'antd';
import { AlertTriangle, RefreshCw, Tag as TagIcon, Layers, Store } from 'lucide-react';

/**
 * Facet rail — filter counts, made clickable (Step 3).
 *
 * A filter checkbox without a number is a guess; `Stale (812)` is a decision.
 * The counts come from `GET /api/asins/facets` for the caller's scope, and every
 * chip toggles exactly the filter the table understands, so a count is also a
 * drill-through into the filtered list.
 *
 * Only the facets that change day to day are shown inline; categories, brands,
 * tags and sellers live behind "more" menus because a catalogue has hundreds of
 * them.
 */

const FRESHNESS_META = {
  fresh: { label: 'Fresh', color: 'var(--text-success)', bg: '#ecfdf5' },
  stale: { label: 'Stale', color: '#b45309', bg: '#fffbeb' },
  never: { label: 'Never scraped', color: 'var(--text-danger)', bg: '#fef2f2' },
};

const chipStyle = (active, accent) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  padding: '0 10px',
  borderRadius: 100,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  border: `1px solid ${active ? (accent || 'var(--text-primary)') : 'var(--border-light)'}`,
  background: active ? (accent || 'var(--text-primary)') : '#fff',
  color: active ? '#fff' : 'var(--text-secondary, #52525b)',
  transition: 'all 0.15s ease',
});

const Count = ({ value, active }) => (
  <span
    className="font-monospace"
    style={{
      fontSize: 10,
      fontWeight: 700,
      padding: '0 5px',
      borderRadius: 100,
      background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-active, #f4f4f5)',
      color: active ? '#fff' : 'inherit',
    }}
  >
    {typeof value === 'number' ? value.toLocaleString() : value}
  </span>
);

const FacetChip = ({ label, count, active, accent, onClick, icon }) => (
  <Tooltip title={active ? `Remove filter: ${label}` : `Filter: ${label} (${count})`}>
    <span style={chipStyle(active, accent)} onClick={onClick}>
      {icon}
      {label}
      <Count value={count} active={active} />
    </span>
  </Tooltip>
);

const MoreMenu = ({ title, items, activeValue, onPick, icon }) => {
  const menuItems = items.slice(0, 25).map((item) => ({
    key: String(item.value),
    label: (
      <span className="d-flex align-items-center justify-content-between gap-3" style={{ minWidth: 180 }}>
        <span className="text-truncate" style={{ maxWidth: 220, fontSize: 12 }} title={String(item.value)}>
          {String(item.value)}
        </span>
        <Count value={item.count} active={false} />
      </span>
    ),
  }));

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: menuItems.length > 0 ? menuItems : [{ key: 'none', label: 'No values', disabled: true }],
        onClick: ({ key }) => onPick(activeValue === key ? '' : key),
      }}
    >
      <span style={chipStyle(Boolean(activeValue), undefined)}>
        {icon}
        {activeValue ? String(activeValue).slice(0, 22) : title}
      </span>
    </Dropdown>
  );
};

const FacetRail = ({ facets, appliedFilters = {}, onToggle, onSetFilter, onPickSeller, loading = false, slaDays = 7 }) => {
  const total = facets?.total || 0;
  const freshness = useMemo(() => {
    const map = {};
    (facets?.freshness || []).forEach((f) => { map[f.value] = f.count; });
    return map;
  }, [facets]);

  if (!facets) return null;

  const statusItems = facets.status || [];
  const scrapeItems = facets.scrapeStatus || [];

  return (
    <div
      className="d-flex align-items-center flex-wrap"
      style={{ gap: 6, padding: '8px 24px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)', flexShrink: 0 }}
    >
      <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: 9, letterSpacing: '0.06em', marginRight: 2 }}>
        {loading ? <RefreshCw size={10} className="spin" /> : 'Counts'}
      </span>

      {Object.entries(FRESHNESS_META).map(([key, meta]) => (
        <FacetChip
          key={key}
          label={meta.label}
          count={freshness[key] || 0}
          active={appliedFilters.freshness === key}
          accent={key === 'fresh' ? '#047857' : key === 'stale' ? '#b45309' : '#b91c1c'}
          icon={key === 'stale' || key === 'never' ? <AlertTriangle size={11} /> : undefined}
          onClick={() => onSetFilter && onSetFilter('freshness', appliedFilters.freshness === key ? '' : key)}
        />
      ))}

      <span style={{ width: 1, height: 16, background: 'var(--border-light)', margin: '0 4px' }} />

      {statusItems
        .filter((s) => s.value)
        .map((s) => (
          <FacetChip
            key={`status-${s.value}`}
            label={String(s.value)}
            count={s.count}
            active={appliedFilters.status === s.value}
            onClick={() => onToggle && onToggle('status', String(s.value))}
          />
        ))}

      {scrapeItems
        .filter((s) => s.value && s.value !== 'COMPLETED')
        .map((s) => (
          <FacetChip
            key={`scrape-${s.value}`}
            label={`Scrape: ${String(s.value)}`}
            count={s.count}
            active={appliedFilters.scrapeStatus === s.value}
            accent="#b45309"
            onClick={() => onToggle && onToggle('scrapeStatus', String(s.value))}
          />
        ))}

      <MoreMenu
        title="Category"
        icon={<Layers size={11} />}
        items={facets.category || []}
        activeValue={appliedFilters.category}
        onPick={(value) => onSetFilter && onSetFilter('category', value)}
      />
      <MoreMenu
        title="Brand"
        icon={<TagIcon size={11} />}
        items={facets.brand || []}
        activeValue={appliedFilters.brand}
        onPick={(value) => onSetFilter && onSetFilter('brand', value)}
      />
      <MoreMenu
        title="Tag"
        icon={<TagIcon size={11} />}
        items={facets.tags || []}
        activeValue={(appliedFilters.selectedTags || [])[0]}
        onPick={(value) => onSetFilter && onSetFilter('selectedTags', value ? [value] : [])}
      />
      {/* Seller facet values are names; the table filters by id, so the page
          resolves the name → id and switches scope. */}
      {onPickSeller && (
        <MoreMenu
          title="Seller"
          icon={<Store size={11} />}
          items={facets.seller || []}
          activeValue={appliedFilters.sellerName}
          onPick={(value) => onPickSeller(value)}
        />
      )}

      <span className="ms-auto text-secondary" style={{ fontSize: 10 }}>
        {total.toLocaleString()} ASINs in scope · {slaDays}d freshness SLA
      </span>
    </div>
  );
};

export default FacetRail;
