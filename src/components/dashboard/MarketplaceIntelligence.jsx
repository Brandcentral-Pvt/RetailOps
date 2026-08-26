import React from 'react';
import { Typography, Badge } from 'antd';
import { ShoppingCart, BarChart3 } from 'lucide-react';

const { Text } = Typography;

const MARKETPLACE_COLORS = {
  'amazon': 'var(--bc-market-amazon)',
  'flipkart': 'var(--bc-market-flipkart)',
  'ajio': '#D32F2F',
  'myntra': 'var(--bc-market-myntra)',
};

const getMarketplaceColor = (name) => {
  const lower = (name || '').toLowerCase();
  for (const [key, color] of Object.entries(MARKETPLACE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return 'var(--bc-ro-500)';
};

const MarketplaceCard = ({ name, count, color }) => {
  const mpColor = color || getMarketplaceColor(name);

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-primary, #fff)',
      border: '1px solid var(--border-light, var(--border-light))',
      borderRadius: 'var(--radius-lg, 10px)',
      borderLeft: `4px solid ${mpColor}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg, 10px)', background: `${mpColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingCart size={20} color={mpColor} />
        </div>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary, var(--bc-slate-900))', display: 'block' }}>{name}</Text>
          <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, var(--bc-slate-500))' }}>Active listings</Text>
        </div>
      </div>

      <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary, #f4f4f5)', borderRadius: 'var(--radius-sm, 6px)' }}>
        <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, var(--bc-slate-500))', display: 'block' }}>Total ASINs</Text>
        <Text style={{ fontSize: 'var(--font-size-xl, 18px)', fontWeight: 600, color: 'var(--text-primary, var(--bc-slate-900))' }}>{(count || 0).toLocaleString()}</Text>
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
        border: '1px solid var(--border-light, var(--border-light))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-info-subtle, var(--bc-blue-50))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={14} color="var(--text-brand, var(--bc-ro-500))" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, var(--bc-slate-900))' }}>Marketplace Intelligence</Text>
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
      border: '1px solid var(--border-light, var(--border-light))'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-info-subtle, var(--bc-blue-50))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={14} color="var(--text-brand, var(--bc-ro-500))" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, var(--bc-slate-900))' }}>Marketplace Intelligence</Text>
        </div>
        <Badge count={marketplaceData.length} style={{ backgroundColor: 'var(--bg-brand, var(--bc-ro-500))' }} />
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
