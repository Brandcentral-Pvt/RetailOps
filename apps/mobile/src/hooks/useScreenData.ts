/**
 * useScreenData — one hook so every screen loads the same way.
 *
 * It classifies the outcome into the nine states, which means a screen author
 * cannot accidentally ship a screen with no error or empty treatment: the
 * shell renders the right state from this status.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { ApiError } from '../services/ApiError';
import type { ScreenStatus } from '../nav/types';

type Options = {
  /** Skip the request (screen not yet reached). */
  enabled?: boolean;
  /** Return true to render the true-empty state rather than an empty list. */
  isEmpty?: (data: unknown) => boolean;
};

export function useScreenData<T>(endpoint: string | null, options: Options = {}) {
  const { enabled = true, isEmpty } = options;
  const [status, setStatus] = useState<ScreenStatus>({ kind: 'loading-first' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!endpoint) {
      // Scaffolded screens have no endpoint yet; render as ready-but-empty so
      // the shell renders the true-empty state instead of a permanent spinner.
      setStatus({ kind: 'empty-true' });
      return;
    }
    setStatus((s) => (s.kind === 'ready' ? s : { kind: 'loading-first' }));
    try {
      const data = await api.get<{ data?: T } | T>(endpoint);
      const body = (data as { data?: T })?.data ?? (data as T);
      if (isEmpty?.(body)) setStatus({ kind: 'empty-true' });
      else setStatus({ kind: 'ready', data: body });
    } catch (err) {
      const fatal = err instanceof ApiError && err.isFatal;
      setStatus({ kind: 'error', error: err, fatal });
    } finally {
      setRefreshing(false);
    }
  }, [endpoint, isEmpty]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return {
    status,
    error: status.kind === 'error' ? status.error : null,
    data: status.kind === 'ready' ? status.data : null,
    refreshing,
    retry: load,
    refresh,
  };
}
