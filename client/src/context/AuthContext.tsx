import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketContext } from './SocketContext';
import type { TRedirect } from '../types';

type TAuthState = {
    userId: string | null;
    name: string | null;
    token: string | null;
};

type TAuthContextValue = TAuthState & {
    login: (name: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
};

const AuthContext = createContext<TAuthContextValue | null>(null);

const STORAGE_KEY = 'village_auth';

const loadAuth = (): TAuthState => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as TAuthState;
            if (parsed.userId && parsed.token && parsed.name) return parsed;
        }
    } catch {
        /* ignore */
    }
    return { userId: null, name: null, token: null };
};

const saveAuth = (state: TAuthState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const clearAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [auth, setAuth] = useState<TAuthState>(loadAuth);
    const { connect, disconnect } = useSocketContext();
    const navigate = useNavigate();

    const logout = useCallback(() => {
        disconnect();
        setAuth({ userId: null, name: null, token: null });
        clearAuth();
    }, [disconnect]);

    const handleRedirect = useRef<(d: TRedirect) => void>(() => {});
    // eslint-disable-next-line react-hooks/refs
    handleRedirect.current = (data: TRedirect) => {
        if (data.to === '/login') {
            logout();
        } else {
            navigate(data.to, { replace: true });
        }
    };

    /** Name-only login: the server hands out a token, no password involved. */
    const login = useCallback(
        async (name: string) => {
            const socket = connect();

            return new Promise<void>((resolve, reject) => {
                socket.emit(
                    'auth',
                    { name },
                    (response: { token: string; userId: string } | { error: string }) => {
                        if ('error' in response) {
                            reject(new Error(response.error));
                            return;
                        }
                        const state: TAuthState = {
                            userId: response.userId,
                            name,
                            token: response.token,
                        };
                        setAuth(state);
                        saveAuth(state);

                        // Reconnect with the token for an authenticated session.
                        socket.disconnect();
                        const s = connect(response.token);
                        s.on('room:redirect', (ev) => handleRedirect.current(ev));
                        resolve();
                    },
                );
            });
        },
        [connect, handleRedirect],
    );

    useEffect(() => {
        if (auth.token) {
            const s = connect(auth.token);
            const handler = (ev: TRedirect) => handleRedirect.current(ev);
            s.on('room:redirect', handler);

            return () => {
                s.off('room:redirect', handler);
            };
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.token }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
