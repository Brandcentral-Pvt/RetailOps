import React, { Suspense, lazy } from 'react';

const TablePagination = lazy(() => import('@mui/material/TablePagination'));

// Verbatim extraction from src/pages/AsinManagerPage.jsx (pagination footer region).
const TablePaginationFooter = ({
  viewMode,
  parentPagination,
  pagination,
  setParentPagination,
  loadParentData,
  handleChangePage,
  handleChangeRowsPerPage,
}) => {
    return (
          <div style={{
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)',
            flexShrink: 0
          }}>
            <Suspense fallback={<div className="h-10 w-full animate-pulse bg-zinc-100" />}>
              <TablePagination
                component="div"
                count={viewMode === 'parent' ? (parentPagination.total || 0) : (pagination.total || 0)}
                page={(viewMode === 'parent' ? (parentPagination.page || 1) : (pagination.page || 1)) - 1}
                onPageChange={viewMode === 'parent' 
                  ? (_, newPage) => { const pg = newPage + 1; setParentPagination(p => ({ ...p, page: pg })); loadParentData(pg, parentPagination.limit); }
                  : handleChangePage
                }
                rowsPerPage={viewMode === 'parent' ? (parentPagination.limit || 50) : (pagination.limit || 25)}
                onRowsPerPageChange={viewMode === 'parent'
                  ? (e) => { const newLimit = parseInt(e.target.value); setParentPagination(p => ({ ...p, page: 1, limit: newLimit })); loadParentData(1, newLimit); }
                  : handleChangeRowsPerPage
                }
                rowsPerPageOptions={[25, 50, 100, 200]}
                sx={{
                  fontSize: 'var(--font-size-xs)',
                  minHeight: '36px',
                  '.MuiToolbar-root': {
                    minHeight: '36px',
                    height: '36px',
                    paddingLeft: '12px',
                    paddingRight: '12px'
                  },
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    margin: 0
                  },
                  '.MuiTablePagination-select': {
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600
                  },
                  '.MuiTablePagination-actions': {
                    marginLeft: '8px',
                    '& .MuiIconButton-root': {
                      padding: '4px'
                    }
                  }
                }}
              />
            </Suspense>
          </div>
    );
};

export default TablePaginationFooter;
