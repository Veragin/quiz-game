import { makeAutoObservable, runInAction } from 'mobx';
import type { Socket } from 'socket.io-client';
import type { TRoomState, TRoomSummary } from '../types';

export class RoomService {
    rooms: TRoomSummary[] = [];
    /** The room the user is currently inside, pushed by the server. */
    roomState: TRoomState | null = null;
    loading = false;
    error: string | null = null;

    private socket: Socket | null = null;
    private cleanupListeners?: () => void;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    setSocket(socket: Socket | null) {
        this.cleanupListeners?.();
        this.socket = socket;

        if (!socket) return;

        const handleRoomsUpdate = (updated: TRoomSummary[]) => {
            runInAction(() => {
                this.rooms = updated;
            });
        };

        const handleRoomState = (state: TRoomState) => {
            runInAction(() => {
                this.roomState = state;
            });
        };

        socket.on('rooms:update', handleRoomsUpdate);
        socket.on('room:state', handleRoomState);
        // The broadcast the server fires on connect may land before these
        // listeners exist, so pull the current state explicitly.
        socket.emit('rooms:request-state');

        this.cleanupListeners = () => {
            socket.off('rooms:update', handleRoomsUpdate);
            socket.off('room:state', handleRoomState);
        };

        this.fetchRooms();
    }

    fetchRooms() {
        if (!this.socket) return;
        this.loading = true;

        this.socket.emit('rooms:list', (response: TRoomSummary[] | { error: string }) => {
            runInAction(() => {
                this.loading = false;
                if ('error' in response) {
                    this.error =
                        typeof response.error === 'string'
                            ? response.error
                            : 'Nepodařilo se načíst místnosti';
                } else {
                    this.rooms = response;
                    this.error = null;
                }
            });
        });
    }

    createRoom(name: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Nepřipojeno'));
                return;
            }
            this.socket.emit(
                'rooms:create',
                { name },
                (res: { roomId: string } | { error: string }) => {
                    if ('error' in res) reject(new Error(res.error));
                    else resolve(res.roomId);
                },
            );
        });
    }

    joinRoom(roomId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Nepřipojeno'));
                return;
            }
            this.socket.emit(
                'rooms:join',
                { roomId },
                (res: { success: boolean } | { error: string }) => {
                    if ('error' in res) reject(new Error(res.error));
                    else resolve();
                },
            );
        });
    }

    leaveRoom(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Nepřipojeno'));
                return;
            }
            this.socket.emit('rooms:leave', (res: { success: boolean } | { error: string }) => {
                if ('error' in res) {
                    reject(new Error(res.error));
                    return;
                }
                runInAction(() => {
                    this.roomState = null;
                });
                resolve();
            });
        });
    }

    deleteRoom(roomId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Nepřipojeno'));
                return;
            }
            this.socket.emit(
                'rooms:delete',
                { roomId },
                (res: { success: boolean } | { error: string }) => {
                    if ('error' in res) reject(new Error(res.error));
                    else resolve();
                },
            );
        });
    }

    renameRoom(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Nepřipojeno'));
                return;
            }
            this.socket.emit(
                'rooms:rename',
                { name },
                (res: { success: boolean } | { error: string }) => {
                    if ('error' in res) reject(new Error(res.error));
                    else resolve();
                },
            );
        });
    }

    destroy() {
        this.cleanupListeners?.();
        this.socket = null;
    }
}
