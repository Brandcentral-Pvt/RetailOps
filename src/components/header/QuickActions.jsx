import React, { useState, useEffect } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { isConnected, reconnect } from '../../services/realtimeService';
import { useHeader } from '../../contexts/HeaderContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { QuickActionSkeleton } from '@/components/ui/skeleton/QuickActionSkeleton';

/**
 * QuickActions — truthful connection status.
 *
 * Replaces the fake "Syncing..." spinner with the real Socket.IO connection state.
 *
 * Props:
 *   loading - boolean, when true shows skeleton instead of button
 */
export default function QuickActions({ loading = false }) {
  const [connected, setConnected] = useState(isConnected());

  useEffect(() => {
    const iv = setInterval(() => setConnected(isConnected()), 2000);
    return () => clearInterval(iv);
  }, []);

  const handleReconnect = () => {
    reconnect();
    setConnected(isConnected());
  };

  if (loading) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { }}
        disabled
        aria-label="Connection live"
        className="animate-pulse"
      >
        <Wifi size={14} className="text-[#1565c0]" />
        <span className="ml-1.5 text-xs font-medium">
          Live
        </span>
      </Button>
    );
  }

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
        >
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
