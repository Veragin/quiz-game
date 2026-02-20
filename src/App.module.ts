import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { WebsocketGateway } from './WebsocketGateway';
import { ClientManager } from './ClientManager';
import { Game } from './Game';
import { PublicController } from './Controller';

@Module({
    imports: [
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'public'),
        }),
    ],
    providers: [WebsocketGateway, ClientManager, Game],
    controllers: [PublicController],
})
export class AppModule {}
