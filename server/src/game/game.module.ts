import { Module, OnModuleInit } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomsService } from '../rooms/rooms.service';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';

/**
 * Wires the game into the room lifecycle through RoomsService' listener seams,
 * so the rooms module stays game-agnostic and no circular dependency appears.
 */
@Module({
    imports: [RoomsModule],
    providers: [GameService, GameGateway],
    exports: [GameService],
})
export class GameModule implements OnModuleInit {
    constructor(
        private roomsService: RoomsService,
        private gameService: GameService,
    ) {}

    onModuleInit(): void {
        this.roomsService.onRoomCreated((roomId) => this.gameService.createGame(roomId));
        this.roomsService.onRoomDeleted((roomId) => this.gameService.destroyGame(roomId));
        this.roomsService.onUserAddedToRoom((userId, roomId) =>
            this.gameService.addPlayer(roomId, userId),
        );
        this.roomsService.onUserRemovedFromRoom((userId, roomId) =>
            this.gameService.removePlayer(roomId, userId),
        );
        this.roomsService.onUserConnectionChanged((_userId, roomId) =>
            this.gameService.handleConnectionChange(roomId),
        );

        // Once the game starts the room is closed: nobody new gets in, but a
        // player who still holds a seat always gets back to their game.
        this.roomsService.setJoinGuard((roomId, userId) =>
            this.gameService.isSeated(roomId, userId) || this.gameService.isOpen(roomId)
                ? null
                : 'Game already in progress',
        );

        // Lets the room list show "in progress" and disable its Join button.
        this.roomsService.setRoomStatusProvider((roomId) => ({
            isOpen: this.gameService.isOpen(roomId),
            phase: this.gameService.getPhase(roomId),
        }));
    }
}
