import React from 'react';
import { Typography, Badge } from 'antd';
import { ShoppingCart, BarChart3 } from 'lucide-react';

const { Text } = Typography;

const MARKETPLACE_COLORS = {
  'amazon': '#FF9900',
  'flipkart': '#2874F0',
  'ajio': '#D32F2F',
  'myntra': '#FF3F6C',
};

const getMarketplaceColor = (name) => {
  const lower = (name || '').toLowerCase();
  for (const [key, color] of Object.entries(MARKETPLACE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#1976D2';
};

const MarketplaceCard = ({ name, count, color }) => {
  const mpColor = color || getMarketplaceColor(name);

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-primary, #fff)',
      border: '1px solid var(--border-light, #d9e6e9)',
      borderRadius: 'var(--radius-lg, 10px)',
      borderLeft: `4px solid ${mpColor}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg, 10px)', background: `${mpColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingCart size={20} color={mpColor} />
        </div>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary, #0f172a)', display: 'block' }}>{name}</Text>
          <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)' }}>Active listings</Text>
        </div>
      </div>

      <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary, #f4f4f5)', borderRadius: 'var(--radius-sm, 6px)' }}>
        <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', display: 'block' }}>Total ASINs</Text>
        <Text style={{ fontSize: 'var(--font-size-xl, 18px)', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{(count || 0).toLocaleString()}</Text>
      </div>
    </div>
  );
};

const MarketplaceIntelligence = ({ marketplaces = [] }) => {
  const marketplaceData = marketplaces
    .filter(mp => mp.name && mp.name !== 'Unknown')
    .map(mp => ({
      name: mp.name,
      count: Array.isArray(mp.data) ? mp.data.reduce((a, b) => a + b, 0) : (mp.count || 0),
      color: mp.color || getMarketplaceColor(mp.name),
    }));

  if (marketplaceData.length === 0) {
    return (
      <div style={{
        padding: '16px 20px',
        background: 'var(--bg-primary, #fff)',
        borderRadius: 'var(--radius-xl, 16px)',
        border: '1px solid var(--border-light, #d9e6e9)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-info-subtle, #eff6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={14} color="var(--text-brand, #1976D2)" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, #0f172a)' }}>Marketplace Intelligence</Text>
        </div>
        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-tertiary, #9CA3AF)', fontSize: 'var(--font-size-sm)' }}>
          No marketplace data available
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-primary, #fff)',
      borderRadius: 'var(--radius-xl, 16px)',
      border: '1px solid var(--border-light, #d9e6e9)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-info-subtle, #eff6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={14} color="var(--text-brand, #1976D2)" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, #0f172a)' }}>Marketplace Intelligence</Text>
        </div>
        <Badge count={marketplaceData.length} style={{ backgroundColor: 'var(--bg-brand, #1976D2)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {marketplaceData.map((mp, i) => (
          <MarketplaceCard key={i} {...mp} />
        ))}
      </div>
    </div>
  );
};

export default MarketplaceIntelligence;
