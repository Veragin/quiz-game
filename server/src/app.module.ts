import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { GameModule } from './game/game.module';

// In the exported production tree the compiled server sits at
// <root>/server/dist and the built SPA at <root>/client/dist, so the client is
// two levels up from __dirname -- the same layout `make build` produces.
@Module({
    imports: [
        // No `exclude` pattern: everything but the static files goes over
        // socket.io, and the Express 5 path parser rejects the old `/api/(.*)`
        // form -- with it in place every deep link (e.g. /room) 500s instead of
        // falling back to index.html.
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', '..', 'client', 'dist'),
        }),
        AuthModule,
        RoomsModule,
        GameModule,
    ],
})
export class AppModule {}
