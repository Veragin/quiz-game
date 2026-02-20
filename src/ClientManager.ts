import { Injectable } from '@nestjs/common';
import { TAuthMsg } from './WebsocketGateway';
import { WebSocket } from 'ws';
import { Game } from './Game';

@Injectable()
export class ClientManager {
    private clients: Map<string, WebSocket> = new Map();

    constructor(private game: Game) {
        void this.game.init(this);
    }

    addClient(ws: WebSocket, msg: TAuthMsg) {
        this.broadcast(
            JSON.stringify({ type: 'clientConnected', token: msg.token, name: msg.name }),
        );

        this.clients.set(msg.token, ws);
        if (!this.game.data[msg.token]) {
            this.game.data[msg.token] = {
                name: msg.name,
                answers: {},
                vote: null,
                score: 0,
            };
        } else {
            ws.send(
                JSON.stringify({ type: 'answers', answers: this.game.data[msg.token].answers }),
            );
        }

        ws.onclose = () => this.removeClient(msg.token);
        ws.onmessage = (e) => {
            const data = JSON.parse(e.data.toString()) as TWsMsg;

            if (data.type === 'answers') {
                this.game.data[msg.token].answers = data.answers;
                console.log(this.game.data[msg.token].answers);
            }

            if (data.type === 'vote') {
                this.game.vote(msg.token, data.vote);
            }
        };
        ws.send(JSON.stringify({ type: 'questions', questions: this.game.questions }));
        this.sendClientList();
        ws.send(this.game.getState());
    }

    removeClient(token: string) {
        this.clients.delete(token);
        this.broadcast(JSON.stringify({ type: 'clientDisconnected', token }));
    }

    broadcast(message: string) {
        this.clients.forEach((ws) => ws.send(message));
    }

    sendToClient(token: string, message: string) {
        const ws = this.clients.get(token);
        if (ws) {
            ws.send(message);
        }
    }

    private sendClientList() {
        this.broadcast(
            JSON.stringify({
                type: 'players',
                data: Object.keys(this.game.data).map((key) => ({
                    token: key,
                    name: this.game.data[key].name,
                })),
            }),
        );
    }
}

type TWsMsg =
    | {
          type: 'answers';
          answers: Record<number, string>;
      }
    | {
          type: 'vote';
          vote: string[] | null;
      };
