import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, MoreVertical, LayoutGrid, CheckSquare, Square } from 'lucide-react';

const ListView = ({
    columns = [],
    rows = [],
    groupBy = null,
    rowKey = '_id',
    options = {},
    renderGroupHeader = null,
    renderCell = null,
    onRowClick = null,
    actions = null,
    emptyMessage = "No records found"
}) => {
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const [selectedRows, setSelectedRows] = useState(new Set());

    // Grouping logic
    const groupedRows = useMemo(() => {
        if (!groupBy) return [{ group: null, rows }];

        const groups = rows.reduce((acc, row) => {
            const key = typeof groupBy === 'function' ? groupBy(row) : row[groupBy];
            const groupKey = key || 'Unassigned';
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(row);
            return acc;
        }, {});

        return Object.entries(groups).map(([group, rows]) => ({
            group,
            rows
        }));
    }, [rows, groupBy]);

    const toggleGroup = (group) => {
        const newCollapsed = new Set(collapsedGroups);
        if (newCollapsed.has(group)) {
            newCollapsed.delete(group);
        } else {
            newCollapsed.add(group);
        }
        setCollapsedGroups(newCollapsed);
    };

    const toggleRowSelection = (e, id) => {
        e.stopPropagation();
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const toggleAllInGroup = (e, groupRows) => {
        e.stopPropagation();
        const groupIds = groupRows.map(r => r[rowKey]);
        const allSelected = groupIds.every(id => selectedRows.has(id));

        const newSelected = new Set(selectedRows);
        if (allSelected) {
            groupIds.forEach(id => newSelected.delete(id));
        } else {
            groupIds.forEach(id => newSelected.add(id));
        }
        setSelectedRows(newSelected);
    };

    return (
        <div className="list-view-container w-100 overflow-hidden" style={{ borderRadius: '12px' }}>
            {/* Header */}
            <div className="list-view-header d-flex align-items-center bg-white border-bottom px-4 py-2 sticky-top" style={{ zIndex: 10 }}>
                {options.selectable && <div style={{ width: '40px' }} />}
                {columns.map((col, idx) => (
                    <div
                        key={idx}
                        className="smallest fw-bold text-muted text-uppercase"
                        style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
                    >
                        {col.label}
                    </div>
                ))}
                {actions && <div style={{ width: '80px' }} />}
            </div>

            {/* Content */}
            <div className="list-view-body bg-white">
                {groupedRows.length === 0 ? (
                    <div className="p-5 text-center text-muted">
                        <div className="mb-2"><LayoutGrid size={32} className="opacity-25" /></div>
                        <div className="small fw-bold">{emptyMessage}</div>
                    </div>
                ) : (
                    groupedRows.map(({ group, rows: groupRows }, gIdx) => (
                        <div key={gIdx} className="list-group-section">
                            {group !== null && (
                                <div
                                    className="list-group-header d-flex align-items-center px-4 py-2 bg-light bg-opacity-50 cursor-pointer border-bottom"
                                    onClick={() => toggleGroup(group)}
                                >
                                    <div className="me-2 text-muted">
                                        {collapsedGroups.has(group) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                    {options.selectable && (
                                        <div
                                            className="me-3 text-primary cursor-pointer"
                                            onClick={(e) => toggleAllInGroup(e, groupRows)}
                                        >
                                            {groupRows.every(r => selectedRows.has(r[rowKey])) ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </div>
                                    )}
                                    <div className="flex-grow-1">
                                        {renderGroupHeader ? renderGroupHeader({ group, rows: groupRows }) : (
                                            <span className="text-base font-medium leading-6 text-dark">
                                                {group} <span className="text-muted small">({groupRows.length})</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!collapsedGroups.has(group) && groupRows.map((row, rIdx) => (
                                <div
                                    key={row[rowKey] || rIdx}
                                    className={`list-row d-flex align-items-center px-4 py-3 border-bottom hover-bg-light transition-all cursor-pointer ${selectedRows.has(row[rowKey]) ? 'bg-primary-subtle bg-opacity-10' : ''}`}
                                    onClick={() => onRowClick && onRowClick(row)}
                                >
                                    {options.selectable && (
                                        <div
                                            className="me-3 text-primary"
                                            onClick={(e) => toggleRowSelection(e, row[rowKey])}
                                        >
                                            {selectedRows.has(row[rowKey]) ? <CheckSquare size={16} /> : <Square size={16} className="opacity-25" />}
                                        </div>
                                    )}

                                    {columns.map((col, cIdx) => (
                                        <div
                                            key={cIdx}
                                            className="list-cell overflow-hidden text-truncate"
                                            style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
                                        >
                                            {renderCell ? renderCell(row, col) : (
                                                col.render ? col.render(row[col.key], row) : row[col.key]
                                            )}
                                        </div>
                                    ))}

                                    {actions && (
                                        <div className="list-actions d-flex justify-content-end gap-1" style={{ width: '80px' }} onClick={e => e.stopPropagation()}>
                                            {actions(row)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .hover-bg-light:hover { background-color: #f8fafc; }
                .list-view-container { border: 1px solid #e2e8f0; }
                .list-row:last-child { border-bottom: none; }
                .transition-all { transition: all 0.2s ease; }
            `}</style>
        </div>
    );
};

export default ListView;
