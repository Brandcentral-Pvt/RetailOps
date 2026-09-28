import { memo, useMemo } from 'react';
import { X, Search, Store, Tag as TagIcon } from 'lucide-react';

const LABEL_BY_KEY = {
  sku: 'SKU',
  parentAsin: 'Parent ASIN',
  scrapeStatus: 'Scrape Status',
  brand: 'Brand',
  category: 'Category',
  subBsrCategory: 'Sub BSR',
  buyBoxWin: 'BuyBox Winner',
  hasAplus: 'A+ Content',
  hasVideo: 'Video',
  hasDeal: 'Deal',
  minPrice: 'Min Price',
  maxPrice: 'Max Price',
  minBSR: 'Min BSR',
  maxBSR: 'Max BSR',
  minRating: 'Min Rating',
  maxRating: 'Max Rating',
  ageFilter: 'Age',
  minReleaseDate: 'From',
  maxReleaseDate: 'To',
  priceDispute: 'Price Dispute',
  bsrTrend: 'BSR Trend',
  ratingTrend: 'Rating Trend',
  historyDays: 'History Range',
  ads: 'Ads',
  availabilityStatus: 'Availability',
  manufacturer: 'Manufacturer',
  dealAccessType: 'Deal Type'
};

function humanise(value) {
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  return value;
}

function ClearButton({ label, onClick, tone }) {
  return (
    <button
      type="button"
      className={`asin-badge__clear ${tone === 'onDark' ? 'asin-badge__clear--onDark' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <X size={11} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}

function AppliedFilterBadges({
  appliedFilters,
  appliedSearchQuery,
  selectedSeller,
  sellerName,
  onClearFilter,
  onClearTag,
  onClearSearch,
  onClearSeller
}) {
  const badges = useMemo(() => {
    const out = [];

    Object.entries(appliedFilters).forEach(([key, value]) => {
      const label = LABEL_BY_KEY[key];
      if (!label || !value) return;

      out.push({
        id: key,
        kind: 'filter',
        label,
        value: humanise(value),
        onRemove: () => onClearFilter(key)
      });
    });

    (appliedFilters.selectedTags || []).forEach(tag => {
      out.push({
        id: `tag-${tag}`,
        kind: 'tag',
        label: null,
        value: tag,
        onRemove: () => onClearTag(tag)
      });
    });

    return out;
  }, [appliedFilters, onClearFilter, onClearTag]);

  const hasSearch = Boolean(appliedSearchQuery);
  const hasSeller = Boolean(selectedSeller);
  const isEmpty = !hasSearch && !hasSeller && badges.length === 0;

  if (isEmpty) return null;

  return (
    <div className="asin-badges" role="group" aria-label="Active filters">
      {hasSeller && (
        <span className="asin-badge asin-badge--seller">
          <Store size={10} className="asin-badge__icon" aria-hidden="true" />
          <span className="asin-badge__value">{sellerName || 'Selected Seller'}</span>
          <ClearButton
            tone="onDark"
            label={`Clear seller filter ${sellerName || ''}`.trim()}
            onClick={onClearSeller}
          />
        </span>
      )}

      {hasSearch && (
        <span className="asin-badge asin-badge--search">
          <Search size={10} className="asin-badge__icon" aria-hidden="true" />
          <span className="asin-badge__value asin-badge__value--query">"{appliedSearchQuery}"</span>
          <ClearButton
            label={`Clear search ${appliedSearchQuery}`}
            onClick={onClearSearch}
          />
        </span>
      )}

      {badges.map(badge =>
        badge.kind === 'tag' ? (
          <span key={badge.id} className="asin-badge asin-badge--tag">
            <TagIcon size={10} className="asin-badge__icon" aria-hidden="true" />
            <span className="asin-badge__value">{badge.value}</span>
            <ClearButton
              label={`Remove tag ${badge.value}`}
              onClick={badge.onRemove}
            />
          </span>
        ) : (
          <span key={badge.id} className="asin-badge">
            <span className="asin-badge__label">{badge.label}:</span>
            <span className="asin-badge__value">{badge.value}</span>
            <ClearButton
              label={`Remove filter ${badge.label} ${badge.value}`}
              onClick={badge.onRemove}
            />
          </span>
        )
      )}
    </div>
  );
}

export default memo(AppliedFilterBadges);
