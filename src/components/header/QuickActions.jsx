import React, { useState, useEffect } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { isConnected, reconnect } from '../../services/realtimeService';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

/**
 * QuickActions — truthful connection status with combined status indicator.
 *
 * Replaces the fake "Syncing..." spinner (a 2.2 s setTimeout in HeaderContext)
 * with the real Socket.IO connection state. "Reconnect" force-reconnects the
 * shared singleton; no synchronization is simulated or faked (Rule 12).
 */
export default function QuickActions() {
  const [connected, setConnected] = useState(isConnected());

  useEffect(() => {
    const iv = setInterval(() => setConnected(isConnected()), 2000);
    return () => clearInterval(iv);
  }, []);

  const handleReconnect = () => {
    reconnect();
    setConnected(isConnected());
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReconnect}
          disabled={connected}
          aria-label={connected ? 'Connection live' : 'Reconnect'}
          title={connected ? 'Connection live' : 'Reconnect'}
          className="gap-1.5"
        >
          <span
            className={`connection-dot h-2 w-2 rounded-full ${connected ? 'bg-[#1565c0] animate-pulse' : 'bg-slate-400'}`}
            aria-hidden="true"
          />
          {connected ? (
            <Wifi size={14} className="text-[#1565c0]" />
          ) : (
            <WifiOff size={14} className="text-slate-500" />
          )}
          <span className="ml-1.5 text-xs font-medium">
            {connected ? 'Live' : 'Reconnect'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {connected ? 'Connection live' : 'Disconnected — click to reconnect'}
      </TooltipContent>
    </Tooltip>
  );
}
