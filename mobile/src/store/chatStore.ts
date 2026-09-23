import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

import {
  connectSocket,
  getSocket,
} from '../services/socketService';

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

  sendText: (
    id: string,
    content: string,
    senderId: string,
    replyTo?: string,
  ) => Promise<void>;

  sendImage: (
    id: string,
    uri: string,
    fileName: string | null,
    mimeType: string | null,
    senderId: string,
  ) => Promise<void>;

  /** Optimistic edit + optional API call */
  editMessage: (
    conversationId: string,
    messageId: string,
    newContent: string,
  ) => Promise<void>;

  /** Optimistic delete + optional API call */
  deleteMessage: (
    conversationId: string,
    messageId: string,
  ) => Promise<void>;

  emitTyping: (id: string) => void;
  reset: () => void;
}

let lastAttachedSocket: Socket | null = null;
let initPromise: Promise<void> | null = null;

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function dedupeMessages(
  list: ChatMessage[],
  next: ChatMessage[],
): ChatMessage[] {
  if (!next.length) return list;

  const listIds = new Set(list.map((message) => message._id));
  const filteredNext = next.filter((message) => !listIds.has(message._id));

  if (!filteredNext.length) return list;

  return [...list, ...filteredNext];
}

function touchConversation(
  conversations: ChatConversation[],
  id: string,
  patch: Partial<ChatConversation>,
): ChatConversation[] {
  const edited = conversations.map((conversation) =>
    conversation.id === id
      ? { ...conversation, ...patch }
      : conversation,
  );

  edited.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return edited;
}

