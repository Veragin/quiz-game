import { createContext, useContext, useRef, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { withBase } from '../utils/basePath';

const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3002' : '';
const SOCKET_PATH = withBase('/socket.io');

type TSocketContextValue = {
    socket: Socket | null;
    connected: boolean;
    connect: (token?: string) => Socket;
    disconnect: () => void;
};

const SocketContext = createContext<TSocketContextValue | null>(null);

type Props = {
    children: ReactNode;
};

export const SocketProvider = ({ children }: Props) => {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    const connect = useCallback((token?: string) => {
        if (socketRef.current?.connected) {
            return socketRef.current;
        }
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        const s = io(SERVER_URL, {
            path: SOCKET_PATH,
            auth: token ? { token } : undefined,
            transports: ['websocket', 'polling'],
        });

        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));

        socketRef.current = s;
        return s;
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setConnected(false);
        }
    }, []);

    return (
        <SocketContext.Provider
            // eslint-disable-next-line react-hooks/refs
            value={{ socket: socketRef.current, connected, connect, disconnect }}
        >
            {children}
        </SocketContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSocketContext = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocketContext must be used within SocketProvider');
    return ctx;
};
