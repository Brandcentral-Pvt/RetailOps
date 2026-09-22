/**
 * Chat store (zustand) — conversations, per-conversation messages, unread
 * totals and typing state for the in-app messaging module.
 *
 * Realtime (Socket.IO, same channel as notifications):
 *  - `chat:message` → append / refresh unread
 *  - `chat:read`    → update participant `lastReadAt` (read receipts)
 *  - `chat:typing`  → transient typing indicator
 *
 * Sending emits nothing over the socket; the backend broadcasts the message
 * back to the other participants only, so the sender appends the API result
 * itself (optimistic, pending → confirmed).
 */
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { connectSocket, getSocket } from '../services/socketService';
import { chatApiService } from '../services/chatApiService';
import type {
  ChatConversation,
  ChatMessage,
  ChatParticipant,
} from '../types';

interface ChatState {
  conversations: ChatConversation[];
  unreadTotal: number;
  loadingConversations: boolean;
  error: string | null;

  messagesByConversation: Record<string, ChatMessage[]>;
  participantsByConversation: Record<string, ChatParticipant[]>;
  hasMoreByConversation: Record<string, boolean>;
  loadingOlder: Record<string, boolean>;
  activeConversationId: string | null;
  typingByConversation: Record<string, string[]>;

  socketAttached: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;

  openConversation: (id: string) => Promise<void>;
  closeConversation: () => void;
  loadOlder: (id: string) => Promise<void>;
  sendText: (id: string, content: string, senderId: string) => Promise<void>;
  sendImage: (id: string, uri: string, fileName: string | null, mimeType: string | null, senderId: string) => Promise<void>;
  emitTyping: (id: string) => void;

  reset: () => void;
}

let lastAttachedSocket: Socket | null = null;
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function dedupeMessages(list: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const seen = new Set(list.map((m) => m._id));
  return [...list, ...next.filter((m) => !seen.has(m._id))];
}

function touchConversation(conversations: ChatConversation[], id: string, patch: Partial<ChatConversation>): ChatConversation[] {
  const edited = conversations.map((c) => (c.id === id ? { ...c, ...patch } : c));
  edited.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return edited;
}