async function attachRealtime(): Promise<boolean> {
  try {
    const socket = await connectSocket();

    if (!socket) return false;
    if (lastAttachedSocket === socket) return true;

    lastAttachedSocket = socket;

    // ── New message ──────────────────────────────────────────────────────
    socket.on('chat:message', (payload: unknown) => {
      const { conversationId, message } = (payload ?? {}) as {
        conversationId?: string;
        message?: ChatMessage;
      };

      if (!conversationId || !message) return;

      const store = useChatStore.getState();
      const currentMessages = store.messagesByConversation[conversationId] ?? [];

      const serverId = message._id ?? (message as any).id;
      const alreadyExists = currentMessages.some((m) => m._id === serverId);
      if (alreadyExists) return;

      const tempIndex = currentMessages.findIndex(
        (m) =>
          m.pending &&
          m.senderId === message.senderId &&
          m.type === message.type &&
          m.content === message.content,
      );

      let newMessages: ChatMessage[];

      if (tempIndex >= 0) {
        const temp = currentMessages[tempIndex];
        const merged: ChatMessage = {
          ...temp,
          ...message,
          _id: serverId,
          id: (message as any).id ?? serverId,
          pending: false,
          failed: false,
          replyTo:
            (message as any).replyTo ??
            (message as any).replyToId ??
            temp.replyTo,
        };
        newMessages = [...currentMessages];
        newMessages[tempIndex] = merged;
      } else {
        newMessages = dedupeMessages(currentMessages, [
          {
            ...message,
            _id: serverId,
            replyTo:
              (message as any).replyTo ?? (message as any).replyToId,
          },
        ]);
      }

      if (store.activeConversationId === conversationId) {
        useChatStore.setState((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: newMessages,
          },
        }));

        chatApiService.markRead(conversationId).catch(() => undefined);
        void useChatStore.getState().refreshUnread();
        return;
      }

      useChatStore.setState((state) => {
        const existing = state.conversations.find(
          (conversation) => conversation.id === conversationId,
        );
        const existingUnread = existing?.unreadCount ?? 0;

        return {
          conversations: touchConversation(
            state.conversations,
            conversationId,
            {
              lastMessage: {
                _id: serverId,
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
            },
          ),
          unreadTotal: state.unreadTotal + 1,
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: newMessages,
          },
        };
      });
    });

    // ── Message edited (optional socket event) ───────────────────────────
    socket.on('chat:message:edited', (payload: unknown) => {
      const { conversationId, messageId, content } = (payload ?? {}) as {
        conversationId?: string;
        messageId?: string;
        content?: string;
      };
      if (!conversationId || !messageId || content == null) return;

      useChatStore.setState((state) => {
        const list = state.messagesByConversation[conversationId] ?? [];
        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: list.map((m) =>
              m._id === messageId ? { ...m, content, edited: true } : m,
            ),
          },
        };
      });
    });

    // ── Message deleted (optional socket event) ──────────────────────────
    socket.on('chat:message:deleted', (payload: unknown) => {
      const { conversationId, messageId } = (payload ?? {}) as {
        conversationId?: string;
        messageId?: string;
      };
      if (!conversationId || !messageId) return;

      useChatStore.setState((state) => {
        const list = state.messagesByConversation[conversationId] ?? [];
        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: list.filter((m) => m._id !== messageId),
          },
        };
      });
    });

    // ── Read receipts ────────────────────────────────────────────────────
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

      const participant = participants.find((item) => item._id === userId);
      if (participant?.lastReadAt === lastReadAt) return;

      useChatStore.setState((state) => ({
        participantsByConversation: {
          ...state.participantsByConversation,
          [conversationId]: participants.map((item) =>
            item._id === userId ? { ...item, lastReadAt } : item,
          ),
        },
      }));
    });

    // ── Typing ───────────────────────────────────────────────────────────
    socket.on('chat:typing', (payload: unknown) => {
      const { conversationId, senderId } = (payload ?? {}) as {
        conversationId?: string;
        senderId?: string;
      };

      if (!conversationId || !senderId) return;

      const store = useChatStore.getState();
      const current = store.typingByConversation[conversationId] ?? [];

      if (current.includes(senderId)) return;

      useChatStore.setState((state) => ({
        typingByConversation: {
          ...state.typingByConversation,
          [conversationId]: [
            ...(state.typingByConversation[conversationId] ?? []),
            senderId,
          ],
        },
      }));

      const key = `${conversationId}:${senderId}`;

      if (typingTimers[key]) {
        clearTimeout(typingTimers[key]);
      }

      typingTimers[key] = setTimeout(() => {
        const latest = useChatStore.getState();
        useChatStore.setState({
          typingByConversation: {
            ...latest.typingByConversation,
            [conversationId]: (
              latest.typingByConversation[conversationId] ?? []
            ).filter((id) => id !== senderId),
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
    if (initPromise) return initPromise;

    initPromise = (async () => {
      if (!get().socketAttached) {
        const attached = await attachRealtime();
        set({ socketAttached: attached });
      }
      await get().refresh();
    })();

    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  },

  refresh: async () => {
    set({ loadingConversations: true, error: null });

    try {
      const conversations = await chatApiService.listConversations();
      const unreadTotal = conversations.reduce(
        (sum, conversation) => sum + conversation.unreadCount,
        0,
      );

      set({ conversations, unreadTotal });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load conversations',
      });
    } finally {
      set({ loadingConversations: false });
    }
  },

  refreshUnread: async () => {
    try {
      const unreadTotal = await chatApiService.getUnread();
      if (get().unreadTotal !== unreadTotal) {
        set({ unreadTotal });
      }
    } catch {
      // Non-fatal.
    }
  },

  openConversation: async (id) => {
    set({ activeConversationId: id });

    const existing = get().messagesByConversation[id];

    if (!existing) {
      try {
        const page = await chatApiService.getMessages(id, { limit: 40 });

        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [id]: page.messages,
          },
          participantsByConversation: {
            ...state.participantsByConversation,
            [id]: page.participants,
          },
          hasMoreByConversation: {
            ...state.hasMoreByConversation,
            [id]: page.hasMore,
          },
        }));
      } catch {
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [id]: [],
          },
        }));
      }
    }

    const prevUnread =
      get().conversations.find((conversation) => conversation.id === id)
        ?.unreadCount ?? 0;

    try {
      const result = await chatApiService.markRead(id);

      set((state) => ({
        conversations: state.conversations.map((conversation) =>
          conversation.id === id
            ? { ...conversation, unreadCount: result.unreadCount }
            : conversation,
        ),
        unreadTotal: Math.max(
          0,
          state.unreadTotal - prevUnread + result.unreadCount,
        ),
      }));
    } catch {
      // Keep local state.
    }
  },

  closeConversation: () => {
    const { activeConversationId, typingByConversation } = get();

    if (!activeConversationId) return;

    const { [activeConversationId]: _removed, ...rest } =
      typingByConversation;

    set({
      activeConversationId: null,
      typingByConversation: rest,
    });
  },

  loadOlder: async (id) => {
    const { messagesByConversation, hasMoreByConversation, loadingOlder } =
      get();

    if (!hasMoreByConversation[id] || loadingOlder[id]) return;

    const messages = messagesByConversation[id] ?? [];
    const oldest = messages[0];

    if (!oldest) return;

    set((state) => ({
      loadingOlder: { ...state.loadingOlder, [id]: true },
    }));

    try {
      const page = await chatApiService.getMessages(id, {
        beforeId: oldest.id,
        beforeAt: oldest.createdAt,
        limit: 40,
      });

      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [id]: dedupeMessages(page.messages, messages),
        },
        hasMoreByConversation: {
          ...state.hasMoreByConversation,
          [id]: page.hasMore,
        },
      }));
    } catch {
      // Keep current page.
    } finally {
      set((state) => ({
        loadingOlder: { ...state.loadingOlder, [id]: false },
      }));
    }
  },

  // ── sendText ─────────────────────────────────────────────────────────────
  sendText: async (id, content, senderId, replyTo) => {
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
      replyTo: replyTo ?? undefined,
    };

    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [id]: [...(state.messagesByConversation[id] ?? []), optimistic],
      },
      conversations: touchConversation(state.conversations, id, {
        lastMessage: {
          _id: tempId,
          senderId,
          type: 'TEXT',
          content: text,
          createdAt: optimistic.createdAt,
        },
        updatedAt: optimistic.createdAt,
      }),
    }));

    try {
      const saved = await chatApiService.sendMessage(id, {
        content: text,
        type: 'TEXT',
        replyTo,
      });

      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [id]: (state.messagesByConversation[id] ?? []).map((message) => {
            if (message._id !== tempId) return message;

            return {
              ...optimistic,
              ...saved,
              _id: saved._id ?? saved.id ?? tempId,
              id: saved.id ?? saved._id ?? tempId,
              pending: false,
              failed: false,
              replyTo:
                saved.replyTo ??
                (saved as any).replyToId ??
                optimistic.replyTo,
            };
          }),
        },
      }));
    } catch {
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [id]: (state.messagesByConversation[id] ?? []).map((message) =>
            message._id === tempId
              ? { ...message, pending: false, failed: true }
              : message,
          ),
        },
      }));
    }
  },

  // ── sendImage ────────────────────────────────────────────────────────────
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

    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [id]: [...(state.messagesByConversation[id] ?? []), optimistic],
      },
      conversations: touchConversation(state.conversations, id, {
        lastMessage: {
          _id: tempId,
          senderId,
          type: 'IMAGE',
          content: '',
          attachmentUrl: uri,
          attachmentName: fileName ?? undefined,
          createdAt: optimistic.createdAt,
        },
        updatedAt: optimistic.createdAt,
      }),
    }));

    try {
      const serverPath = await chatApiService.uploadImage(
        uri,
        fileName,
        mimeType,
      );

      const saved = await chatApiService.sendMessage(id, {
        type: 'IMAGE',
        attachmentUrl: serverPath,
        attachmentName: fileName ?? undefined,
      });

      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [id]: (state.messagesByConversation[id] ?? []).map((message) => {
            if (message._id !== tempId) return message;

            return {
              ...optimistic,
              ...saved,
              _id: saved._id ?? saved.id ?? tempId,
              id: saved.id ?? saved._id ?? tempId,
              pending: false,
              failed: false,
            };
          }),
        },
      }));
    } catch {
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [id]: (state.messagesByConversation[id] ?? []).map((message) =>
            message._id === tempId
              ? { ...message, pending: false, failed: true }
              : message,
          ),
        },
      }));
    }
  },

  // ── editMessage ──────────────────────────────────────────────────────────
  editMessage: async (conversationId, messageId, newContent) => {
    const text = newContent.trim();
    if (!text) return;

    // Snapshot for rollback
    const prev = (get().messagesByConversation[conversationId] ?? []).find(
      (m) => m._id === messageId,
    );
    if (!prev) return;

    // 1. Optimistic update
    set((state) => {
      const list = state.messagesByConversation[conversationId] ?? [];
      const next = list.map((m) =>
        m._id === messageId
          ? { ...m, content: text, edited: true }
          : m,
      );

      // Also refresh conversation list preview if this was the last message
      const last = next[next.length - 1];
      const shouldTouchLast = last?._id === messageId;

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: next,
        },
        conversations: shouldTouchLast
          ? touchConversation(state.conversations, conversationId, {
              lastMessage: {
                _id: last._id,
                senderId: last.senderId,
                type: last.type,
                content: text,
                createdAt: last.createdAt,
              },
              updatedAt: new Date().toISOString(),
            })
          : state.conversations,
      };
    });

    try {
      // 2. API — uncomment / adjust when backend is ready
      // await chatApiService.editMessage(conversationId, messageId, text);
      //
      // Optional: emit socket for other clients
      // getSocket()?.emit('chat:message:edit', { conversationId, messageId, content: text });
    } catch (error) {
      console.warn('editMessage failed', error);
      // 3. Rollback
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: (
            state.messagesByConversation[conversationId] ?? []
          ).map((m) => (m._id === messageId ? prev : m)),
        },
      }));
    }
  },

  // ── deleteMessage ────────────────────────────────────────────────────────
  deleteMessage: async (conversationId, messageId) => {
    const list = get().messagesByConversation[conversationId] ?? [];
    const prev = list.find((m) => m._id === messageId);
    if (!prev) return;

    const wasLast = list[list.length - 1]?._id === messageId;

    // 1. Optimistic remove
    set((state) => {
      const next = (
        state.messagesByConversation[conversationId] ?? []
      ).filter((m) => m._id !== messageId);

      const newLast = next[next.length - 1];

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: next,
        },
        conversations: wasLast
          ? touchConversation(state.conversations, conversationId, {
              lastMessage: newLast
                ? {
                    _id: newLast._id,
                    senderId: newLast.senderId,
                    type: newLast.type,
                    content: newLast.content,
                    attachmentUrl: newLast.attachmentUrl,
                    attachmentName: newLast.attachmentName,
                    createdAt: newLast.createdAt,
                  }
                : undefined,
              updatedAt: newLast?.createdAt ?? new Date().toISOString(),
            })
          : state.conversations,
      };
    });

    try {
      // 2. API — uncomment / adjust when backend is ready
      // await chatApiService.deleteMessage(conversationId, messageId);
      //
      // Optional socket:
      // getSocket()?.emit('chat:message:delete', { conversationId, messageId });
    } catch (error) {
      console.warn('deleteMessage failed', error);
      // 3. Rollback
      set((state) => {
        const current =
          state.messagesByConversation[conversationId] ?? [];
        // re-insert roughly in place by createdAt
        const restored = [...current, prev].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );
        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: restored,
          },
        };
      });
    }
  },

  emitTyping: (id) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('chat:typing', { conversationId: id });
    }
  },

  reset: () => {
    lastAttachedSocket = null;
    initPromise = null;

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