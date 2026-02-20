import { Controller, Get } from '@nestjs/common';
import { Game } from './Game';

@Controller('public')
export class PublicController {
    constructor(private game: Game) {}

    @Get('startGuessing')
    startGuessing() {
        console.log('Starting guessing phase');
        this.game.state = 'guessing';
        this.game.guessingQuestionId = 0;
        this.game.nextGuessing();
        return 'OK';
    }
}