async function attachRealtime() {
  try {
    const socket = await connectSocket();
    if (!socket) return false;
    if (lastAttachedSocket === socket) return true;
    lastAttachedSocket = socket;

    socket.on('chat:message', (payload: unknown) => {
      const { conversationId, message } = (payload ?? {}) as {
        conversationId?: string;
        message?: ChatMessage;
      };
      if (!conversationId || !message) return;
      const store = useChatStore.getState();

      if (store.activeConversationId === conversationId) {
        useChatStore.setState({
          messagesByConversation: {
            ...store.messagesByConversation,
            [conversationId]: dedupeMessages(store.messagesByConversation[conversationId] ?? [], [message]),
          },
        });
        chatApiService.markRead(conversationId).catch(() => undefined);
        useChatStore.getState().refreshUnread();
      } else {
        useChatStore.setState((state) => {
          const existing = state.conversations.find((c) => c.id === conversationId);
          const existingUnread = existing?.unreadCount ?? 0;
          return {
            conversations: touchConversation(state.conversations, conversationId, {
              lastMessage: {
                _id: message._id,
                senderId: message.senderId,
                senderName: message.senderName,
                type: message.type,
                content: message.content,
                attachmentUrl: message.attachmentUrl,
                attachmentName: message.attachmentName,
                createdAt: message.createdAt,
              },
              updatedAt: message.createdAt,
              unreadCount: existingUnread + 1,
            }),
            unreadTotal: state.unreadTotal + 1,
          };
        });
      }
    });

    socket.on('chat:read', (payload: unknown) => {
      const { conversationId, userId, lastReadAt } = (payload ?? {}) as {
        conversationId?: string;
        userId?: string;
        lastReadAt?: string;
      };
      if (!conversationId || !userId || !lastReadAt) return;
      const store = useChatStore.getState();
      const participants = store.participantsByConversation[conversationId];
      if (!participants) return;
      useChatStore.setState({
        participantsByConversation: {
          ...store.participantsByConversation,
          [conversationId]: participants.map((p) =>
            p._id === userId ? { ...p, lastReadAt } : p,
          ),
        },
      });
    });

    socket.on('chat:typing', (payload: unknown) => {
      const { conversationId, senderId } = (payload ?? {}) as {
        conversationId?: string;
        senderId?: string;
      };
      if (!conversationId || !senderId) return;
      const store = useChatStore.getState();
      const current = store.typingByConversation[conversationId] ?? [];
      if (current.includes(senderId)) return;
      useChatStore.setState({
        typingByConversation: {
          ...store.typingByConversation,
          [conversationId]: [...current, senderId],
        },
      });
      const key = `${conversationId}:${senderId}`;
      if (typingTimers[key]) clearTimeout(typingTimers[key]);
      typingTimers[key] = setTimeout(() => {
        const latest = useChatStore.getState();
        useChatStore.setState({
          typingByConversation: {
            ...latest.typingByConversation,
            [conversationId]: (latest.typingByConversation[conversationId] ?? []).filter((s) => s !== senderId),
          },
        });
      }, 3000);
    });

    return true;
  } catch {
    return false;
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  unreadTotal: 0,
  loadingConversations: false,
  error: null,

  messagesByConversation: {},
  participantsByConversation: {},
  hasMoreByConversation: {},
  loadingOlder: {},
  activeConversationId: null,
  typingByConversation: {},
  socketAttached: false,

  init: async () => {
    if (!get().socketAttached) {
      const attached = await attachRealtime();
      set({ socketAttached: attached });
    }
    await get().refresh();
  },

  refresh: async () => {
    set({ loadingConversations: true, error: null });
    try {
      const conversations = await chatApiService.listConversations();
      const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
      set({ conversations, unreadTotal });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load conversations' });
    } finally {
      set({ loadingConversations: false });
    }
  },

  refreshUnread: async () => {
    try {
      const unreadTotal = await chatApiService.getUnread();
      set({ unreadTotal });
    } catch {
      // Non-fatal — next refresh reconciles.
    }
  },

  openConversation: async (id) => {
    set({ activeConversationId: id });
    const existing = get().messagesByConversation[id];
    if (!existing) {
      try {
        const page = await chatApiService.getMessages(id, { limit: 40 });
        set((state) => ({
          messagesByConversation: { ...state.messagesByConversation, [id]: page.messages },
          participantsByConversation: { ...state.participantsByConversation, [id]: page.participants },
          hasMoreByConversation: { ...state.hasMoreByConversation, [id]: page.hasMore },
        }));
      } catch {
        set({ messagesByConversation: { ...get().messagesByConversation, [id]: [] } });
      }
    }
    const prevUnread = get().conversations.find((c) => c.id === id)?.unreadCount ?? 0;
    try {
      const { unreadCount } = await chatApiService.markRead(id);
      set({
        conversations: get().conversations.map((c) =>
          c.id === id ? { ...c, unreadCount } : c,
        ),
        unreadTotal: get().unreadTotal - prevUnread + unreadCount,
      });
    } catch {
      // Keep local state.
    }
  },

  closeConversation: () => {
    const { activeConversationId, typingByConversation } = get();
    if (activeConversationId) {
      const { [activeConversationId]: _left, ...rest } = typingByConversation;
      set({ activeConversationId: null, typingByConversation: rest });
    } else {
      set({ activeConversationId: null });
    }
  },

  loadOlder: async (id) => {
    const { messagesByConversation, hasMoreByConversation, loadingOlder } = get();
    if (!hasMoreByConversation[id] || loadingOlder[id]) return;
    const messages = messagesByConversation[id] ?? [];
    const oldest = messages[0];
    if (!oldest) return;
    set({ loadingOlder: { ...loadingOlder, [id]: true } });
    try {
      const page = await chatApiService.getMessages(id, {
        beforeId: oldest.id,
        beforeAt: oldest.createdAt,
        limit: 40,
      });
      set({
        messagesByConversation: {
          ...messagesByConversation,
          [id]: dedupeMessages(page.messages, messages),
        },
        hasMoreByConversation: { ...hasMoreByConversation, [id]: page.hasMore },
      });
    } catch {
      // Keep current page.
    } finally {
      set({ loadingOlder: { ...get().loadingOlder, [id]: false } });
    }
  },

  sendText: async (id, content, senderId) => {
    const text = content.trim();
    if (!text) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      _id: tempId,
      id: tempId,
      conversationId: id,
      senderId,
      type: 'TEXT',
      content: text,
      createdAt: new Date().toISOString(),
      readBy: [],
      pending: true,
    };
    set({
      messagesByConversation: {
        ...get().messagesByConversation,
        [id]: [...(get().messagesByConversation[id] ?? []), optimistic],
      },
    });
    try {
      const saved = await chatApiService.sendMessage(id, { content: text, type: 'TEXT' });
      set({
        messagesByConversation: {
          ...get().messagesByConversation,
          [id]: (get().messagesByConversation[id] ?? []).map((m) => (m._id === tempId ? saved : m)),
        },
      });
    } catch (err) {
      set({
        messagesByConversation: {
          ...get().messagesByConversation,
          [id]: (get().messagesByConversation[id] ?? []).map((m) =>
            m._id === tempId ? { ...m, pending: false, failed: true } : m,
          ),
        },
      });
    }
  },

  sendImage: async (id, uri, fileName, mimeType, senderId) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      _id: tempId,
      id: tempId,
      conversationId: id,
      senderId,
      type: 'IMAGE',
      content: '',
      attachmentUrl: uri,
      attachmentName: fileName ?? undefined,
      createdAt: new Date().toISOString(),
      readBy: [],
      pending: true,
    };
    set({
      messagesByConversation: {
        ...get().messagesByConversation,
        [id]: [...(get().messagesByConversation[id] ?? []), optimistic],
      },
    });
    try {
      const serverPath = await chatApiService.uploadImage(uri, fileName, mimeType);
      const saved = await chatApiService.sendMessage(id, {
        type: 'IMAGE',
        attachmentUrl: serverPath,
        attachmentName: fileName ?? undefined,
      });
      set({
        messagesByConversation: {
          ...get().messagesByConversation,
          [id]: (get().messagesByConversation[id] ?? []).map((m) => (m._id === tempId ? saved : m)),
        },
      });
    } catch (err) {
      set({
        messagesByConversation: {
          ...get().messagesByConversation,
          [id]: (get().messagesByConversation[id] ?? []).map((m) =>
            m._id === tempId ? { ...m, pending: false, failed: true } : m,
          ),
        },
      });
    }
  },

  emitTyping: (id) => {
    const socket = getSocket();
    if (socket?.connected) socket.emit('chat:typing', { conversationId: id });
  },

  reset: () => {
    lastAttachedSocket = null;
    Object.values(typingTimers).forEach(clearTimeout);
    set({
      conversations: [],
      unreadTotal: 0,
      loadingConversations: false,
      error: null,
      messagesByConversation: {},
      participantsByConversation: {},
      hasMoreByConversation: {},
      loadingOlder: {},
      activeConversationId: null,
      typingByConversation: {},
      socketAttached: false,
    });
  },
}));

export default useChatStore;