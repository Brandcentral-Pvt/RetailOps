/**
 * Typed client for the backend `/api/messaging` chat module.
 *
 * Uploads reuse the existing `POST /api/files/upload` endpoint; the returned
 * server-side path (`uploads/files/<user>/<file>`) is stored on the message and
 * resolved to a full URL through `assetUrl()`.
 */
import apiClient, { getApiErrorMessage } from './apiClient';
import { SOCKET_URL } from '../config/env';
import type {
  ChatConversation,
  ChatContact,
  ChatMessage,
  ChatParticipant,
  ChatMessageType,
} from '../types';

/** Turn a server file path into a loadable URL. */
export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${SOCKET_URL}/${String(path).replace(/^\/+/, '')}`;
}

function normalizeMessage(raw: Record<string, unknown> & Partial<ChatMessage>): ChatMessage {
  return {
    _id: String(raw._id ?? raw.id ?? ''),
    id: String(raw.id ?? raw._id ?? ''),
    conversationId: String(raw.conversationId ?? ''),
    senderId: String(raw.senderId ?? ''),
    senderName: raw.senderName,
    type: (String(raw.type ?? 'TEXT').toUpperCase() as ChatMessageType),
    content: raw.content ?? '',
    attachmentUrl: raw.attachmentUrl,
    attachmentName: raw.attachmentName,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    readBy: Array.isArray(raw.readBy) ? (raw.readBy as string[]) : [],
    replyTo: raw.replyTo ? String(raw.replyTo) : undefined,
  };
}

function normalizeParticipant(raw: Record<string, unknown> & Partial<ChatParticipant>): ChatParticipant {
  return {
    _id: String(raw._id ?? raw.UserId ?? ''),
    name: raw.name ?? '',
    avatar: raw.avatar,
    roleName: raw.roleName,
    lastReadAt: raw.lastReadAt ? String(raw.lastReadAt) : null,
    isAdmin: Boolean(raw.isAdmin),
  };
}

function normalizeConversation(raw: Record<string, unknown> & Partial<ChatConversation>): ChatConversation {
  const last = raw.lastMessage as Record<string, unknown> | null | undefined;
  return {
    _id: String(raw._id ?? raw.id ?? ''),
    id: String(raw.id ?? raw._id ?? ''),
    type: (String(raw.type ?? 'DIRECT').toUpperCase() as 'DIRECT' | 'GROUP'),
    title: raw.title ? String(raw.title) : null,
    sellerId: raw.sellerId ? String(raw.sellerId) : null,
    createdById: raw.createdById ? String(raw.createdById) : undefined,
    lastMessage: last ? normalizeMessage(last) : null,
    unreadCount: Number(raw.unreadCount ?? 0),
    participants: Array.isArray(raw.participants)
      ? (raw.participants as (Record<string, unknown> & Partial<ChatParticipant>)[]).map(normalizeParticipant)
      : [],
    updatedAt: String(raw.updatedAt ?? raw.CreatedAt ?? new Date().toISOString()),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

async function listConversations(): Promise<ChatConversation[]> {
  const { data } = await apiClient.get('/messaging/conversations');
  const rows = (data?.conversations ?? []) as Record<string, unknown>[];
  return rows.map(normalizeConversation);
}

async function getUnread(): Promise<number> {
  const { data } = await apiClient.get('/messaging/unread');
  return Number(data?.unreadCount ?? 0);
}

async function listContacts(search = ''): Promise<ChatContact[]> {
  const { data } = await apiClient.get('/messaging/contacts', {
    params: search ? { search } : {},
  });
  return (data?.contacts ?? []) as ChatContact[];
}

async function createDirect(userId: string): Promise<ChatConversation> {
  const { data } = await apiClient.post('/messaging/conversations', { userId });
  return normalizeConversation(data?.conversation ?? {});
}

async function createGroup(params: {
  title: string;
  sellerId: string;
  participantIds: string[];
}): Promise<ChatConversation> {
  const { data } = await apiClient.post('/messaging/conversations', {
    group: true,
    ...params,
  });
  return normalizeConversation(data?.conversation ?? {});
}

interface MessagesPage {
  messages: ChatMessage[];
  participants: ChatParticipant[];
  hasMore: boolean;
}

async function getMessages(
  conversationId: string,
  opts: { beforeId?: string; beforeAt?: string; limit?: number } = {},
): Promise<MessagesPage> {
  const { data } = await apiClient.get(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
    { params: opts },
  );
  const messages = ((data?.messages ?? []) as Record<string, unknown>[]).map(normalizeMessage);
  const participants = ((data?.participants ?? []) as Record<string, unknown>[]).map(normalizeParticipant);
  return { messages, participants, hasMore: Boolean(data?.hasMore) };
}

async function sendMessage(
  conversationId: string,
  payload: {
    content?: string;
    type?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    replyTo?: string;
  },
): Promise<ChatMessage> {
  const { data } = await apiClient.post(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
    payload,
  );
  return normalizeMessage(data?.message ?? {});
}

async function markRead(conversationId: string): Promise<{ unreadCount: number; lastReadAt: string }> {
  const { data } = await apiClient.post(
    `/messaging/conversations/${encodeURIComponent(conversationId)}/read`,
  );
  return {
    unreadCount: Number(data?.unreadCount ?? 0),
    lastReadAt: data?.lastReadAt ?? new Date().toISOString(),
  };
}

async function getTurnCredentials(): Promise<{ credentials: { urls: string; username: string; credential: string }[] }> {
  const { data } = await apiClient.get('/calls/turn-credentials');
  return { credentials: data?.credentials || [] };
}

async function uploadImage(uri: string, fileName?: string | null, mimeType?: string | null): Promise<string> {
  const formData = new FormData();
  formData.append('files', {
    uri,
    name: fileName || 'image.jpg',
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);
  const { data } = await apiClient.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const file = data?.files?.[0];
  if (!file?.path) throw new Error('Upload failed. Please try again.');
  return String(file.path);
}

export const chatApiService = {
  listConversations,
  getUnread,
  listContacts,
  createDirect,
  createGroup,
  getMessages,
  sendMessage,
  markRead,
  uploadImage,
  getTurnCredentials,
  assetUrl,
  getErrorMessage: getApiErrorMessage,
};