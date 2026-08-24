import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
    TGamePhase,
    TPlayer,
    TRoom,
    TRoomSettings,
    TRoomState,
    TRoomSummary,
    TUser,
} from '../types';
import { AuthService } from '../auth/auth.service';

/** Returns an error message to refuse a join, or null to allow it. */
export type TJoinGuard = (roomId: string, userId: string) => string | null;

/** Lets another module colour the room list with its own per-room status. */
export type TRoomStatusProvider = (roomId: string) => { isOpen: boolean; phase: TGamePhase };

const DEFAULT_MAX_PLAYERS = 15;
const MIN_MAX_PLAYERS = 5;
const MAX_MAX_PLAYERS = 20;
const MAX_ROOM_NAME_LENGTH = 40;

/** All state is in-memory -- a server restart wipes every room and session. */
@Injectable()
export class RoomsService {
    private rooms = new Map<string, TRoom>();
    /** userId → roomId; a user can only be in one room at a time. */
    private userRooms = new Map<string, string>();
    /** Listeners notified when a user is genuinely removed from a room. */
    private userRemovedListeners: Array<(userId: string, roomId: string) => void> = [];
    /** Listeners notified when a user takes a new seat. */
    private userAddedListeners: Array<(userId: string, roomId: string) => void> = [];
    /** Listeners notified when a seated user's socket drops or returns. */
    private connectionChangedListeners: Array<
        (userId: string, roomId: string, isDisconnected: boolean) => void
    > = [];
    /** Listeners notified when a room appears / disappears. */
    private roomCreatedListeners: Array<(roomId: string) => void> = [];
    private roomDeletedListeners: Array<(roomId: string) => void> = [];
    /** Optional veto on new seats, registered by the game module. */
    private joinGuard: TJoinGuard | null = null;
    /** Optional source of the isOpen/phase columns of the room list. */
    private roomStatusProvider: TRoomStatusProvider | null = null;

    constructor(private authService: AuthService) {}

    /**
     * Subscribe to "user removed from room" events (an explicit leave -- not a
     * transient disconnect, which keeps the seat). Lets decoupled subsystems
     * (e.g. the game) purge their own per-user state without a circular
     * dependency.
     */
    onUserRemovedFromRoom(listener: (userId: string, roomId: string) => void): void {
        this.userRemovedListeners.push(listener);
    }

    /** Fires when a user takes a *new* seat (not on a reconnect re-seat). */
    onUserAddedToRoom(listener: (userId: string, roomId: string) => void): void {
        this.userAddedListeners.push(listener);
    }

    /**
     * Fires when a seated user's socket comes or goes. Subsystems that gate on
     * "everyone connected is ready" have to re-evaluate at exactly these moments.
     */
    onUserConnectionChanged(
        listener: (userId: string, roomId: string, isDisconnected: boolean) => void,
    ): void {
        this.connectionChangedListeners.push(listener);
    }

    /** Same seam for room lifecycle: the game is created with the room... */
    onRoomCreated(listener: (roomId: string) => void): void {
        this.roomCreatedListeners.push(listener);
    }

    /** ...and dies with it. */
    onRoomDeleted(listener: (roomId: string) => void): void {
        this.roomDeletedListeners.push(listener);
    }

    /**
     * Registers a veto on *new* seats. Re-seating (a refresh, a dropped socket)
     * never reaches the guard, so a player already in the room always gets back
     * in. Only one guard is supported -- the last registration wins.
     */
    setJoinGuard(guard: TJoinGuard | null): void {
        this.joinGuard = guard;
    }

    /** Feeds the isOpen/phase columns of `listRooms()`. */
    setRoomStatusProvider(provider: TRoomStatusProvider | null): void {
        this.roomStatusProvider = provider;
    }

    private emitUser(
        listeners: Array<(userId: string, roomId: string) => void>,
        userId: string,
        roomId: string,
    ): void {
        for (const listener of listeners) {
            try {
                listener(userId, roomId);
            } catch {
                // A listener failure must not break room bookkeeping.
            }
        }
    }

    private emitUserRemoved(userId: string, roomId: string): void {
        this.emitUser(this.userRemovedListeners, userId, roomId);
    }

    private emitConnectionChanged(userId: string, roomId: string, isDisconnected: boolean): void {
        for (const listener of this.connectionChangedListeners) {
            try {
                listener(userId, roomId, isDisconnected);
            } catch {
                // A listener failure must not break room bookkeeping.
            }
        }
    }

    private emit(listeners: Array<(roomId: string) => void>, roomId: string): void {
        for (const listener of listeners) {
            try {
                listener(roomId);
            } catch {
                // A listener failure must not break room bookkeeping.
            }
        }
    }

    createRoom(name: string, user: TUser): TRoom {
        const settings: TRoomSettings = { maxPlayers: DEFAULT_MAX_PLAYERS };
        const room: TRoom = {
            id: uuidv4(),
            name: name.slice(0, MAX_ROOM_NAME_LENGTH),
            players: new Map(),
            settings,
            createdBy: user.id,
        };
        this.rooms.set(room.id, room);
        this.emit(this.roomCreatedListeners, room.id);
        return room;
    }

    /** Rooms are only removed once the last player has left. */
    deleteRoom(roomId: string): { success: boolean; error?: string } {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        if (room.players.size > 0) {
            return { success: false, error: 'Room is not empty' };
        }
        this.rooms.delete(roomId);
        this.emit(this.roomDeletedListeners, roomId);
        return { success: true };
    }

