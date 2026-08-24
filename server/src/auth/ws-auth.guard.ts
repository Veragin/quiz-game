import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from './auth.service';

/**
 * Guard for WS events that must not run without a valid token. The rooms
 * gateway resolves the user from its own socket→user map, so this is here for
 * gateways that need the check declaratively.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
    constructor(private authService: AuthService) {}

    canActivate(context: ExecutionContext): boolean {
        const client: Socket = context.switchToWs().getClient();
        const token = client.handshake?.auth?.token ?? client.handshake?.query?.token;

        if (!token || typeof token !== 'string') {
            throw new WsException('Missing auth token');
        }

        const user = this.authService.validateToken(token);
        if (!user) {
            throw new WsException('Invalid auth token');
        }

        (client as any).user = user;
        return true;
    }
}
