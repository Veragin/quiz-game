import { WebSocketGateway, OnGatewayConnection } from '@nestjs/websockets';
import { ClientManager } from './ClientManager';
import { WebSocket } from 'ws';

@WebSocketGateway({ path: '/ws' })
export class WebsocketGateway implements OnGatewayConnection {
    constructor(private clientManager: ClientManager) {}

    handleConnection(ws: WebSocket) {
        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data.toString()) as TAuthMsg;

            if (msg.type === 'authorization') {
                console.log('New client connected', msg.name);
                this.clientManager.addClient(ws, msg);
            }
        };
    }
}

export type TAuthMsg = {
    type: 'authorization';
    token: string;
    name: string;
};
