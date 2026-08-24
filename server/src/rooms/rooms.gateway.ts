import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { RoomsService } from './rooms.service';
import { TUser } from '../types';

@WebSocketGateway({ cors: { origin: '*' } })
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    /** socket.id → User */
    private socketUsers = new Map<string, TUser>();
    /** userId → socket.id */
    private userSockets = new Map<string, string>();

    constructor(
        private authService: AuthService,
        private roomsService: RoomsService,
    ) {}

    handleConnection(client: Socket) {
        const token = client.handshake?.auth?.token ?? client.handshake?.query?.token;

        if (token && typeof token === 'string') {
            const user = this.authService.validateToken(token);
            if (user) {
                this.socketUsers.set(client.id, user);
                this.userSockets.set(user.id, client.id);

                // Reconnect: if the user still holds a seat, re-join and mark connected.
                const { roomId } = this.roomsService.markConnected(user.id);
                if (roomId) {
                    client.join(roomId);
                    client.emit('room:redirect', { to: '/room' });
                    this.broadcastRoomState(roomId);
                    this.broadcastRoomsUpdate();
                } else {
                    client.emit('room:redirect', { to: '/rooms' });
                }
                return;
            }
        }

        client.emit('room:redirect', { to: '/login' });
    }

    handleDisconnect(client: Socket) {
        const user = this.socketUsers.get(client.id);
        if (!user) return;

        const { roomId } = this.roomsService.markDisconnected(user.id);
        this.socketUsers.delete(client.id);
        this.userSockets.delete(user.id);

        if (roomId) {
            this.broadcastRoomState(roomId);
            this.broadcastRoomsUpdate();
        }
    }

    // -- Auth (no guard needed, this is the initial auth event) --

    @SubscribeMessage('auth')
    handleAuth(@ConnectedSocket() client: Socket, @MessageBody() data: { name: string }) {
        if (!data?.name || typeof data.name !== 'string' || !data.name.trim()) {
            return { error: 'Jméno je povinné' };
        }

        const user = this.authService.login(data.name.trim());
        this.socketUsers.set(client.id, user);
        this.userSockets.set(user.id, client.id);
        return { token: user.token, userId: user.id };
    }

    // -- Rooms --

    @SubscribeMessage('rooms:list')
    handleListRooms() {
        return this.roomsService.listRooms();
    }

    @SubscribeMessage('rooms:create')
    handleCreateRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { name: string }) {
        const user = this.getUser(client);
        if (!user) return { error: 'Not authenticated' };
        if (!data?.name?.trim()) return { error: 'Room name is required' };

        const room = this.roomsService.createRoom(data.name.trim(), user);
        this.broadcastRoomsUpdate();
        return { roomId: room.id };
    }

    @SubscribeMessage('rooms:delete')
    handleDeleteRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
        const user = this.getUser(client);
        if (!user) return { error: 'Not authenticated' };
        if (!data?.roomId) return { error: 'roomId is required' };

        const result = this.roomsService.deleteRoom(data.roomId);
        if (result.success) {
            this.broadcastRoomsUpdate();
        }
        return result;
    }

    @SubscribeMessage('rooms:join')
    handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
        const user = this.getUser(client);
        if (!user) return { error: 'Not authenticated' };
        if (!data?.roomId) return { error: 'roomId is required' };

        const result = this.roomsService.joinRoom(data.roomId, user);
        if (result.success) {
            client.join(data.roomId);
            this.broadcastRoomsUpdate();
            this.broadcastRoomState(data.roomId);
        }
        return result;
    }

    @SubscribeMessage('rooms:leave')
    handleLeaveRoom(@ConnectedSocket() client: Socket) {
        const user = this.getUser(client);
        if (!user) return { error: 'Not authenticated' };

        const { roomId } = this.roomsService.leaveRoom(user.id);
        if (roomId) {
            client.leave(roomId);
            this.broadcastRoomsUpdate();
            this.broadcastRoomState(roomId);
        }
        return { success: true };
    }

    /**
     * Explicit state pull. A client that has just mounted cannot rely on the
     * broadcast fired during handleConnection -- its listeners may not be
     * attached yet -- so it asks for the state once it is ready.
     */
    @SubscribeMessage('rooms:request-state')
    handleRequestState(@ConnectedSocket() client: Socket) {
        const user = this.getUser(client);
        if (!user) {
            client.emit('room:redirect', { to: '/login' });
            return;
        }

        const room = this.roomsService.getRoomByUserId(user.id);
        if (!room) {
            client.emit('room:redirect', { to: '/rooms' });
            return;
        }

        // A socket that authenticated via the `auth` event is not subscribed to
        // the room's broadcasts yet.
        client.join(room.id);

        const state = this.roomsService.getRoomState(room.id);
        if (state) {
            client.emit('room:state', state);
        }
    }

    @SubscribeMessage('rooms:rename')
    handleRenameRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { name: string }) {
        const user = this.getUser(client);
        if (!user) return { error: 'Not authenticated' };

        const roomId = this.roomsService.getRoomIdForUser(user.id);
        if (!roomId) return { error: 'Not in a room' };
        if (!data?.name?.trim()) return { error: 'Room name is required' };

        const result = this.roomsService.renameRoom(roomId, user.id, data.name);
        if (result.success) {
            this.broadcastRoomsUpdate();
            this.broadcastRoomState(roomId);
        }
        return result;
    }

    // -- Helpers --

    getUser(client: Socket): TUser | null {
        return this.socketUsers.get(client.id) ?? null;
    }

    getSocketId(userId: string): string | undefined {
        return this.userSockets.get(userId);
    }

    broadcastRoomsUpdate() {
        this.server.emit('rooms:update', this.roomsService.listRooms());
    }

    broadcastRoomState(roomId: string) {
        const state = this.roomsService.getRoomState(roomId);
        if (state) {
            this.server.to(roomId).emit('room:state', state);
        }
    }
}
