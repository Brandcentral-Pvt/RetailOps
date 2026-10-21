import React, { memo } from 'react';
import { Button, Tag, TagIcon, RefreshCw, Zap, Sparkles, AlertTriangle, PlayCircle, PlusCircle } from 'lucide-react';

export const SelectionBar = memo(function SelectionBar({
  selectedIds,
  selectableRows,
  syncing,
  liveSyncing,
  handleLiveSyncSelected,
  handleToggleSelectAll,
  handleBulkSyncSelected,
  handleBulkPriceDispute,
  handleRunRulesets,
  handleOpenTaskModal,
  handleSelectedCreateActions,
  handleAiListingAnalysis,
  setShowBulkTagsModal,
  aiAnalysisLoading,
  clearSelection,
  appliedFilters,
  setAppliedFilters,
  setFilters,
  setFilterTrigger,
}) => {
  if (selectedIds.size === 0) return null;

  return (
    <div className="bg-indigo-50 px-3 py-2 border-bottom d-flex align-items-center gap-3 animate-in slide-in-from-top-2 duration-200" style={{ flexShrink: 0 }}>
      <div className="d-flex align-items-center gap-2">
        <div className="bg-indigo-600 text-white fw-bold rounded-circle d-flex align-items-center justify-content-center" style={{ width: '20px', height: '20px', fontSize: '10px' }}>
          {selectedIds.size}
        </div>
        <span className="small fw-bold text-indigo-900">items selected</span>
      </div>
      <div className="vr bg-indigo-200 opacity-50" style={{ height: '16px' }}></div>
      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={() => setShowBulkTagsModal(true)}
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          <TagIcon size={12} /> Tag
        </button>
        <button
          className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={handleBulkSyncSelected}
          disabled={syncing}
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          {syncing ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 12 }} aria-hidden="true" /> : <RefreshCw size={12} />} Sync
        </button>
        <button
          className="btn btn-sm btn-white border shadow-sm fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={handleLiveSyncSelected}
          disabled={liveSyncing || syncing}
          title="Refresh price, BSR, rating and stock from the Amazon Creators API"
          style={{ fontSize: 'var(--font-size-xs)', borderColor: '#a7f3d0', color: '#047857', backgroundColor: '#ecfdf5' }}
        >
          {liveSyncing ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 12 }} aria-hidden="true" /> : <Zap size={12} />} Live Sync
        </button>
        <button
          className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={handleSelectedCreateActions}
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          <Zap size={12} className="fill-indigo-700" /> Tasks
        </button>
        <button
          className="btn btn-sm btn-white border shadow-sm fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={handleAiListingAnalysis}
          disabled={aiAnalysisLoading}
          style={{ fontSize: 'var(--font-size-xs)', borderColor: '#c4b5fd', color: '#6d28d9', backgroundColor: '#f5f3ff' }}
        >
          <Sparkles size={12} /> {aiAnalysisLoading ? 'Analyzing...' : 'AI Analyze'}
        </button>
        <button
          className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={() => handleBulkPriceDispute(true)}
          disabled={selectedIds.size === 0}
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          <AlertTriangle size={12} /> Dispute
        </button>
        <button
          className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={() => handleBulkPriceDispute(false)}
          disabled={selectedIds.size === 0}
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          <RefreshCw size={12} /> Resolve
        </button>
        <button
          className="btn btn-sm btn-white border border-indigo-100 shadow-sm text-indigo-700 fw-bold rounded-2 d-flex align-items-center gap-1.5"
          onClick={handleRunRulesets}
          disabled={selectedIds.size === 0}
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          <PlayCircle size={12} /> Rulesets
        </button>
      </div>
      <button
        className="btn btn-link text-indigo-600 fw-bold text-decoration-none ms-auto p-0"
        style={{ fontSize: 'var(--font-size-xs)' }}
        onClick={clearSelection}
      >
        Deselect All
      </button>
    </div>
  );
}

export default SelectionBar;