/**
 * Socket.IO client — mirrors the web app's real-time channel.
 * Connect after login; disconnect on logout.
 */
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL, STORAGE_KEYS } from '../config/env';
import { getItem } from './storage';

let socket: Socket | null = null;

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

  return socket;
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