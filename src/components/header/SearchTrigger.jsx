import React from 'react';
import { Search, Zap, Keyboard } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { usePlatform } from './headerHooks';

/**
 * SearchTrigger — modern shadcn button that opens the command palette (Cmd/K).
 *
 * Replaces the wide antd search bar: the actual search input now lives inside
 * the command palette. Kept as a global entry point for search/navigation.
 *
 * Props:
 *   loading - boolean, when true shows skeleton instead of button
 */
function SearchTrigger({ loading = false }) {
  const { setCmdOpen } = useHeader();
  const { modKey } = usePlatform();
  if (loading) return <Skeleton.Input active block size="small" />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCmdOpen(true)}
          aria-label="Open command palette"
          className="flex-1 max-w-[520px] min-w-[200px] gap-2 justify-center"
        >
          <Search size={15} className="mr-1 text-slate-400" aria-hidden="true" />
          <span className="flex-1 text-left truncate font-medium text-slate-700">
            Search…
          </span>
          <Zap size={12} className="text-amber-500 shrink-0" aria-hidden="true" />
          <span className="ml-auto text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 font-medium">
            {modKey} K
          </span>
          <Zap size={10} className="text-amber-400 shrink-0 opacity-70" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Keyboard size={12} className="shrink-0" />
          <span>{modKey} K</span>
          <span className="text-slate-300">to open</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default SearchTrigger;