    joinRoom(roomId: string, user: TUser): { success: boolean; error?: string } {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        if (room.players.has(user.id)) {
            // Already seated here (e.g. a second join after a reconnect).
            room.players.get(user.id)!.isDisconnected = false;
            this.userRooms.set(user.id, roomId);
            this.emitConnectionChanged(user.id, roomId, false);
            return { success: true };
        }
        // Only new seats are vetoed -- the re-seat branch above already returned.
        const refusal = this.joinGuard?.(roomId, user.id) ?? null;
        if (refusal) {
            return { success: false, error: refusal };
        }
        if (room.players.size >= room.settings.maxPlayers) {
            return { success: false, error: 'Room is full' };
        }
        if (this.userRooms.has(user.id)) {
            const existingRoomId = this.userRooms.get(user.id)!;
            const existingRoom = this.rooms.get(existingRoomId);
            const existingPlayer = existingRoom?.players.get(user.id);
            // A stale seat left behind by a dropped socket must not block a new join.
            if (!existingPlayer || existingPlayer.isDisconnected) {
                this.leaveRoom(user.id);
            } else {
                return { success: false, error: 'Already in a room' };
            }
        }

        const player: TPlayer = { userId: user.id, isDisconnected: false };
        room.players.set(user.id, player);
        this.userRooms.set(user.id, roomId);
        this.emitUser(this.userAddedListeners, user.id, roomId);
        return { success: true };
    }

    leaveRoom(userId: string): { roomId: string | null } {
        const roomId = this.userRooms.get(userId);
        if (!roomId) {
            return { roomId: null };
        }

        this.userRooms.delete(userId);

        const room = this.rooms.get(roomId);
        room?.players.delete(userId);
        // Fired even when the room is already gone -- subsystems keyed by user
        // (voice) must drop their state either way.
        this.emitUserRemoved(userId, roomId);
        return { roomId };
    }

    renameRoom(roomId: string, userId: string, name: string): { success: boolean; error?: string } {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        if (!room.players.has(userId)) {
            return { success: false, error: 'Not in room' };
        }
        const trimmed = name.trim();
        if (!trimmed) {
            return { success: false, error: 'Room name is required' };
        }
        room.name = trimmed.slice(0, MAX_ROOM_NAME_LENGTH);
        return { success: true };
    }

    updateSettings(
        roomId: string,
        userId: string,
        settings: Partial<TRoomSettings>,
    ): { success: boolean; error?: string } {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        if (!room.players.has(userId)) {
            return { success: false, error: 'Not in room' };
        }
        if (settings.maxPlayers !== undefined) {
            const clamped = Math.min(
                MAX_MAX_PLAYERS,
                Math.max(MIN_MAX_PLAYERS, Math.round(settings.maxPlayers)),
            );
            if (clamped < room.players.size) {
                return { success: false, error: 'Room already has more players than that' };
            }
            room.settings.maxPlayers = clamped;
        }
        return { success: true };
    }

    /** Keeps the seat but flags it, so a page refresh does not lose the player. */
    markDisconnected(userId: string): { roomId: string | null } {
        const roomId = this.userRooms.get(userId);
        if (!roomId) return { roomId: null };

        const room = this.rooms.get(roomId);
        if (!room) {
            this.userRooms.delete(userId);
            return { roomId: null };
        }

        const player = room.players.get(userId);
        if (player) {
            player.isDisconnected = true;
            this.emitConnectionChanged(userId, roomId, true);
        }
        return { roomId };
    }

    markConnected(userId: string): { roomId: string | null } {
        const roomId = this.userRooms.get(userId);
        if (!roomId) return { roomId: null };

        const room = this.rooms.get(roomId);
        if (!room) {
            this.userRooms.delete(userId);
            return { roomId: null };
        }

        const player = room.players.get(userId);
        if (player) {
            player.isDisconnected = false;
            this.emitConnectionChanged(userId, roomId, false);
        }
        return { roomId };
    }

    listRooms(): TRoomSummary[] {
        return Array.from(this.rooms.values()).map((room) => {
            const status = this.roomStatusProvider?.(room.id) ?? {
                isOpen: true,
                phase: 'prepare' as const,
            };
            return {
                id: room.id,
                name: room.name,
                playerCount: room.players.size,
                maxPlayers: room.settings.maxPlayers,
                players: this.getPlayerSummaries(room),
                createdBy: room.createdBy,
                isOpen: status.isOpen,
                phase: status.phase,
            };
        });
    }

    getRoom(roomId: string): TRoom | null {
        return this.rooms.get(roomId) ?? null;
    }

    getRoomByUserId(userId: string): TRoom | null {
        const roomId = this.userRooms.get(userId);
        if (!roomId) return null;
        return this.rooms.get(roomId) ?? null;
    }

    getRoomIdForUser(userId: string): string | undefined {
        return this.userRooms.get(userId);
    }

    getRoomState(roomId: string): TRoomState | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        return {
            id: room.id,
            name: room.name,
            maxPlayers: room.settings.maxPlayers,
            createdBy: room.createdBy,
            players: this.getPlayerSummaries(room),
        };
    }

    private getPlayerSummaries(room: TRoom) {
        return Array.from(room.players.values()).map((player) => ({
            userId: player.userId,
            name: this.authService.getDisplayName(player.userId),
            isDisconnected: player.isDisconnected,
        }));
    }
}
