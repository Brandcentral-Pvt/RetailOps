import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (user) {
            const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');
            const newSocket = io(socketUrl, {
                transports: ['websocket'],
                autoConnect: true
            });
            setSocket(newSocket);

            newSocket.emit('join', user._id || user.id);

            return () => newSocket.close();
        } else if (socket) {
            socket.close();
            setSocket(null);
        }
    }, [user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
