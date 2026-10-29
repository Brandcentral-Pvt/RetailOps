import React from 'react';
import { Search } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { usePlatform, useKeyboardShortcut } from './headerHooks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

/**
 * SearchTrigger — shadcn button that opens the command palette (Cmd/K).
 *
 * Replaces the wide antd search bar: the actual search input now lives inside
 * the command palette. Kept as a global entry point for search/navigation.
 */
export default function SearchTrigger() {
  const { setCmdOpen } = useHeader();
  const { modKey } = usePlatform();

  useKeyboardShortcut(
    ['k'],
    () => setCmdOpen(true),
    { metaKey: true, preventDefault: true }
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCmdOpen(true)}
          aria-label="Open command palette"
        >
          <Search size={15} className="mr-2" aria-hidden="true" />
          Search
          <span className="ml-auto text-xs text-slate-500 font-mono">
            {modKey} K
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Command palette ({modKey} + K)</TooltipContent>
    </Tooltip>
  );
}
