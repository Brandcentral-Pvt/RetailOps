/**
 * Socket.IO client — mirrors the web app's real-time channel.
 * Connect after login; disconnect on logout.
 * Handles: chat, notifications, calls, and ads real-time updates.
 */
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL, STORAGE_KEYS } from '../config/env';
import { getItem } from './storage';
import {
  callService,
  setCallSignalSender,
} from './callService';

// Inject the outbound signal hook for callService (breaks the
// callService <-> socketService require cycle).
setCallSignalSender((event, payload) => sendCallSignal(event, payload));

let socket: Socket | null = null;

// Ads real-time listeners
const adsListeners: Map<string, Set<(data: unknown) => void>> = new Map();

function setupAdsSignaling(socket: Socket): void {
  // Ads overview updates
  socket.on('ads:overview', (data: unknown) => {
    console.log('Ads overview update:', data);
    emitAdsSignal('overview', data);
  });

  // Ads series (trend) updates
  socket.on('ads:series', (data: unknown) => {
    console.log('Ads series update:', data);
    emitAdsSignal('series', data);
  });

  // Ads insights updates
  socket.on('ads:insights', (data: unknown) => {
    console.log('Ads insights update:', data);
    emitAdsSignal('insights', data);
  });

  // Ads performance table updates
  socket.on('ads:table', (data: unknown) => {
    console.log('Ads table update:', data);
    emitAdsSignal('table', data);
  });

  // General ads data update (full refresh trigger)
  socket.on('ads:updated', (data: { type: string; period?: string }) => {
    console.log('Ads data updated:', data);
    emitAdsSignal('updated', data);
  });
}

function emitAdsSignal(type: string, data: unknown): void {
  adsListeners.get(type)?.forEach(cb => cb(data));
}

// Subscribe to ads real-time updates
export function onAdsUpdate(type: 'overview' | 'series' | 'insights' | 'table' | 'updated', callback: (data: unknown) => void): () => void {
  if (!adsListeners.has(type)) {
    adsListeners.set(type, new Set());
  }
  adsListeners.get(type)!.add(callback);
  return () => adsListeners.get(type)?.delete(callback);
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await getItem(STORAGE_KEYS.accessToken);

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  // Set up call signaling listeners
  setupCallSignaling(socket);
  
  // Set up ads real-time signaling
  setupAdsSignaling(socket);

  return socket;
}

function setupCallSignaling(socket: Socket): void {
  // Incoming call invitation
  socket.on('call:incoming', (data: {
    callId: string;
    conversationId?: string;
    caller: { _id: string; name: string; avatar?: string };
    callType: 'audio' | 'video';
    offer: RTCSessionDescriptionInit;
  }) => {
    console.log('Incoming call:', data);
    // Store pending call for UI to handle
    callService.emitSignal('call:incoming', data);
  });

  // Call answered by callee
  socket.on('call:answered', (data: {
    callId: string;
    answer: RTCSessionDescriptionInit;
  }) => {
    console.log('Call answered:', data);
    callService.emitSignal('call:answer', data);
  });

  // ICE candidate from remote
  socket.on('call:ice', (data: {
    callId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    callService.emitSignal('call:ice', data);
  });

  // Call ended by remote
  socket.on('call:ended', (data: {
    callId: string;
    reason: 'ended' | 'rejected' | 'missed' | 'failed' | 'busy';
  }) => {
    console.log('Call ended:', data);
    callService.emitSignal('call:end', data);
  });

  // Call rejected
  socket.on('call:rejected', (data: { callId: string }) => {
    console.log('Call rejected:', data);
    callService.emitSignal('call:end', { callId: data.callId, reason: 'rejected' });
  });

  // Call busy
  socket.on('call:busy', (data: { callId: string }) => {
    console.log('Call busy:', data);
    callService.emitSignal('call:end', { callId: data.callId, reason: 'busy' });
  });
}

// Export function to send call signals
export function sendCallSignal(event: 'call:invite' | 'call:answer' | 'call:ice' | 'call:end' | 'call:reject' | 'call:busy', payload: unknown): void {
  if (socket?.connected) {
    socket.emit(event, payload);
  } else {
    console.warn('Socket not connected, cannot send:', event);
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}