import React from 'react';
import { Search } from 'lucide-react';
import { useHeader } from '../../contexts/HeaderContext';
import { usePlatform } from './headerHooks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

/**
 * SearchTrigger — shadcn button that opens the global search modal (Cmd/K).
 */
export default function SearchTrigger() {
  const { setCmdOpen } = useHeader();
  const { modKey } = usePlatform();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCmdOpen(true)}
          aria-label="Open search"
        >
          <Search size={15} className="mr-2" aria-hidden="true" />
          Search
          <span className="ml-auto text-xs text-slate-500 font-mono">
            {modKey} K
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Search ({modKey} + K)</TooltipContent>
    </Tooltip>
  );
}
