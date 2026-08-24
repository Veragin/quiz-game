import { OnModuleInit } from '@nestjs/common';
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsGateway } from '../rooms/rooms.gateway';
import { RoomsService } from '../rooms/rooms.service';
import { GameService, TGameResult } from './game.service';
import { TUser } from '../types';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnModuleInit {
    @WebSocketServer()
    server!: Server;

    constructor(
        private gameService: GameService,
        private roomsService: RoomsService,
        private roomsGateway: RoomsGateway,
    ) {}

    onModuleInit(): void {
        // Any state change -- including ones triggered by a leave or a dropped
        // socket rather than by an event handler -- pushes the room a new state.
        this.gameService.onChange((roomId) => this.broadcastState(roomId));
    }

    // -- Client → server --

    @SubscribeMessage('game:request-state')
    handleRequestState(@ConnectedSocket() client: Socket) {
        const ctx = this.context(client);
        if ('error' in ctx) return ctx;

        // A socket that authenticated via the `auth` event may not be in the
        // room's broadcast group yet.
        client.join(ctx.roomId);
        this.sendStateTo(ctx.roomId, ctx.user.id);
        return { success: true };
    }

    @SubscribeMessage('game:set-questions')
    handleSetQuestions(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { questions: string[] },
    ) {
        const ctx = this.context(client);
        if ('error' in ctx) return ctx;
        if (!Array.isArray(data?.questions)) return { error: 'questions must be a list' };

        return this.toAck(this.gameService.setQuestions(ctx.roomId, ctx.user.id, data.questions));
    }

    @SubscribeMessage('game:start')
    handleStart(@ConnectedSocket() client: Socket) {
        const ctx = this.context(client);
        if ('error' in ctx) return ctx;

        const result = this.toAck(this.gameService.start(ctx.roomId, ctx.user.id));
        // The room just closed to newcomers.
        this.roomsGateway.broadcastRoomsUpdate();
        return result;
    }

    @SubscribeMessage('game:submit-answers')
    handleSubmitAnswers(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { answers: Record<string, string> },
    ) {
        const ctx = this.context(client);
        if ('error' in ctx) return ctx;
        if (!data?.answers || typeof data.answers !== 'object') {
            return { error: 'answers must be an object' };
        }

        return this.toAck(this.gameService.submitAnswers(ctx.roomId, ctx.user.id, data.answers));
    }

    @SubscribeMessage('game:submit-guess')
    handleSubmitGuess(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { guess: string[]; bestVote: number | null },
    ) {
        const ctx = this.context(client);
        if ('error' in ctx) return ctx;
        if (!Array.isArray(data?.guess)) return { error: 'guess must be a list' };

        return this.toAck(
            this.gameService.submitGuess(
                ctx.roomId,
                ctx.user.id,
                data.guess,
                data.bestVote ?? null,
            ),
        );
    }

    @SubscribeMessage('game:next')
    handleNext(@ConnectedSocket() client: Socket) {
        const ctx = this.context(client);
        if ('error' in ctx) return ctx;

        return this.toAck(this.gameService.markNextReady(ctx.roomId, ctx.user.id));
    }

    @SubscribeMessage('game:restart')
    handleRestart(@ConnectedSocket() client: Socket) {
        const ctx = this.context(client);
        if ('error' in ctx) return ctx;

        const result = this.toAck(this.gameService.restart(ctx.roomId, ctx.user.id));
        // Back in `prepare`, so the room takes newcomers again.
        this.roomsGateway.broadcastRoomsUpdate();
        return result;
    }

    // -- Server → client --

    /**
     * `game:state` is built per recipient: during `answering` a player only gets
     * their own answers, and during `guessing` the option list must not leak its
     * authors. So this fans out one message per player instead of broadcasting.
     */
    broadcastState(roomId: string): void {
        const room = this.roomsService.getRoom(roomId);
        if (!room) return;

        for (const userId of room.players.keys()) {
            this.sendStateTo(roomId, userId);
        }
        this.server.to(roomId).emit('game:players', this.gameService.getPlayerSummaries(roomId));
    }

    private sendStateTo(roomId: string, userId: string): void {
        const socketId = this.roomsGateway.getSocketId(userId);
        if (!socketId) return;

        const state = this.gameService.getStateFor(roomId, userId);
        if (state) {
            this.server.to(socketId).emit('game:state', state);
        }
    }

    // -- Helpers --

    private context(client: Socket): { user: TUser; roomId: string } | { error: string } {
        const user = this.roomsGateway.getUser(client);
        if (!user) return { error: 'Not authenticated' };

        const roomId = this.roomsService.getRoomIdForUser(user.id);
        if (!roomId) return { error: 'Not in a room' };

        return { user, roomId };
    }

    private toAck(result: TGameResult) {
        return result.success ? { success: true } : { error: result.error };
    }
}
