import React, { memo } from 'react';
import { Button, Tooltip, Dropdown, Menu, Modal, Segmented, Input, ListChecks, LayoutGrid, Download, RefreshCw, ChevronDown, ChevronUp, Zap, Sparkles, FileUp, Plus, MoreVertical, Trash2, Tag, RefreshCw as RefreshCwIcon, AlertTriangle, TrendingDown, Star, PlayCircle, PlusCircle, ChevronsUp, Rows3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const DENSITY_ORDER = ['compact', 'comfortable', 'roomy'];
const DENSITY_LABELS = { compact: 'Compact', comfortable: 'Comfortable', roomy: 'Roomy' };

export const Toolbar = memo(function Toolbar({
  // State
  showDashboard,
  setShowDashboard,
  marketplaceOptions,
  activeMarketplace,
  setMarketplaceFilter,
  searchQuery,
  setSearchQuery,
  handleApplySearch,
  selectedSeller,
  setSelectedSeller,
  loadData,
  pagination,
  filterPanelOpen,
  setFilterPanelOpen,
  showColumnPanel,
  setShowColumnPanel,
  appliedFilterCount,
  rowDensity,
  cycleRowDensity,
  selectedIds,
  selectableRows,
  handleToggleSelectAll,
  syncing,
  handleBulkScrape,
  handleOpenTaskModal,
  handleRecalculateLQS,
  showBulkImportModal,
  setShowBulkImportModal,
  showAddModal,
  setShowAddModal,
  showExportModal,
  setShowExportModal,
  viewMode,
  setViewMode,
  expandedCount,
  collapseAll,
  loading,
  scrapeProgress,
  // Permissions
  hasPermission,
  // Filter options for quick filters
  appliedFilters,
  setAppliedFilters,
  setFilters,
  setFilterTrigger,
  // Actions
  handleBulkPriceDispute,
  handleRunRulesets,
  handleSelectedCreateActions,
  handleAiListingAnalysis,
  handleBulkSyncSelected,
  setShowBulkTagsModal,
  aiAnalysisLoading,
  clearSelection,
}) => {
  const { isAdmin } = useAuth();

  const marketplaceSwitcher = (
    <Segmented
      className="marketplace-switch"
      aria-label="Marketplace"
      value={activeMarketplace}
      onChange={(val) => {
        setMarketplaceFilter(val);
        loadData(1, pagination.limit, selectedSeller, val);
      }}
      options={marketplaceOptions}
    />
  );

  const actionsMenu = (
    <Menu
      items={[
        {
          key: 'filters-grp',
          type: 'group',
          label: 'QUICK FILTERS',
          children: [
            {
              key: 'price-dispute',
              label: appliedFilters.priceDispute === 'true' ? 'Show All Products' : 'Show Dispute Only',
              icon: <AlertTriangle size={14} className={appliedFilters.priceDispute === 'true' ? "text-amber-600" : "text-amber-400"} />,
              onClick: () => {
                const newFilters = { ...appliedFilters, priceDispute: appliedFilters.priceDispute === 'true' ? '' : 'true' };
                setAppliedFilters(newFilters);
                setFilters(newFilters);
                setFilterTrigger(t => t + 1);
              },
            },
            {
              key: 'bsr-trend',
              label: appliedFilters.bsrTrend === 'Down' ? 'Clear BSR Filter' : 'Show Falling BSR',
              icon: <TrendingDown size={14} className={appliedFilters.bsrTrend === 'Down' ? "text-rose-600" : "text-rose-400"} />,
              onClick: () => {
                const newFilters = { ...appliedFilters, bsrTrend: appliedFilters.bsrTrend === 'Down' ? '' : 'Down' };
                setAppliedFilters(newFilters);
                setFilters(newFilters);
                setFilterTrigger(t => t + 1);
              },
            },
            {
              key: 'rating-trend',
              label: appliedFilters.ratingTrend === 'Down' ? 'Clear Rating Filter' : 'Show Falling Ratings',
              icon: <Star size={14} className={appliedFilters.ratingTrend === 'Down' ? "text-amber-600" : "text-amber-400"} />,
              onClick: () => {
                const newFilters = { ...appliedFilters, ratingTrend: appliedFilters.ratingTrend === 'Down' ? '' : 'Down' };
                setAppliedFilters(newFilters);
                setFilters(newFilters);
                setFilterTrigger(t => t + 1);
              },
            },
          ],
        },
        { type: 'divider' },
        {
          key: 'views-grp',
          type: 'group',
          label: 'QUICK VIEWS',
          children: [
            {
              key: 'bsr-matrix',
              label: 'BSR Ranking Matrix',
              icon: <BarChart2 size={14} />,
            },
            {
              key: 'rating-analytics',
              label: 'Rating Analytics',
              icon: <LayoutGrid size={14} />,
            },
          ],
        },
        { type: 'divider' },
        {
          key: 'bulk-grp',
          type: 'group',
          label: (
            <div className="d-flex justify-content-between align-items-center w-100">
              <span>BULK ACTIONS</span>
              {selectedIds.size === 0 && <Tag style={{ fontSize: '9px', borderRadius: 'var(--radius-sm)' }}>SELECT ROWS</Tag>}
            </div>
          ),
          children: [
            {
              key: 'mark-dispute',
              label: 'Mark as Price Dispute',
              icon: <AlertTriangle size={14} className="text-amber-500" />,
              disabled: selectedIds.size === 0,
              onClick: () => handleBulkPriceDispute(true),
            },
            {
              key: 'resolve-dispute',
              label: 'Resolve Dispute',
              icon: <RefreshCwIcon size={14} className="text-emerald-500" />,
              disabled: selectedIds.size === 0,
              onClick: () => handleBulkPriceDispute(false),
            },
            {
              key: 'run-rulesets',
              label: 'Run Rulesets on Selected',
              icon: <PlayCircle size={14} />,
              disabled: selectedIds.size === 0,
              onClick: handleRunRulesets,
            },
            {
              key: 'create-task',
              label: 'Create Task for Selected',
              icon: <PlusCircle size={14} className="text-emerald-500" />,
              disabled: selectedIds.size === 0,
              onClick: handleOpenTaskModal,
            },
          ],
        },
      ]}
    />
  );

  return (
    <div className="toolbar border-bottom bg-white">
      <div className="toolbarLeft d-flex align-items-center gap-2">
        <span className="inventoryLabel text-uppercase d-flex align-items-center gap-1">
          Inventory
          <span className="bg-light border text-secondary px-1.5 rounded-pill fw-semibold" style={{ fontSize: '10px', lineHeight: '18px' }}>
            {pagination.total.toLocaleString()}
          </span>
          <button
            type="button"
            className="collapseToggle btn btn-ghost p-0 ms-1 rounded-circle text-secondary d-flex align-items-center justify-content-center"
            onClick={() => setShowDashboard(!showDashboard)}
            aria-label={showDashboard ? 'Collapse Overview' : 'Expand Overview'}
            aria-expanded={showDashboard}
            title={showDashboard ? 'Collapse Overview' : 'Expand Overview'}
          >
            {showDashboard ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </span>

        {marketplaceOptions.length > 0 && marketplaceSwitcher}

        <Input.Search
          placeholder="Search ASIN, SKU, Title..."
          aria-label="Search ASINs"
          enterButton="Find"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={handleApplySearch}
          className="searchInput"
        />
        <div className="sellerSelectWrapper">
          <InfiniteScrollSelect
            fetchData={async (page = 1, search = '') => {
              try {
                const { sellerApi } = await import('../../services/api');
                const params = { page, limit: 1000, search };
                const response = await sellerApi.getAll(params);
                if (response.success) {
                  return { data: response.data.sellers || [], hasMore: response.data.pagination.page < response.data.pagination.totalPages };
                }
                return { data: [], hasMore: false };
              } catch (err) {
                console.error('Error fetching sellers for dropdown:', err);
                return { data: [], hasMore: false };
              }
            }}
            value={selectedSeller}
            onSelect={(val) => {
              setSelectedSeller(val);
              loadData(1, pagination.limit, val);
            }}
            placeholder="All Sellers"
          />
        </div>

        <Dropdown menu={actionsMenu} trigger={['click']} placement="bottomRight">
          <Button icon={<MoreVertical size={14} />} aria-label="More actions" className="toolbarButton d-flex align-items-center gap-1 shadow-sm">
            <span className="btnLabel">Actions</span>
          </Button>
        </Dropdown>

        {scrapeProgress && (
          <div className="progressChip bg-light border rounded-2 px-2 d-flex align-items-center gap-2">
            <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 12, color: 'var(--text-danger)' }} aria-hidden="true" />
            <span className="fw-bold font-monospace small" style={{ color: 'var(--text-primary)' }}>{scrapeProgress.processed}/{scrapeProgress.total}</span>
          </div>
        )}

        <div className="toolbarSpacer" />

        <div className="toolbarActions d-flex align-items-center gap-2">
          <Segmented
            className="viewModeSwitch"
            aria-label="Rows shown"
            value={viewMode}
            onChange={(val) => setViewMode(val)}
            options={[{ label: 'ASINs', value: 'asin' }, { label: 'Parents', value: 'parent' }]}
          />

          <Button
            icon={syncing ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 14 }} aria-hidden="true" /> : <RefreshCwIcon size={14} />}
            onClick={handleBulkScrape}
            disabled={syncing}
            aria-label="Sync marketplace data"
            className="toolbarButton d-flex align-items-center gap-2 shadow-sm"
          >
            <span className="btnLabel">Sync</span>
          </Button>

          {hasPermission('asinmanager_manage') && (
            <Tooltip title="Auto-tag: Pareto 80/20, Top 20 By GMS, Price Dispute, Age tags">
              <Button
                icon={<Sparkles size={14} />}
                onClick={async () => {
                  try {
                    const { message } = await import('antd');
                    const { asinApi } = await import('../../services/api');
                    message.loading({ content: 'Running auto-tags...', key: 'auto-tags' });
                    const res = await asinApi.runAutoTags();
                    if (res.success) {
                      const d = res.data || {};
                      const pareto = d.pareto || {};
                      const top20 = d.top20ByGms || {};
                      const pd = d.priceDispute || {};
                      const age = d.ageTags || {};
                      message.success({
                        content: `Auto-tags done. Pareto: ${pareto.updated || 0} | Top20: ${top20.updated || 0} | PriceDispute: ${pd.updated || 0} | Age: ${age.updated || 0}`,
                        key: 'auto-tags',
                        duration: 5,
                      });
                      loadData(pagination.page);
                    }
                  } catch (err) {
                    const { message } = await import('antd');
                    message.error({ content: 'Auto-tags failed: ' + err.message, key: 'auto-tags', duration: 4 });
                  }
                }}
                aria-label="Run auto-tags"
                className="toolbarButton d-flex align-items-center gap-2 shadow-sm"
              >
                <span className="btnLabel">Auto Tags</span>
              </Button>
            </Tooltip>
          )}

          <Button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            type={filterPanelOpen ? 'primary' : 'default'}
            icon={<ListChecks size={14} />}
            aria-label={`Filters${appliedFilterCount > 0 ? ` (${appliedFilterCount})` : ''}`}
            className="toolbarButton d-flex align-items-center gap-2 shadow-sm"
          >
            <span className="btnLabel">
              Filters{appliedFilterCount > 0 ? ` (${appliedFilterCount})` : ''}
            </span>
            {appliedFilterCount > 0 && <span className="btnBadge">{appliedFilterCount}</span>}
          </Button>

          <div className="position-relative">
            <Button
              onClick={() => setShowColumnPanel(!showColumnPanel)}
              type={showColumnPanel ? 'primary' : 'default'}
              icon={<LayoutGrid size={14} />}
              aria-label="Columns"
              className="toolbarButton d-flex align-items-center gap-2 shadow-sm"
            >
              <span className="btnLabel">Columns</span>
            </Button>
          </div>

          <Tooltip title={`Row density: ${rowDensity}`} placement="top">
            <Button
              onClick={cycleRowDensity}
              type="default"
              icon={<Rows3 size={14} />}
              aria-label={`Row density: ${DENSITY_LABELS[rowDensity]}`}
              className="toolbarButton d-flex align-items-center gap-2 shadow-sm"
            >
              <span className="btnLabel">{DENSITY_LABELS[rowDensity]}</span>
            </Button>
          </Tooltip>

          <div className="toolbarDivider vr mx-1 text-secondary opacity-25" style={{ height: '20px' }} />

          {hasPermission('asinmanager_manage') && (
            <Tooltip title="Bulk Optimization">
              <Button
                onClick={async () => {
                  try {
                    const { message } = await import('antd');
                    const { db } = await import('../../services/db');
                    const totalCount = pagination.total;
                    const confirmed = await new Promise(resolve => {
                      const { Modal } = await import('antd');
                      Modal.confirm({
                        title: 'Confirm',
                        content: `Auto-generate optimization tasks for ALL ${totalCount} ASINs? This will analyze every ASIN in the current filter.`,
                        onOk: () => resolve(true),
                        onCancel: () => resolve(false),
                      });
                    });
                    if (!confirmed) return;
                    message.loading({ content: 'Analyzing all ASINs...', key: 'bulk-opt' });
                    const res = await db.createBulkActionsFromAnalysis();
                    if (res && res.count > 0) {
                      message.success({ content: `✅ Successfully generated ${res.count} bulk optimization tasks!`, key: 'bulk-opt', duration: 5 });
                    } else if (res && res.success === false) {
                      message.error({ content: `❌ Error: ${res.message || 'Failed to create tasks'}`, key: 'bulk-opt', duration: 5 });
                    } else {
                      message.info({ content: 'Analysis complete. All ASINs look good! No optimization actions needed.', key: 'bulk-opt', duration: 4 });
                    }
                  } catch (err) {
                    const { message } = await import('antd');
                    message.error({ content: 'Failed to create bulk tasks: ' + err.message, key: 'bulk-opt', duration: 4 });
                  }
                }}
                aria-label="Bulk optimization"
                disabled={pagination.total === 0 || syncing}
                icon={<Zap size={14} style={{ color: 'var(--text-danger)' }} />}
                className="iconButton d-flex align-items-center justify-content-center shadow-sm"
              />
            </Tooltip>
          )}

          {hasPermission('asinmanager_export') && (
            <Tooltip title="Export">
              <Button
                onClick={() => setShowExportModal(true)}
                aria-label="Export ASIN data"
                icon={<Download size={14} style={{ color: 'var(--text-primary)' }} />}
                className="iconButton d-flex align-items-center justify-content-center shadow-sm"
              />
            </Tooltip>
          )}

          {viewMode === 'parent' && expandedCount > 0 && (
            <Tooltip title="Collapse all parents">
              <Button
                onClick={collapseAll}
                aria-label="Collapse all parent ASINs"
                icon={<ChevronsUp size={14} className="text-zinc-500" />}
                className="iconButton d-flex align-items-center justify-content-center shadow-sm"
              />
            </Tooltip>
          )}

          {hasPermission('asinmanager_manage') && (
            <Tooltip title="Recalculate LQS">
              <Button
                onClick={handleRecalculateLQS}
                disabled={loading}
                aria-label="Recalculate LQS"
                icon={<RefreshCwIcon size={14} className={loading ? 'text-zinc-400' : 'text-sky-600'} />}
                className="iconButton d-flex align-items-center justify-content-center shadow-sm"
              />
            </Tooltip>
          )}

          {hasPermission('asinmanager_import') && (
            <Tooltip title="Import">
              <Button
                onClick={() => setShowBulkImportModal(true)}
                aria-label="Import ASIN data"
                icon={<FileUp size={14} className="text-emerald-600" />}
                className="iconButton d-flex align-items-center justify-content-center shadow-sm"
              />
            </Tooltip>
          )}

          {hasPermission('asinmanager_manage') && (
            <Tooltip title="Add ASIN">
              <Button
                onClick={() => setShowAddModal(true)}
                aria-label="Add ASIN"
                icon={<Plus size={14} className="text-indigo-600" />}
                className="iconButton d-flex align-items-center justify-content-center shadow-sm"
              />
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

export default Toolbar;