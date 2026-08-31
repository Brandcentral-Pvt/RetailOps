import { apiClient } from '../lib/api-client';
import { type ApiEnvelope, legacyRequest } from './legacyCompat';

/**
 * notifications API — migrated off the legacy fetch stack in services/api.js
 * (Increment 1). Signatures and return shapes are preserved exactly; requests
 * now flow through apiClient (Bearer auto-inject + silent-refresh on 401).
 *
 * Legacy contract: resolves with the FULL `{ success, data, ... }` envelope and
 * rejects with a plain `Error(message)`.
 */

export interface NotificationItem {
  Id?: string | number;
  Type?: string;
  Message?: string;
  ReferenceModel?: string;
  ReferenceId?: string | number;
  IsRead?: number | boolean;
  CreatedAt?: string;
  [key: string]: unknown;
}

export interface NotificationsEnvelope extends ApiEnvelope<NotificationItem[]> {
  unreadCount?: number;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
    [key: string]: unknown;
  };
}

export const notificationApi = {
  /** GET /notifications — paged list plus unreadCount. */
  getNotifications: async (params: Record<string, unknown> = {}): Promise<NotificationsEnvelope> =>
    legacyRequest<NotificationItem[]>(() =>
      apiClient.get<NotificationsEnvelope>('/notifications', { params })
    ),

  /** PUT /notifications/read — `notificationId: 'all'` marks everything read. */
  markAsRead: async (notificationId: string | number): Promise<ApiEnvelope> =>
    legacyRequest(() =>
      apiClient.put<ApiEnvelope>('/notifications/read', { notificationId })
    ),

  /** PUT /notifications/read — mark every notification read. */
  markAllAsRead: async (): Promise<ApiEnvelope> =>
    legacyRequest(() =>
      apiClient.put<ApiEnvelope>('/notifications/read', { notificationId: 'all' })
    ),

  /** DELETE /notifications/:id */
  deleteNotification: async (id: string | number): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.delete<ApiEnvelope>(`/notifications/${id}`)),

  /** DELETE /notifications/all-read — drop every already-read notification. */
  deleteAllRead: async (): Promise<ApiEnvelope> =>
    legacyRequest(() => apiClient.delete<ApiEnvelope>('/notifications/all-read')),
};
