import { apiClient } from '../lib/api-client';
import { type ApiEnvelope, legacyRequest } from './legacyCompat';

/**
 * seller-tracker API — migrated off the legacy fetch stack in services/api.js
 * (Increment 1). Signatures and return shapes are preserved exactly; requests
 * now flow through apiClient (Bearer auto-inject + silent-refresh on 401).
 *
 * Legacy contract: resolves with the FULL `{ success, data, ... }` envelope and
 * rejects with a plain `Error(message)` (SellerAsinTrackerPage renders
 * `e.message` directly).
 */

export interface TrackedSeller {
  _id?: string;
  SellerId?: string;
  [key: string]: unknown;
}

export interface SellerTaskPayload {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  dueDate?: string | null;
  assignee?: string | null;
  [key: string]: unknown;
}

export const sellerTrackerApi = {
  /** GET /seller-tracker — all tracked sellers. */
  getTrackers: async (): Promise<ApiEnvelope<TrackedSeller[]>> =>
    legacyRequest<TrackedSeller[]>(() => apiClient.get<ApiEnvelope<TrackedSeller[]>>('/seller-tracker')),

  /** GET /seller-tracker/:sellerId/asins */
  getSellerAsins: async (sellerId: string): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.get<ApiEnvelope>(`/seller-tracker/${sellerId}/asins`)),

  /** POST /seller-tracker/sync/:sellerId — queue a sync for one seller. */
  syncSeller: async (sellerId: string): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.post<ApiEnvelope>(`/seller-tracker/sync/${sellerId}`, {})),

  /** POST /seller-tracker/sync-all — queue a sync for every tracked seller. */
  syncAll: async (): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.post<ApiEnvelope>('/seller-tracker/sync-all', {})),

  /** GET /seller-tracker/:sellerId/activities */
  getSellerActivities: async (sellerId: string): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.get<ApiEnvelope>(`/seller-tracker/${sellerId}/activities`)),

  /** GET /seller-tracker/:sellerId/tasks */
  getSellerTasks: async (sellerId: string): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.get<ApiEnvelope>(`/seller-tracker/${sellerId}/tasks`)),

  /** POST /seller-tracker/:sellerId/tasks — create a task against a seller. */
  createSellerTask: async (sellerId: string, taskData: SellerTaskPayload): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.post<ApiEnvelope>(`/seller-tracker/${sellerId}/tasks`, taskData)),
};
