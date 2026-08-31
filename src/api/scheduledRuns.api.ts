import { apiClient } from '../lib/api-client';
import { type ApiEnvelope, legacyRequest } from './legacyCompat';

/**
 * scheduled-runs API — migrated off the legacy fetch stack in services/api.js
 * (Increment 1). Signatures and return shapes are preserved exactly; requests
 * now flow through apiClient (Bearer auto-inject + silent-refresh on 401).
 *
 * Legacy contract: resolves with the FULL `{ success, data, ... }` envelope and
 * rejects with a plain `Error`. The old implementation threw static messages
 * per call ("Failed to fetch scheduled runs", ...); those strings are kept as
 * fallbacks, with a server-provided `message` preferred when present.
 * ScheduledRunsPage also `.catch()`es to `{ success: false, data: [] }`, which
 * keeps working unchanged.
 */

export interface ScheduledRun {
  Id?: string | number;
  Status?: string;
  StartTime?: string;
  EndTime?: string;
  Marketplace?: string;
  [key: string]: unknown;
}

export interface SellerRunMetric {
  sellerId?: string;
  runningRuns?: number;
  completedRuns?: number;
  failedRuns?: number;
  totalInserted?: number;
  totalExpected?: number;
  [key: string]: unknown;
}

export const scheduledRunsApi = {
  /** GET /scheduled-runs */
  getAll: async (): Promise<ApiEnvelope<ScheduledRun[]>> =>
    legacyRequest<ScheduledRun[]>(
      () => apiClient.get<ApiEnvelope<ScheduledRun[]>>('/scheduled-runs'),
      'Failed to fetch scheduled runs'
    ),

  /** GET /scheduled-runs/seller-metrics */
  getSellerMetrics: async (): Promise<ApiEnvelope<SellerRunMetric[]>> =>
    legacyRequest<SellerRunMetric[]>(
      () => apiClient.get<ApiEnvelope<SellerRunMetric[]>>('/scheduled-runs/seller-metrics'),
      'Failed to fetch scheduled run seller metrics'
    ),

  /** GET /scheduled-runs/seller-logs/:sellerId */
  getSellerLogs: async (sellerId: string): Promise<ApiEnvelope> =>
    legacyRequest(
      () => apiClient.get<ApiEnvelope>(`/scheduled-runs/seller-logs/${sellerId}`),
      'Failed to fetch seller logs'
    ),

  /** GET /scheduled-runs/:id */
  getDetails: async (id: string | number): Promise<ApiEnvelope> =>
    legacyRequest(
      () => apiClient.get<ApiEnvelope>(`/scheduled-runs/${id}`),
      'Failed to fetch scheduled run details'
    ),

  /** POST /scheduled-runs/trigger[?marketplace=...] — body intentionally empty, as before. */
  trigger: async (marketplace?: string): Promise<ApiEnvelope> =>
    legacyRequest(
      () =>
        apiClient.post<ApiEnvelope>('/scheduled-runs/trigger', undefined, {
          params: marketplace ? { marketplace } : undefined,
        }),
      'Failed to trigger scheduled run'
    ),
};
