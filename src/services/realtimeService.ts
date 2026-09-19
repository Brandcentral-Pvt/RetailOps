/**
 * Real-time Service — Unified WebSocket + SSE abstraction
 *
 * Provides a single subscription interface over both transport layers:
 *  - WebSocket  (Socket.io) — low-latency, bidirectional push
 *  - SSE        (EventSource-like polling fallback) — long-lived server stream
 *
 * Both feed into the same event-bus so downstream hooks (React Query
 * invalidation, Zustand stores) stay agnostic to the transport.
 *
 * ✅ Overhauled:
 *  - The socket now authenticates via `auth: { token }` — the server
 *    disconnects unauthenticated handshakes immediately, so every event
 *    was silently dropped before.
 *  - True singleton: `ensureSocket()` reuses the existing socket instead of
 *    tearing it down on every call.
 *  - Server events are bridged onto EVENT_BUS under the `realtime:*`
 *    namespace (via `onAny`), with friendly aliases for the known server
 *    events (`new_system_log`, `new-notification`, `user_status_change`)
 *    that previously never reached the app.
 *  - Channel subscriptions are re-attached automatically on reconnect.
 */

import { io } from 'socket.io-client';
import { EVENT_BUS } from '../store/eventBus';

// ─── Configuration ────────────────────────────────────────────────────────────

const RECONNECT_DELAY   = 1_000;
const RECONNECT_DELAY_MAX = 30_000;
const RECONNECT_ATTEMPTS = Infinity;

let socket  = null;   // lazy singleton — created once, reused everywhere
let _subs   = new Map();   // channelName => Set<{ raw, wrapped }>

// Known server events → friendly EVENT_BUS aliases (in addition to the raw
// `realtime:<event>` forward that onAny performs for every event).
const SERVER_EVENT_ALIASES = {
    'new_system_log':     'realtime:systemLog',
    'new-notification':   'realtime:notification',
    'user_status_change': 'realtime:userStatus',
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getSocketUrl() {
    const base = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/api$/, '');
    return base;
}

function getAuthToken() {
    try {
        return localStorage.getItem('authToken') || undefined;
    } catch {
        return undefined;
    }
}

/** (Re)attach every active channel subscription to the given socket. */
function attachAllSubs() {
    if (!socket) return;
    _subs.forEach((entries, channelName) => {
        entries.forEach(({ raw, wrapped }) => {
            socket.off(channelName, wrapped);
            socket.on(channelName, wrapped);
        });
    });
}

function ensureSocket() {
    if (socket) {
        // ✅ Singleton: never tear down a live/connecting socket — just make
        // sure it's connecting/connects on its own.
        if (!socket.connected) socket.connect();
        return socket;
    }

    socket = io(getSocketUrl(), {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: RECONNECT_DELAY,
        reconnectionDelayMax: RECONNECT_DELAY_MAX,
        reconnectionAttempts: RECONNECT_ATTEMPTS,
        autoConnect: true,
        // ✅ Auth fix: the server verifies socket.handshake.auth.token and
        // disconnects unauthenticated sockets on connect.
        auth: { token: getAuthToken() },
    });

    // ✅ Bus mapping: forward EVERY server event onto the event-bus under the
    // realtime:* namespace, plus a friendly alias for the known events.
    // These realtime:* events were never emitted before, so React Query
    // invalidation bridges and live feeds stayed dead.
    socket.onAny((eventName, payload) => {
        try {
            EVENT_BUS.emit(`realtime:${eventName}`, payload);
            const alias = SERVER_EVENT_ALIASES[eventName];
            if (alias) EVENT_BUS.emit(alias, payload);
        } catch { /* bus listeners must never break the socket */ }
    });

    socket.on('connect', () => {
        // ✅ Re-attach channel subscriptions after every (re)connection so
        // listeners survive network drops and server restarts.
        attachAllSubs();
        EVENT_BUS.emit('realtime:connected');
    });

    socket.on('connect_error', () => {
        EVENT_BUS.emit('realtime:error', { type: 'connection', code: 'connection_failed' });
    });

    socket.on('disconnect', (reason) => {
        EVENT_BUS.emit('realtime:disconnected', { reason });
    });

    return socket;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a listener on a real-time channel.
 *
 * Valid channel names mirror server socket events, e.g.:
 *    'dataUpdate', 'asinUpdated', 'targetReached', 'alertTriggered',
 *    'sellerSynced', 'new_system_log', 'new-notification', 'user_status_change'
 *
 * Every firing also emits `realtime:<channel>` (and the mapped alias) on the
 * EVENT_BUS, so plain bus subscribers can join without a socket reference.
 *
 * @param {string}   channel
 * @param {Function} listener  (payload) => void
 * @returns {Function} unsubscribe
 */
export function subscribe(channel, listener) {
    ensureSocket();

    const wrapped = (payload) => {
        try {
            EVENT_BUS.emit(`realtime:${channel}`, payload);
        } catch { /* ignore bus errors */ }
        listener(payload);
    };

    if (!_subs.has(channel)) _subs.set(channel, new Set());
    const entry = { raw: listener, wrapped };
    _subs.get(channel).add(entry);

    socket.on(channel, wrapped);

    return () => unsubscribe(channel, listener);
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
 * Unsubscribe a listener (or all listeners) from a channel.
 */
export function unsubscribe(channel, listener?) {
    const entries = _subs.get(channel);
    if (!entries) return;
    if (listener) {
        entries.forEach(entry => {
            if (entry.raw === listener) {
                socket?.off(channel, entry.wrapped);
                entries.delete(entry);
            }
        });
    } else {
        entries.forEach(entry => socket?.off(channel, entry.wrapped));
        entries.clear();
    }
    if (entries.size === 0) _subs.delete(channel);
}

/**
 * Returns `true` if the underlying transport is currently connected.
 */
export function isConnected() {
    return socket?.connected ?? false;
}

/**
 * Force-reconnect — drops the singleton so the next `ensureSocket()` creates
 * a fresh connection that picks up the current auth token (call after login
 * or token refresh).
 */
export function reconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    ensureSocket();
}

/**
 * Tear everything down — for logout / page unload.
 */
export function disconnectAll() {
    _subs.forEach((_entries, channel) => unsubscribe(channel));
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
