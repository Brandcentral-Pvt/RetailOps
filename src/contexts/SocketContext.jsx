import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
// ✅ Single-connection fix: this provider used to create its OWN socket.io
// connection, so the app ran two concurrent sockets (this one plus the
// realtimeService singleton the dashboard uses). It now REUSES the shared
// authenticated singleton — one connection, one auth handshake, and the
// token-rotation handling lives in one place.
import { getSocket, reconnect as reconnectRealtime, disconnectAll } from '../services/realtimeService';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (!user) {
            // Logout: tear down the shared connection and its subscriptions.
            // Channel subscribers (realtimeService consumers) re-subscribe on
            // the next login via their own effects.
            disconnectAll();
            socketRef.current = null;
            setSocket(null);
            return;
        }

        if (!socketRef.current) {
            // (Re)create the singleton with the CURRENT auth token, then
            // share that exact instance with all consumers of useSocket().
            reconnectRealtime();
            socketRef.current = getSocket();
            setSocket(socketRef.current);
        }
        const socket = socketRef.current;

        // Notification handling
        socket.on('receive_message', (message) => {
            if (document.hidden && Notification.permission === "granted") {
                new Notification(`New message from ${message.sender?.firstName || 'User'}`, {
                    body: message.content,
                    icon: message.sender?.avatar || '/favicon.ico'
                });
            }
        });

        socket.on('incoming_call', (call) => {
            if (document.hidden && Notification.permission === "granted") {
                new Notification(`Incoming ${call.type} Call`, {
                    body: `${call.callerId?.firstName} is calling you...`,
                    icon: call.callerId?.avatar || '/favicon.ico'
                });
            }
        });

        return () => {
            socket.off('receive_message');
            socket.off('incoming_call');
            // NOTE: never close() here — the connection is shared app-wide.
            // It is closed on logout via disconnectAll() above.
        };
    }, [user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
