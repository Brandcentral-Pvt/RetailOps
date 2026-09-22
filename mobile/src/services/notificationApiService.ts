/**
 * Thin typed client for the backend `/api/notifications` endpoints.
 */
import apiClient from './apiClient';
import type { AppNotification, NotificationsPage } from '../types';

async function getNotifications(
  page = 1,
  limit = 50,
  unreadOnly = false,
): Promise<NotificationsPage> {
  const { data } = await apiClient.get('/notifications', {
    params: { page, limit, unreadOnly },
  });
  return {
    data: data?.data ?? [],
    pagination: data?.pagination ?? { page, limit, total: 0, pages: 0 },
    unreadCount: data?.unreadCount ?? 0,
  };
}

async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get('/notifications', {
    params: { page: 1, limit: 20, unreadOnly: true },
  });
  return data?.unreadCount ?? 0;
}

/** Marks the notification read, or all notifications when id === 'all'. */
async function markRead(id: string): Promise<number> {
  const { data } = await apiClient.put('/notifications/read', {
    notificationId: id,
  });
  return data?.unreadCount ?? 0;
}

/** Dismiss a notification (id 'all-read' clears every read one). */
async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${encodeURIComponent(id)}`);
}

export function normalizeNotification(raw: AppNotification): AppNotification {
  return {
    ...raw,
    _id: raw._id ?? raw.Id,
  };
}

export const notificationApiService = {
  getNotifications,
  getUnreadCount,
  markRead,
  deleteNotification,
  normalize: normalizeNotification,
};