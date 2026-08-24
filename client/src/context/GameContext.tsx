import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { GameService } from '../services/GameService';
import { useSocketContext } from './SocketContext';

const GameContext = createContext<GameService | null>(null);

export const GameProvider = ({ children }: { children: ReactNode }) => {
    const { socket } = useSocketContext();

    const [service] = useState(() => new GameService());

    useEffect(() => {
        service.setSocket(socket);
    }, [socket, service]);

    useEffect(() => {
        return () => {
            service.destroy();
        };
    }, [service]);

    return <GameContext.Provider value={service}>{children}</GameContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGameService = () => {
    const ctx = useContext(GameContext);
    if (!ctx) throw new Error('useGameService must be used within GameProvider');
    return ctx;
};
