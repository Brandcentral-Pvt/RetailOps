import React, { useMemo, useState } from 'react';
import { Table, Typography, Tag, Tooltip, Button } from 'antd';
import { 
  ChevronDown, ChevronRight, Eye, Package, 
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';

const { Text } = Typography;

const formatValue = (val, type = 'number') => {
  if (val === null || val === undefined) return '-';
  const num = Number(val);
  if (isNaN(num)) return '-';
  if (type === 'currency') return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === 'percent') return `${num.toFixed(2)}%`;
  if (type === 'ratio') return num.toFixed(2);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('en-IN');
};

const TrendIndicator = ({ current, previous, isInverted = false }) => {
  if (!previous || previous === 0) return <Minus size={12} color="#a1a1aa" />;
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return <Minus size={12} color="#a1a1aa" />;
  const isGood = isInverted ? change < 0 : change > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {isGood ? <TrendingUp size={12} color="#2E7D32" /> : <TrendingDown size={12} color="#C62828" />}
      <span style={{ fontSize: 10, fontWeight: 600, color: isGood ? '#2E7D32' : '#C62828' }}>
        {Math.abs(change).toFixed(1)}%
      </span>
    </div>
  );
};

const AdsTable = ({ 
  data = [], 
  loading, 
  groupBy = 'asin', 
  pagination = { page: 1, limit: 50, total: 0, totalPages: 0 },
  onPageChange,
  onPageSizeChange,
  onViewDetails 
}) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [expandedMetrics, setExpandedMetrics] = useState(new Set());

  const toggleMetric = (key) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Build columns with expandable daily data
  const { columns, dailyColumns } = useMemo(() => {
    const buildExpandableColumn = (title, key, format, bgColor, dailyBgColor) => {
      const isExpanded = expandedMetrics.has(key);
      
      return {
        title: (
          <div 
            onClick={(e) => { e.stopPropagation(); toggleMetric(key); }}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              background: isExpanded ? (dailyBgColor || '#f8fafc') : '#f8fafc',
              border: `1px solid ${isExpanded ? (dailyBgColor || '#e5e7eb') : '#e5e7eb'}`,
              transition: 'all 0.2s'
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.03em' }}>{title}</Text>
            <ChevronRight 
              size={10} 
              style={{ 
                color: '#94a3b8', 
                transform: isExpanded ? 'rotate(90deg)' : 'none', 
                transition: 'transform 0.2s' 
              }} 
            />
          </div>
        ),
        key,
        width: 110,
        align: 'right',
        sorter: (a, b) => Number(a[key] || 0) - Number(b[key] || 0),
        children: isExpanded ? [
          // Average column
          {
            title: <Text style={{ fontSize: 8, fontWeight: 700, color: '#64748b' }}>AVG</Text>,
            key: `${key}_avg`,
            width: 70,
            align: 'right',
            render: (val, record) => {
              const numVal = Number(val || 0);
              return <Text style={{ fontSize: 11, fontWeight: 600, color: '#18181b' }}>{formatValue(numVal, format)}</Text>;
            }
          },
          // Daily columns
          ...getDailyColumns(key, format, dailyBgColor)
        ] : undefined
      };
    };

    const getDailyColumns = (metricKey, format, bgColor) => {
      // Get unique dates from all data
      const allDates = new Set();
      data.forEach(row => {
        const history = row.weekHistory || row.history || [];
        history.forEach(h => {
          if (h.date) {
            const dateStr = new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            allDates.add(dateStr);
          }
        });
      });
      
      const sortedDates = Array.from(allDates).slice(-7).reverse();
      
      return sortedDates.map(dateStr => ({
        title: (
          <div style={{ textAlign: 'center', fontSize: 8, lineHeight: 1.1 }}>
            <div style={{ color: '#94a3b8' }}>{dateStr.split(' ')[0]}</div>
            <div style={{ fontWeight: 700, color: '#475569' }}>{dateStr.split(' ')[1]}</div>
          </div>
        ),
        key: `${metricKey}_${dateStr}`,
        width: 56,
        align: 'right',
        render: (_, record) => {
          const history = record.weekHistory || record.history || [];
          const dayData = history.find(h => {
            const d = new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            return d === dateStr;
          });
          const val = dayData ? Number(dayData[metricKey] || 0) : 0;
          if (val === 0) return <Text style={{ fontSize: 10, color: '#cbd5e1' }}>-</Text>;
          return <Text style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>{formatValue(val, format)}</Text>;
        }
      }));
    };

    const baseColumns = [
      {
        title: 'Product',
        key: 'product',
        width: 200,
        fixed: 'left',
        render: (_, record) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {record.imageUrl ? (
              <img 
                src={record.imageUrl} 
                alt="" 
                style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain', border: '1px solid #e4e4e7' }} 
              />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={14} color="#a1a1aa" />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#18181b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                {record.title || 'Untitled'}
              </Text>
              <Text code style={{ fontSize: 10, color: '#71717a' }}>{record.asin}</Text>
              {record.sku && <Text style={{ fontSize: 10, color: '#a1a1aa', marginLeft: 6 }}>SKU: {record.sku}</Text>}
            </div>
          </div>
        ),
      },
      buildExpandableColumn('SPEND', 'spend', 'currency', '#fef2f2', '#fef2f2'),
      buildExpandableColumn('SALES', 'sales', 'currency', '#f0fdf4', '#f0fdf4'),
      {
        title: (
          <div 
            onClick={(e) => { e.stopPropagation(); toggleMetric('acos'); }}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              background: expandedMetrics.has('acos') ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${expandedMetrics.has('acos') ? '#fecaca' : '#e5e7eb'}`,
              transition: 'all 0.2s'
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.03em' }}>ACOS</Text>
            <ChevronRight 
              size={10} 
              style={{ 
                color: '#94a3b8', 
                transform: expandedMetrics.has('acos') ? 'rotate(90deg)' : 'none', 
                transition: 'transform 0.2s' 
              }} 
            />
          </div>
        ),
        key: 'acos',
        width: 90,
        align: 'right',
        sorter: (a, b) => Number(a.acos || 0) - Number(b.acos || 0),
        children: expandedMetrics.has('acos') ? [
          {
            title: <Text style={{ fontSize: 8, fontWeight: 700, color: '#64748b' }}>AVG</Text>,
            key: 'acos_avg',
            width: 70,
            align: 'right',
            render: (val) => {
              const acos = Number(val || 0);
              const color = acos < 20 ? '#2E7D32' : acos < 30 ? '#ED6C02' : '#C62828';
              return <Text style={{ fontSize: 11, fontWeight: 600, color }}>{acos.toFixed(2)}%</Text>;
            }
          },
          ...getDailyColumns('acos', 'percent', '#fef2f2')
        ] : undefined,
        render: (val) => {
          if (expandedMetrics.has('acos')) return null;
          const acos = Number(val || 0);
          const color = acos < 20 ? '#2E7D32' : acos < 30 ? '#ED6C02' : '#C62828';
          return <Text style={{ fontSize: 12, fontWeight: 600, color }}>{acos.toFixed(2)}%</Text>;
        }
      },
      {
        title: (
          <div 
            onClick={(e) => { e.stopPropagation(); toggleMetric('roas'); }}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              background: expandedMetrics.has('roas') ? '#fffbeb' : '#f8fafc',
              border: `1px solid ${expandedMetrics.has('roas') ? '#fed7aa' : '#e5e7eb'}`,
              transition: 'all 0.2s'
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.03em' }}>ROAS</Text>
            <ChevronRight 
              size={10} 
              style={{ 
                color: '#94a3b8', 
                transform: expandedMetrics.has('roas') ? 'rotate(90deg)' : 'none', 
                transition: 'transform 0.2s' 
              }} 
            />
          </div>
        ),
        key: 'roas',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.roas || 0) - Number(b.roas || 0),
        children: expandedMetrics.has('roas') ? [
          {
            title: <Text style={{ fontSize: 8, fontWeight: 700, color: '#64748b' }}>AVG</Text>,
            key: 'roas_avg',
            width: 70,
            align: 'right',
            render: (val) => {
              const roas = Number(val || 0);
              const color = roas > 3 ? '#2E7D32' : roas > 2 ? '#ED6C02' : '#C62828';
              return <Text style={{ fontSize: 11, fontWeight: 600, color }}>{roas.toFixed(2)}</Text>;
            }
          },
          ...getDailyColumns('roas', 'ratio', '#fffbeb')
        ] : undefined,
        render: (val) => {
          if (expandedMetrics.has('roas')) return null;
          const roas = Number(val || 0);
          const color = roas > 3 ? '#2E7D32' : roas > 2 ? '#ED6C02' : '#C62828';
          return <Text style={{ fontSize: 12, fontWeight: 600, color }}>{roas.toFixed(2)}</Text>;
        }
      },
      buildExpandableColumn('ORDERS', 'orders', 'number', '#f5f3ff', '#f5f3ff'),
      {
        title: <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>CTR</Text>,
        key: 'ctr',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.ctr || 0) - Number(b.ctr || 0),
        render: (val) => <Text style={{ fontSize: 12, fontWeight: 500 }}>{Number(val || 0).toFixed(2)}%</Text>
      },
      {
        title: <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>CVR</Text>,
        key: 'cvr',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.cvr || 0) - Number(b.cvr || 0),
        render: (val) => <Text style={{ fontSize: 12, fontWeight: 500 }}>{Number(val || 0).toFixed(2)}%</Text>
      },
      buildExpandableColumn('CLICKS', 'clicks', 'number', '#ecfeff', '#ecfeff'),
      buildExpandableColumn('IMPRESSIONS', 'impressions', 'number', '#f8fafc', '#f8fafc'),
      {
        title: 'Actions',
        key: 'actions',
        width: 60,
        fixed: 'right',
        render: (_, record) => (
          <Tooltip title="View Details">
            <Button 
              type="text" 
              size="small" 
              icon={<Eye size={14} />}
              onClick={() => onViewDetails?.(record)}
            />
          </Tooltip>
        )
      }
    ];

    return { columns: baseColumns, dailyColumns: [] };
  }, [expandedMetrics, data]);

  // Parent view - group by parent ASIN
  const parentData = useMemo(() => {
    if (groupBy !== 'parent') return data;
    
    const parentMap = {};
    data.forEach(row => {
      const parentAsin = row.parentAsin || row.asin;
      if (!parentMap[parentAsin]) {
        parentMap[parentAsin] = {
          ...row,
          asin: parentAsin,
          isParent: true,
          childCount: 0,
          children: [],
          weekHistory: []
        };
      }
      parentMap[parentAsin].childCount++;
      parentMap[parentAsin].children.push(row);
      
      const parent = parentMap[parentAsin];
      parent.spend = (Number(parent.spend) || 0) + (Number(row.spend) || 0);
      parent.sales = (Number(parent.sales) || 0) + (Number(row.sales) || 0);
      parent.orders = (Number(parent.orders) || 0) + (Number(row.orders) || 0);
      parent.clicks = (Number(parent.clicks) || 0) + (Number(row.clicks) || 0);
      parent.impressions = (Number(parent.impressions) || 0) + (Number(row.impressions) || 0);
      
      if (row.weekHistory) {
        parent.weekHistory = [...parent.weekHistory, ...row.weekHistory];
      }
    });

    return Object.values(parentMap).map(parent => ({
      ...parent,
      acos: Number(parent.sales) > 0 ? (Number(parent.spend) / Number(parent.sales)) * 100 : 0,
      roas: Number(parent.spend) > 0 ? Number(parent.sales) / Number(parent.spend) : 0,
      ctr: Number(parent.impressions) > 0 ? (Number(parent.clicks) / Number(parent.impressions)) * 100 : 0,
      cvr: Number(parent.clicks) > 0 ? (Number(parent.orders) / Number(parent.clicks)) * 100 : 0,
    }));
  }, [data, groupBy]);

  const tableData = groupBy === 'parent' ? parentData : data;

  const expandedRowRender = (record) => {
    if (!record.children || record.children.length === 0) return null;
    
    return (
      <div style={{ padding: '8px 0' }}>
        <Table
          columns={columns.filter(c => c.key !== 'product' && c.key !== 'actions')}
          dataSource={record.children.map((child, idx) => ({ ...child, key: `${record.asin}-child-${idx}` }))}
          pagination={false}
          size="small"
          style={{ background: '#fafafa', borderRadius: 8 }}
        />
      </div>
    );
  };

  return (
    <Table
      columns={columns}
      dataSource={tableData.map((row, idx) => ({ ...row, key: row.asin || idx }))}
      loading={loading}
      pagination={{
        current: pagination.page,
        pageSize: pagination.limit,
        total: pagination.total,
        showSizeChanger: true,
        pageSizeOptions: ['25', '50', '100'],
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
        size: 'small',
        onChange: (page, pageSize) => {
          if (onPageChange) onPageChange(page);
          if (onPageSizeChange && pageSize !== pagination.limit) onPageSizeChange(pageSize);
        }
      }}
      scroll={{ x: 1200 }}
      size="small"
      expandable={groupBy === 'parent' ? {
        expandedRowKeys,
        onExpandedRowsChange: (keys) => setExpandedRowKeys(keys),
        expandedRowRender,
        rowExpandable: (record) => record.children && record.children.length > 0
      } : undefined}
      rowClassName={(record) => record.isParent ? 'parent-row' : ''}
      style={{ borderRadius: 8 }}
    />
  );
};

// Helper function for daily columns (used inside component)
function getDailyColumns(metricKey, format, bgColor) {
  return []; // Placeholder - actual implementation uses data from parent
}

export default AdsTable;
