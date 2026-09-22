/**
 * Notification store (zustand) — powers the header badge and the
 * Notifications screen.
 *
 * Real-time: the backend emits `new-notification` over Socket.IO whenever a
 * new in-app notification is created; this store listens and updates the
 * unread badge live (mirrors the web app behaviour).
 */
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { connectSocket } from '../services/socketService';
import { notificationApiService } from '../services/notificationApiService';
import type { AppNotification } from '../types';

interface NotificationState {
  items: AppNotification[];
  total: number;
  pages: number;
  page: number;
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  routeAttached: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

let lastAttachedSocket: Socket | null = null;

async function attachRealtime() {
  try {
    const socket = await connectSocket();
    if (!socket) return false;
    if (lastAttachedSocket === socket) return true;
    lastAttachedSocket = socket;

    socket.on('new-notification', (payload: unknown) => {
      const { notification, unreadCount } = (payload ?? {}) as {
        notification?: AppNotification;
        unreadCount?: number;
      };
      const store = useNotificationStore.getState();

      if (notification) {
        store.items = [
          notificationApiService.normalize(notification),
          ...store.items.filter((n) => (n._id ?? n.Id) !== (notification._id ?? notification.Id)),
        ];
      }
      if (typeof unreadCount === 'number') {
        useNotificationStore.setState({ unreadCount });
      }
    });

    return true;
  } catch {
    return false;
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  total: 0,
  pages: 1,
  page: 1,
  unreadCount: 0,
  isLoading: false,
  isRefreshing: false,
  error: null,
  routeAttached: false,

  init: async () => {
    if (get().routeAttached) return;
    const attached = await attachRealtime();
    set({ routeAttached: attached });
    await get().refresh();
  },

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const page = await notificationApiService.getNotifications(1, 50);
      set({
        items: page.data.map(notificationApiService.normalize),
        total: page.pagination.total,
        pages: page.pagination.pages,
        page: 1,
        unreadCount: page.unreadCount,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load notifications' });
    } finally {
      set({ isLoading: false, isRefreshing: false });
    }
  },

  refreshUnread: async () => {
    try {
      const count = await notificationApiService.getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // Non-fatal — the badge will sync on the next refresh.
    }
  },

  loadMore: async () => {
    const { page, pages, isLoading, items } = get();
    if (page >= pages || isLoading) return;
    set({ isLoading: true });
    try {
      const next = await notificationApiService.getNotifications(page + 1, 50);
      const seen = new Set(items.map((n) => n._id ?? n.Id));
      set({
        items: [
          ...items,
          ...next.data
            .map(notificationApiService.normalize)
            .filter((n) => !seen.has(n._id ?? n.Id)),
        ],
        page: next.pagination.page,
        pages: next.pagination.pages,
        total: next.pagination.total,
        unreadCount: next.unreadCount,
      });
    } catch {
      // Keep the current page — silently stop paginating on error.
    } finally {
      set({ isLoading: false });
    }
  },

  markRead: async (id) => {
    // Optimistic.
    set({
      items: get().items.map((n) =>
        (n._id ?? n.Id) === id ? { ...n, IsRead: true, isRead: true } : n,
      ),
    });
    try {
      const unreadCount = await notificationApiService.markRead(id);
      set({ unreadCount });
    } catch {
      await get().refresh();
    }
  },

  markAllRead: async () => {
    try {
      const unreadCount = await notificationApiService.markRead('all');
      set({
        unreadCount,
        items: get().items.map((n) => ({ ...n, IsRead: true, isRead: true })),
      });
    } catch {
      await get().refresh();
    }
  },

  remove: async (id) => {
    set({ items: get().items.filter((n) => (n._id ?? n.Id) !== id) });
    try {
      await notificationApiService.deleteNotification(id);
    } catch {
      await get().refresh();
    }
  },

  reset: () => {
    lastAttachedSocket = null;
    set({
      items: [],
      total: 0,
      pages: 1,
      page: 1,
      unreadCount: 0,
      isLoading: false,
      isRefreshing: false,
      error: null,
      routeAttached: false,
    });
  },
}));

export default useNotificationStore;