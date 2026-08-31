import React from 'react';
import { Drawer, Button, Input, Select, Tag } from 'antd';
import { SlidersHorizontal } from 'lucide-react';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (filter drawer region).
// Pure render component: parent state/handlers arrive via props; contains no hooks.
const AsinFilterDrawer = ({
  filterPanelOpen,
  setFilterPanelOpen,
  filters,
  setFilters,
  filterOptions,
  tagSearch,
  setTagSearch,
  resetAllFilters,
  handleApplyFilters,
}) => {
    return (
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <div style={{ background: 'var(--bg-active)', padding: 7, borderRadius: "var(--radius-md)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={16} style={{ color: '#3f3f46' }} />
            </div>
            <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Filters</span>
          </div>
        }
        placement="right"
        onClose={() => setFilterPanelOpen(false)}
        open={filterPanelOpen}
        width={400}
        styles={{
          header: { borderBottom: '1px solid var(--bg-active)', padding: '12px 20px' },
          body: { padding: 0, display: 'flex', flexDirection: 'column', background: '#fff' }
        }}
        extra={
          <Button type="link" size="small" onClick={resetAllFilters} style={{ fontSize: 12, color: 'var(--text-danger)', fontWeight: 600, padding: 0 }}>
            Reset All
          </Button>
        }
      >
        {/* Content - Scrollable */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

          {/* SEARCH & BASIC */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Identity & Search</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>SKU</div>
                <Input size="small" placeholder="Enter SKU..." value={filters.sku} onChange={(e) => setFilters({ ...filters, sku: e.target.value })} allowClear style={{ borderRadius: "var(--radius-md)" }} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Parent ASIN</div>
                <Input size="small" placeholder="Enter Parent ASIN..." value={filters.parentAsin} onChange={(e) => setFilters({ ...filters, parentAsin: e.target.value })} allowClear style={{ borderRadius: "var(--radius-md)" }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* ATTRIBUTES */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Product Attributes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Scrape Status</div>
                <Select size="small" placeholder="All Statuses" value={filters.scrapeStatus || undefined} onChange={(v) => setFilters({ ...filters, scrapeStatus: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={(filterOptions.scrapeStatuses || []).map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Brand</div>
                <Select size="small" placeholder="All Brands" value={filters.brand || undefined} onChange={(v) => setFilters({ ...filters, brand: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={filterOptions.brands.map(b => ({ value: b, label: b }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Category</div>
                <Select size="small" placeholder="All Categories" value={filters.category || undefined} onChange={(v) => setFilters({ ...filters, category: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={filterOptions.categories.map(c => ({ value: c, label: c }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Sub BSR Category</div>
                <Select size="small" placeholder="All Sub BSR Categories" value={filters.subBsrCategory || undefined} onChange={(v) => setFilters({ ...filters, subBsrCategory: v || '' })} allowClear showSearch optionFilterProp="label" style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={(filterOptions.subBsrCategories || []).map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Manufacturer</div>
                <Input size="small" placeholder="Search manufacturer..." value={filters.manufacturer} onChange={(e) => setFilters({ ...filters, manufacturer: e.target.value })} allowClear style={{ borderRadius: "var(--radius-md)" }} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* QUICK FLAGS */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Quick Flags</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BuyBox</div>
                <Select size="small" placeholder="All" value={filters.buyBoxWin || undefined} onChange={(v) => setFilters({ ...filters, buyBoxWin: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Won (Own)' }, { value: 'false', label: 'Lost (Other)' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>A+ Content</div>
                <Select size="small" placeholder="All" value={filters.hasAplus || undefined} onChange={(v) => setFilters({ ...filters, hasAplus: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Video</div>
                <Select size="small" placeholder="All" value={filters.hasVideo || undefined} onChange={(v) => setFilters({ ...filters, hasVideo: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Active Deal</div>
                <Select size="small" placeholder="All" value={filters.hasDeal || undefined} onChange={(v) => setFilters({ ...filters, hasDeal: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Ads Active</div>
                <Select size="small" placeholder="All" value={filters.ads || undefined} onChange={(v) => setFilters({ ...filters, ads: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Availability</div>
                <Select size="small" placeholder="All" value={filters.availabilityStatus || undefined} onChange={(v) => setFilters({ ...filters, availabilityStatus: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'In Stock', label: 'In Stock' }, { value: 'Out of Stock', label: 'Out of Stock' }, { value: 'Available', label: 'Available' }, { value: 'Currently unavailable.', label: 'Unavailable' }, { value: 'ADD TO BAG', label: 'Add to Bag' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Deal Type</div>
                <Select size="small" placeholder="All" value={filters.dealAccessType || undefined} onChange={(v) => setFilters({ ...filters, dealAccessType: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'ALL', label: 'ALL' }, { value: 'PRIME', label: 'PRIME' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Price Dispute</div>
                <Select size="small" placeholder="All ASINs" value={filters.priceDispute || undefined} onChange={(v) => setFilters({ ...filters, priceDispute: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'true', label: 'Disputed Only' }, { value: 'false', label: 'Non-Disputed' }]} />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* TRENDS & HISTORY */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Performance Trends</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BSR Trend</div>
                <Select size="small" placeholder="All Trends" value={filters.bsrTrend || undefined} onChange={(v) => setFilters({ ...filters, bsrTrend: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'Grow', label: 'Growing' }, { value: 'Down', label: 'Down' }, { value: 'Stable', label: 'Stable' }]} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Rating Trend</div>
                <Select size="small" placeholder="All Trends" value={filters.ratingTrend || undefined} onChange={(v) => setFilters({ ...filters, ratingTrend: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: 'Grow', label: 'Growing' }, { value: 'Down', label: 'Down' }, { value: 'Stable', label: 'Stable' }]} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>History Data Range</div>
              <Select size="small" placeholder="Default: 14 Days" value={filters.historyDays || undefined} onChange={(v) => setFilters({ ...filters, historyDays: v || '' })} allowClear style={{ width: '100%', borderRadius: "var(--radius-md)" }} options={[{ value: '1', label: 'Today Only' }, { value: '7', label: 'Last 7 Days' }, { value: '14', label: 'Last 14 Days' }, { value: '30', label: 'Last 30 Days' }, { value: '90', label: 'Last 90 Days' }]} />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* RANGES */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Metrics & Ranges</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Price Range (₹)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" placeholder="Min" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                  <Input size="small" type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>BSR Range</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" placeholder="Min" value={filters.minBSR} onChange={(e) => setFilters({ ...filters, minBSR: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                  <Input size="small" type="number" placeholder="Max" value={filters.maxBSR} onChange={(e) => setFilters({ ...filters, maxBSR: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Rating Range</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input size="small" type="number" step="0.1" placeholder="Min" value={filters.minRating} onChange={(e) => setFilters({ ...filters, minRating: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                  <Input size="small" type="number" step="0.1" placeholder="Max" value={filters.maxRating} onChange={(e) => setFilters({ ...filters, maxRating: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* TAGS */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Tags</div>
            <Input.Search size="small" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} style={{ borderRadius: "var(--radius-md)", marginBottom: 10 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filterOptions.tags
                .filter(t => typeof t === 'string' && t.toLowerCase().includes(tagSearch.toLowerCase()))
                .map(tag => {
                  const active = filters.selectedTags.includes(tag);
                  return (
                    <Tag
                      key={tag}
                      style={{ cursor: 'pointer', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 10px', margin: 0, border: active ? '1px solid var(--text-primary)' : '1px solid var(--border-light)', background: active ? 'var(--text-primary)' : 'var(--bg-active)', color: active ? '#fff' : '#52525b' }}
                      onClick={() => {
                        const newTags = active ? filters.selectedTags.filter(t => t !== tag) : [...filters.selectedTags, tag];
                        setFilters({ ...filters, selectedTags: newTags });
                      }}
                    >
                      {tag}
                    </Tag>
                  );
                })}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--bg-active)', margin: '0 -20px 24px' }} />

          {/* AGE FILTER */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Listing Age</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[
                { label: 'New (<30D)', value: '30' },
                { label: '30-60D', value: '60' },
                { label: '60-90D', value: '90' },
                { label: '90-180D', value: '180' },
                { label: '180-365D', value: '365' },
                { label: '365+ Days', value: '365+' }
              ].map(opt => (
                <Tag
                  key={opt.value}
                  style={{ cursor: 'pointer', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 10px', margin: 0, border: filters.ageFilter === opt.value ? '1px solid var(--text-primary)' : '1px solid var(--border-light)', background: filters.ageFilter === opt.value ? 'var(--text-primary)' : 'var(--bg-active)', color: filters.ageFilter === opt.value ? '#fff' : '#52525b' }}
                  onClick={() => setFilters({ ...filters, ageFilter: filters.ageFilter === opt.value ? '' : opt.value })}
                >
                  {opt.label}
                </Tag>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Release Date Range</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input size="small" type="date" value={filters.minReleaseDate} onChange={(e) => setFilters({ ...filters, minReleaseDate: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
                <Input size="small" type="date" value={filters.maxReleaseDate} onChange={(e) => setFilters({ ...filters, maxReleaseDate: e.target.value })} style={{ borderRadius: "var(--radius-md)", flex: 1 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bg-active)', background: '#fafafa', display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button size="small" block onClick={resetAllFilters} style={{ borderRadius: "var(--radius-md)", fontWeight: 600, height: 32 }}>Reset</Button>
          <Button size="small" type="primary" block onClick={handleApplyFilters} style={{ borderRadius: "var(--radius-md)", fontWeight: 600, height: 32, background: 'var(--text-primary)', borderColor: 'var(--text-primary)' }}>Apply Filters</Button>
        </div>
      </Drawer>
    );
};

export default AsinFilterDrawer;
