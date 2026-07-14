import React, { useState, useMemo, Suspense, lazy } from 'react';
import { Button, Tooltip, Typography, Spin } from 'antd';
import {
  ChevronDown, ChevronRight, ChevronLeft,
  Eye, Package, TrendingUp, TrendingDown, Activity,
  BarChart3, Target, RefreshCw, Eye as EyeIcon,
  FileBarChart, Layers, TrendingUp as TrendUpIcon
} from 'lucide-react';

const { Text } = Typography;
const TablePagination = lazy(() => import('@mui/material/TablePagination'));

const formatCompact = (val) => {
  if (typeof val !== 'number') return '0.00';
  if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(2) + 'K';
  return val.toFixed(2);
};

const normalizeDateStr = (dateInput) => {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      if (typeof dateInput === 'string') return dateInput.substring(0, 10);
      return '';
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch (e) { return ''; }
};

const MiniSpark = ({ data, color }) => {
  if (!data || data.length < 2) return <div style={{ width: '100%', height: 12 }} />;
  const max = Math.max(...data) || 1;
  return (
    <div style={{ width: '100%', height: 14, overflow: 'hidden', opacity: 0.8 }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polyline fill="none" stroke={color} strokeWidth="8"
          points={data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v / max) * 90)}`).join(' ')} />
      </svg>
    </div>
  );
};

const AdsTable = ({
  data = [],
  loading,
  groupBy = 'asin',
  pagination = { page: 1, limit: 50, total: 0, totalPages: 0 },
  sortBy = 'sales',
  sortOrder = 'desc',
  selectedSeller = '',
  activeDates = [],
  expandedCols = {},
  expandedParents = new Set(),
  onSort,
  onPageChange,
  onPageSizeChange,
  onExpandCol,
  onExpandParent,
  onSetActiveHistoryRow
}) => {
  const toggleCol = onExpandCol || (() => {});
  const toggleParentExpand = onExpandParent || (() => {});

  const getTransitionStyle = (isExpanded, index, total, width = '56px') => ({
    width: isExpanded ? width : '0px',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    opacity: isExpanded ? 1 : 0,
    padding: isExpanded ? '6px' : '0px'
  });

  const buildMetricGroup = (title, key, icon, isCurrency = false, isPercent = false) => {
    const isExpanded = expandedCols[key];
    const avgWidth = 64;
    const trendWidth = 50;
    const dateWidth = 56;

    const children = [
      {
        title: <span style={{ fontSize: 8, fontWeight: 600, color: '#64748b' }}>AVG</span>,
        key, dataIndex: key, width: avgWidth, align: 'right', sorter: true,
        sortOrder: sortBy === key ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
        render: (val, record) => {
          const numVal = Number(val || 0);
          const formattedVal = isCurrency ? `₹${numVal.toLocaleString('en-IN')}` : isPercent ? `${numVal.toFixed(2)}%` : numVal.toLocaleString();
          return <span style={{ fontSize: 10.5, fontWeight: 600, color: '#0f172a' }}>{formattedVal}</span>;
        }
      },
      {
        title: <span style={{ fontSize: 8, fontWeight: 600, color: '#64748b' }}>TREND</span>,
        key: `${key}_trn`, width: trendWidth, align: 'center',
        render: (_, record) => {
          const history = record.weekHistory || record.history || [];
          if (history.length === 0) return <span style={{ color: '#cbd5e1' }}>-</span>;
          const values = history.map(h => Number(h[key] || 0));
          if (values.every(v => v === 0)) return <span style={{ color: '#cbd5e1' }}>-</span>;
          const isGood = key === 'acos' ? values[values.length - 1] < values[0] : values[values.length - 1] > values[0];
          return <div style={{ width: 40, margin: 'auto' }}><MiniSpark data={values} color={isGood ? '#2E7D32' : '#D32F2F'} /></div>;
        }
      }
    ];

    if (isExpanded) {
      activeDates.forEach(d => {
        children.push({
          title: <div style={{ textAlign: 'center', fontSize: 9, lineHeight: 1.1 }}><div style={{ color: '#94a3b8' }}>{d.month}</div><div style={{ fontWeight: 600, color: '#475569' }}>{d.day}</div></div>,
          key: `${key}_${d.raw}`, width: dateWidth, align: 'right',
          render: (_, record) => {
            const hist = record.weekHistory?.find(h => normalizeDateStr(h.date) === d.raw);
            const val = hist ? (hist[key] || 0) : 0;
            if (val === 0) return <span style={{ color: '#cbd5e1' }}>-</span>;
            return <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>
              {isCurrency ? `₹${val.toLocaleString('en-IN')}` : isPercent ? `${val.toFixed(2)}%` : val.toLocaleString()}
            </span>;
          }
        });
      });
    }

    return {
      title: (
        <div onClick={() => toggleCol(key)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          cursor: 'pointer', padding: '4px 8px', borderRadius: "var(--radius-sm)",
          background: '#f8fafc', border: '1px solid #e5e7eb',
          color: '#475569', transition: 'all 0.15s', minWidth: avgWidth + trendWidth
        }}>
          {icon}
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.03em' }}>{title}</span>
          {isExpanded ? <ChevronLeft size={9} /> : <ChevronRight size={9} />}
        </div>
      ),
      width: avgWidth + trendWidth + (activeDates.length * dateWidth),
      children
    };
  };

  const getColumns = useMemo(() => {
    const cols = [
      {
        title: 'IMAGE', dataIndex: 'imageUrl', key: 'imageUrl', width: 48, fixed: 'left',
        render: (url, record) => (
          <div style={{ width: 36, height: 36, margin: 'auto', background: '#f8fafc', borderRadius: "var(--radius-sm)", border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onClick={() => onSetActiveHistoryRow?.(record)}>
            {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={14} style={{ color: '#cbd5e1' }} />}
          </div>
        )
      },
      {
        title: 'ASIN / PARENT', key: 'identifier', width: 155, fixed: 'left',
        render: (_, record) => {
          const isParentRow = record.isParent === true || record.isParentView === true;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => onSetActiveHistoryRow?.(record)}>
              {isParentRow && (
                <div onClick={(e) => { e.stopPropagation(); toggleParentExpand(record.asin || record.parentAsin); }}
                  style={{ width: 18, height: 18, borderRadius: "var(--radius-sm)", background: '#f1f5f9', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  {expandedParents.has(record.asin || record.parentAsin) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
              )}
              <div>
                <Text strong code style={{ fontSize: 10, color: '#0f172a', padding: '1px 4px' }}>{record.asin || record.parentAsin}</Text>
                {isParentRow && <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', background: '#f1f5f9', border: '1px solid #e5e7eb', padding: '1px 6px', borderRadius: "var(--radius-sm)", width: 'fit-content', marginTop: 2 }}>{record.childCount || 0} CHILDREN</div>}
              </div>
            </div>
          );
        }
      },
      {
        title: 'SKU', dataIndex: 'sku', key: 'sku', width: 80, fixed: 'left',
        render: (sku, record) => record.isParent || record.isParentView
          ? <span style={{ fontSize: 9, fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: "var(--radius-sm)" }}>GROUP</span>
          : <span style={{ fontWeight: 600, color: '#475569', fontSize: 10 }}>{sku || '-'}</span>
      },
      {
        title: 'PRODUCT DETAILS', key: 'productDetails', width: 170, fixed: 'left',
        render: (_, record) => (
          <Tooltip title={<div><div style={{ fontWeight: 600, marginBottom: 4 }}>{record.title || 'Loading...'}</div>{record.brand && <div style={{ fontSize: 11, color: '#cbd5e1' }}>{record.brand}{record.category ? ` · ${record.category}` : ''}</div>}</div>}>
            <div style={{ width: '100%', overflow: 'hidden' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.title || 'Loading...'}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.brand || ''}{record.brand && record.category ? ' · ' : ''}{record.category || ''}</div>
            </div>
          </Tooltip>
        )
      },
      buildMetricGroup('TOTAL SALES', 'totalSales', <FileBarChart size={11} />, true, false),
      buildMetricGroup('ORDERS', 'orders', <Layers size={11} />, false, false),
      buildMetricGroup('SPEND', 'spend', <BarChart3 size={11} />, true, false),
      buildMetricGroup('CLICKS', 'clicks', <TrendUpIcon size={11} />, false, false),
      buildMetricGroup('IMPRESSIONS', 'impressions', <Eye size={11} />, false, false),
      buildMetricGroup('ROAS', 'roas', <RefreshCw size={11} />, false, false),
      buildMetricGroup('ACOS', 'acos', <Target size={11} />, false, true),
      buildMetricGroup('TACOS', 'tacos', <Target size={11} />, false, true),
      buildMetricGroup('AD SALES', 'sales', <FileBarChart size={11} />, true, false),
      buildMetricGroup('AD SALES %', 'adSalesPct', <Layers size={11} />, false, true),
      buildMetricGroup('CVR', 'cvr', <Activity size={11} />, false, true),
      buildMetricGroup('ORGANIC', 'organicSales', <BarChart3 size={11} />, true, false),
      buildMetricGroup('VIEWS', 'pageViews', <Eye size={11} />, false, false),
      {
        title: 'ACTIONS', key: 'actions', fixed: 'right', width: 48, align: 'center',
        render: (_, record) => (
          <Tooltip title="View Details">
            <Button type="text" size="small" icon={<Eye size={13} />}
              onClick={(e) => { e.stopPropagation(); onSetActiveHistoryRow?.(record); }} />
          </Tooltip>
        )
      }
    ];
    return cols;
  }, [activeDates, expandedCols, expandedParents, sortBy, sortOrder, toggleCol, toggleParentExpand, onSetActiveHistoryRow]);

  const tableColumns = useMemo(() => getColumns, [activeDates, data, expandedCols, expandedParents, selectedSeller]);

  const { rows: hRows, stickyLeft, stickyRight } = useMemo(() => {
    const depth = (cols) => { let max = 0; for (const col of cols) { if (col.children?.length > 0) max = Math.max(max, depth(col.children)); } return max + 1; };
    const leafColumns = (cols) => { const r = []; for (const col of cols) { if (col.children?.length > 0) r.push(...leafColumns(col.children)); else r.push(col); } return r; };
    const buildRows = (cols) => {
      const d = depth(cols);
      const rows = Array.from({ length: d }, () => []);
      const walk = (arr, level) => {
        for (const col of arr) {
          if (col.children?.length > 0) {
            const leafCount = leafColumns(col.children).length;
            rows[level].push({ ...col, colSpan: leafCount, rowSpan: 1, isGroup: true });
            walk(col.children, level + 1);
          } else {
            rows[level].push({ ...col, colSpan: 1, rowSpan: d - level });
          }
        }
      };
      walk(cols, 0);
      return rows;
    };
    const rows = buildRows(tableColumns);
    const stickyLeft = {}, stickyRight = {};
    let leftAcc = 0, rightAcc = 0;
    for (const col of tableColumns) {
      if (col.fixed === 'left') { stickyLeft[col.key] = leftAcc; leftAcc += col.width || 0; }
      if (col.fixed === 'right') { stickyRight[col.key] = rightAcc; rightAcc += col.width || 0; }
    }
    return { rows, stickyLeft, stickyRight };
  }, [tableColumns]);

  const leafCols = useMemo(() => {
    const result = [];
    for (const col of tableColumns) {
      if (col.children?.length > 0) {
        result.push(...col.children);
      } else {
        result.push(col);
      }
    }
    return result;
  }, [tableColumns]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%', background: '#ffffff', overflow: 'hidden', position: 'relative' }}>
      <Spin spinning={loading} tip="Loading data..." size="large" style={{ maxHeight: 'none' }}>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: data.length === 0 ? 300 : 'auto' }}>
          {data.length === 0 ? (
            <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              {!loading && (
                <>
                  <Package size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>No ads data found</span>
                </>
              )}
            </div>
          ) : (
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                {hRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((col) => {
                      const s = {
                        fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.04em', color: 'var(--text-secondary)', padding: '6px 6px',
                        background: '#f8fafc', position: 'sticky', top: 0,
                        border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
                        ...(col.align === 'center' ? { textAlign: 'center' } : col.align === 'right' ? { textAlign: 'right' } : {}),
                      };
                      if (col.width) s.width = col.width;
                      if (stickyLeft[col.key] !== undefined) { s.left = stickyLeft[col.key]; s.zIndex = ri === 0 ? 22 : 17; s.background = '#f8fafc'; }
                      if (stickyRight[col.key] !== undefined) { s.right = stickyRight[col.key]; s.zIndex = ri === 0 ? 22 : 17; s.background = '#f8fafc'; if (ri === 0) s.borderLeft = '1px solid #d1d5db'; }
                      let titleContent = col.title;
                      if (!col.isGroup && col.sorter) {
                        const isActive = sortBy === col.key;
                        titleContent = (
                          <div onClick={() => onSort?.(col.key)} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'space-between', gap: 3 }}>
                            <span>{col.title}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '7px', lineHeight: 1, opacity: isActive ? 1 : 0.4 }}>
                              <ChevronUp size={8} strokeWidth={4} style={{ color: isActive && sortOrder === 'asc' ? '#1890ff' : '#8c8c8c', marginBottom: '0px' }} />
                              <ChevronDown size={8} strokeWidth={4} style={{ color: isActive && sortOrder === 'desc' ? '#1890ff' : '#8c8c8c' }} />
                            </div>
                          </div>
                        );
                      }
                      return <th key={col.key} colSpan={col.colSpan} rowSpan={col.rowSpan} style={s}>{titleContent}</th>;
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {data.map((record, idx) => (
                  <tr key={record.id || record.asin || idx} className="table-row-hover">
                    {leafCols.map((col) => {
                      const val = col.dataIndex ? record[col.dataIndex] : undefined;
                      const rendered = col.render ? col.render(val, record, idx) : (val ?? '');
                      const isFixed = stickyLeft[col.key] !== undefined || stickyRight[col.key] !== undefined;
                      const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                      const s = {
                        padding: '2px 5px', fontSize: '0.65rem',
                        border: '1px solid #f0f0f0', verticalAlign: 'middle',
                        color: '#27272a', background: bg,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        ...(col.align === 'center' ? { textAlign: 'center' } : col.align === 'right' ? { textAlign: 'right' } : {}),
                      };
                      if (isFixed && col.width) { s.minWidth = col.width; s.maxWidth = col.width; }
                      if (stickyLeft[col.key] !== undefined) { s.position = 'sticky'; s.left = stickyLeft[col.key]; s.zIndex = 5; s.background = bg; }
                      if (stickyRight[col.key] !== undefined) { s.position = 'sticky'; s.right = stickyRight[col.key]; s.zIndex = 5; s.background = bg; }
                      return <td key={col.key} style={s}>{rendered}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Spin>
      <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
        <Suspense fallback={<div style={{ height: 40, background: '#f1f5f9' }} />}>
          <TablePagination
            component="div"
            count={pagination.total || 0}
            page={(pagination.page || 1) - 1}
            onPageChange={(e, newPage) => onPageChange?.(newPage + 1)}
            rowsPerPage={pagination.limit || 50}
            onRowsPerPageChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[25, 50, 100, 200, 500]}
            sx={{
              fontSize: 'var(--font-size-xs)', minHeight: '36px',
              '.MuiToolbar-root': { minHeight: '36px', height: '36px', paddingLeft: '12px', paddingRight: '12px' },
              '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 },
              '.MuiTablePagination-select': { fontSize: 'var(--font-size-xs)', fontWeight: 600 },
              '.MuiTablePagination-actions': { marginLeft: '8px', '& .MuiIconButton-root': { padding: '4px' } }
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default AdsTable;
