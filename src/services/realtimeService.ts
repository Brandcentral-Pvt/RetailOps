/**
 * Real-time Service — Unified WebSocket + SSE abstraction
 *
 * Provides a single subscription interface over both transport layers:
 *  - WebSocket  (Socket.io) — low-latency, bidirectional push
 *  - SSE        (EventSource-like polling fallback) — long-lived server stream
 *
 * Both feed into the same event-bus so downstream hooks (React Query
 * invalidation, Zustand stores) stay agnostic to the transport.
 */

import { io } from 'socket.io-client';
import { EVENT_BUS } from '../store/eventBus';
import { refreshAccessToken, handleSessionExpired } from '../lib/api-client';

// ─── Configuration ────────────────────────────────────────────────────────────

const RECONNECT_DELAY   = 1_000;
const RECONNECT_DELAY_MAX = 30_000;
const RECONNECT_ATTEMPTS = Infinity;

let socket  = null;   // lazy singleton
let _subs   = new Map();   // channelName => { listener: fn, active: boolean }

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getSocketUrl() {
    const base = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/api$/, '');
    return base;
}

function getAuthToken(): string | null {
    try {
        return localStorage.getItem('authToken');
    } catch {
        return null;
    }
}

function ensureSocket() {
    if (socket?.connected) return socket;

    if (socket) socket.disconnect();

    // One silent-refresh reconnect attempt per established session; reset on
    // successful (re)connect so a later expiry can refresh again.
    let reauthAttempted = false;

    socket = io(getSocketUrl(), {
        transports: ['websocket'],
        // SECURITY (audit #11): authenticate this client like
        // contexts/SocketContext.jsx does — it previously connected anonymously.
        auth: { token: getAuthToken() },
        reconnection: true,
        reconnectionDelay: RECONNECT_DELAY,
        reconnectionDelayMax: RECONNECT_DELAY_MAX,
        reconnectionAttempts: RECONNECT_ATTEMPTS,
        autoConnect: true,
    });

    socket.on('connect', () => {
        reauthAttempted = false;
        EVENT_BUS.emit('realtime:connected');
    });

    socket.on('connect_error', (err: Error) => {
        EVENT_BUS.emit('realtime:error', { type: 'connection', code: 'connection_failed' });

        // 401 / token-expired semantics -> run the same single-flight silent
        // refresh used by api-client, then reconnect ONCE with the new token.
        // Never for anonymous sessions or when there is no refresh token.
        const message = err?.message ? String(err.message) : '';
        const looksAuthRelated = /(401|403|unauthorized|forbidden|token|auth)/i.test(message);
        if (!looksAuthRelated || reauthAttempted) return;
        // Session presence = access token in storage. The refresh credential
        // itself is the httpOnly cookie (or in-memory token) — silent refresh
        // decides; we only gate on having had a session at all.
        if (!getAuthToken()) return;

        reauthAttempted = true;
        refreshAccessToken()
            .then((token) => {
                if (socket) {
                    socket.auth = { token };
                    socket.connect();
                }
            })
            .catch(() => handleSessionExpired());
    });

    socket.on('disconnect', (reason) => {
        EVENT_BUS.emit('realtime:disconnected', { reason });
    });

    return socket;
}

/**
 * Internal: attach a listener once and keep it alive for the lifetime
 * of the subscription (cleaned on unsubscribe).
 */
function _listen(channel, listener) {
    ensureSocket();
    const s = socket; // capture local reference

    const handler = (payload) => listener(payload);
    const channelName = `realtime:${channel}`;

    _subs.set(channelName, { listener: handler, active: true });
    s.on(channelName, handler);

    return () => unsubscribe(channel);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a listener on a real-time channel.
 *
 * Valid channel names mirror server socket events, e.g.:
 *    'dataUpdate', 'asinUpdated', 'targetReached', 'alertTriggered', 'sellerSynced'
 *
 * @param {string}   channel
 * @param {Function} listener  (payload) => void
 * @returns {Function} unsubscribe
 */
export function subscribe(channel, listener) {
    return _listen(channel, listener);
}

/**
 * Broadcast a client → server message over WebSocket.
 */
export function emit(channel, payload) {
    ensureSocket();
    socket.emit(channel, payload);
}

/**
 * Emit a targeted invalidation so the server fans out a cache-bust signal
 * to all connected clients for a given query key.
 * Equivalent to `reactQuery.client.invalidateQueries(queryKey)` server-side.
 */
export function invalidationBroadcast(queryKey) {
    emit('invalidate', { queryKey });
}

/**
 * Unsubscribe from a channel.
 */
export function unsubscribe(channel) {
    const channelName = `realtime:${channel}`;
    const sub = _subs.get(channelName);
    if (sub) {
        socket?.off(channelName, sub.listener);
        _subs.delete(channelName);
    }
}

/**
 * Returns `true` if the underlying transport is currently connected.
 */
export function isConnected() {
    return socket?.connected ?? false;
}

/**
 * Force-reconnect useful after auth token refresh.
 */
export function reconnect() {
    if (socket) {
        socket.disconnect();
        socket.connect();
    }
}

/**
 * Tear everything down — for logout / page unload.
 */
export function disconnectAll() {
    _subs.forEach((_, channel) => unsubscribe(channel.replace('realtime:', '')));
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
