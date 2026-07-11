import React, { useMemo, useState } from 'react';
import { Table, Typography, Tag, Tooltip, Button, Space } from 'antd';
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

const MetricCell = ({ value, format = 'number', prevValue, isInverted = false }) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{formatValue(value, format)}</div>
    {prevValue !== undefined && (
      <TrendIndicator current={value} previous={prevValue} isInverted={isInverted} />
    )}
  </div>
);

const AdsTable = ({ data = [], loading, groupBy = 'asin', onViewDetails }) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const columns = useMemo(() => {
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
      {
        title: 'Spend',
        dataIndex: 'spend',
        key: 'spend',
        width: 110,
        align: 'right',
        sorter: (a, b) => Number(a.spend || 0) - Number(b.spend || 0),
        render: (val, record) => <MetricCell value={val} format="currency" prevValue={record.prevSpend} />
      },
      {
        title: 'Sales',
        dataIndex: 'sales',
        key: 'sales',
        width: 110,
        align: 'right',
        sorter: (a, b) => Number(a.sales || 0) - Number(b.sales || 0),
        render: (val, record) => <MetricCell value={val} format="currency" prevValue={record.prevSales} />
      },
      {
        title: 'ACOS',
        dataIndex: 'acos',
        key: 'acos',
        width: 90,
        align: 'right',
        sorter: (a, b) => Number(a.acos || 0) - Number(b.acos || 0),
        render: (val, record) => {
          const acos = Number(val || 0);
          const color = acos < 20 ? '#2E7D32' : acos < 30 ? '#ED6C02' : '#C62828';
          return (
            <div>
              <Text style={{ fontSize: 12, fontWeight: 600, color }}>{acos.toFixed(2)}%</Text>
              {record.prevAcos !== undefined && (
                <TrendIndicator current={acos} previous={Number(record.prevAcos)} isInverted={true} />
              )}
            </div>
          );
        }
      },
      {
        title: 'ROAS',
        dataIndex: 'roas',
        key: 'roas',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.roas || 0) - Number(b.roas || 0),
        render: (val, record) => {
          const roas = Number(val || 0);
          const color = roas > 3 ? '#2E7D32' : roas > 2 ? '#ED6C02' : '#C62828';
          return (
            <div>
              <Text style={{ fontSize: 12, fontWeight: 600, color }}>{roas.toFixed(2)}</Text>
              {record.prevRoas !== undefined && (
                <TrendIndicator current={roas} previous={Number(record.prevRoas)} />
              )}
            </div>
          );
        }
      },
      {
        title: 'Orders',
        dataIndex: 'orders',
        key: 'orders',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.orders || 0) - Number(b.orders || 0),
        render: (val, record) => <MetricCell value={val} prevValue={record.prevOrders} />
      },
      {
        title: 'CTR',
        dataIndex: 'ctr',
        key: 'ctr',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.ctr || 0) - Number(b.ctr || 0),
        render: (val) => <Text style={{ fontSize: 12, fontWeight: 500 }}>{Number(val || 0).toFixed(2)}%</Text>
      },
      {
        title: 'CVR',
        dataIndex: 'cvr',
        key: 'cvr',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.cvr || 0) - Number(b.cvr || 0),
        render: (val) => <Text style={{ fontSize: 12, fontWeight: 500 }}>{Number(val || 0).toFixed(2)}%</Text>
      },
      {
        title: 'Clicks',
        dataIndex: 'clicks',
        key: 'clicks',
        width: 80,
        align: 'right',
        sorter: (a, b) => Number(a.clicks || 0) - Number(b.clicks || 0),
        render: (val) => formatValue(val)
      },
      {
        title: 'Impressions',
        dataIndex: 'impressions',
        key: 'impressions',
        width: 100,
        align: 'right',
        sorter: (a, b) => Number(a.impressions || 0) - Number(b.impressions || 0),
        render: (val) => formatValue(val)
      },
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

    return baseColumns;
  }, []);

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
          children: []
        };
      }
      parentMap[parentAsin].childCount++;
      parentMap[parentAsin].children.push(row);
      
      // Aggregate metrics
      const parent = parentMap[parentAsin];
      parent.spend = (Number(parent.spend) || 0) + (Number(row.spend) || 0);
      parent.sales = (Number(parent.sales) || 0) + (Number(row.sales) || 0);
      parent.orders = (Number(parent.orders) || 0) + (Number(row.orders) || 0);
      parent.clicks = (Number(parent.clicks) || 0) + (Number(row.clicks) || 0);
      parent.impressions = (Number(parent.impressions) || 0) + (Number(row.impressions) || 0);
    });

    // Calculate parent averages
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
      <Table
        columns={columns.filter(c => c.key !== 'product' && c.key !== 'actions')}
        dataSource={record.children.map((child, idx) => ({ ...child, key: `${record.asin}-child-${idx}` }))}
        pagination={false}
        size="small"
        style={{ background: '#fafafa', borderRadius: 8 }}
        rowClassName={() => 'child-row'}
      />
    );
  };

  return (
    <Table
      columns={columns}
      dataSource={tableData.map((row, idx) => ({ ...row, key: row.asin || idx }))}
      loading={loading}
      pagination={{ 
        pageSize: 25, 
        showSizeChanger: true, 
        pageSizeOptions: ['25', '50', '100'],
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
        size: 'small'
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

export default AdsTable;
