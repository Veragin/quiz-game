import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider } from './context/AuthContext';
import { RoomProvider } from './context/RoomContext';
import { GameProvider } from './context/GameContext';
import { LoginPage } from './pages/LoginPage';

const RoomsPage = lazy(() => import('./pages/RoomsPage').then((m) => ({ default: m.RoomsPage })));
const RoomPage = lazy(() => import('./pages/RoomPage').then((m) => ({ default: m.RoomPage })));

export const App = () => {
    return (
        <SocketProvider>
            <AuthProvider>
                <RoomProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route
                            path="/rooms"
                            element={
                                <Suspense fallback={null}>
                                    <RoomsPage />
                                </Suspense>
                            }
                        />
                        <Route
                            path="/room"
                            element={
                                <GameProvider>
                                    <Suspense fallback={null}>
                                        <RoomPage />
                                    </Suspense>
                                </GameProvider>
                            }
                        />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </RoomProvider>
            </AuthProvider>
        </SocketProvider>
    );
};
