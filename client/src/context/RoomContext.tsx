import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { RoomService } from '../services/RoomService';
import { useSocketContext } from './SocketContext';

const RoomContext = createContext<RoomService | null>(null);

export const RoomProvider = ({ children }: { children: ReactNode }) => {
    const { socket } = useSocketContext();

    const [service] = useState(() => new RoomService());

    useEffect(() => {
        service.setSocket(socket);
    }, [socket, service]);

    useEffect(() => {
        return () => {
            service.destroy();
        };
    }, [service]);

    return <RoomContext.Provider value={service}>{children}</RoomContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRoomService = () => {
    const ctx = useContext(RoomContext);
    if (!ctx) throw new Error('useRoomService must be used within RoomProvider');
    return ctx;
};
