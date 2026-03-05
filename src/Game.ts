import { Injectable } from '@nestjs/common';
import * as fsp from 'fs/promises';
import { ClientManager } from './ClientManager';

@Injectable()
export class Game {
    clientManager: ClientManager | null = null;
    questions: TQuestion[] = [];
    data: Record<string, TData> = {};

    state: 'questions' | 'guessing' | 'result' | 'finished' = 'questions';
    guessingQuestionId = 0;
    guessingResults: string[] = [];

    async init(clientManager: ClientManager) {
        this.clientManager = clientManager;
        const data = await fsp.readFile('questions.txt', 'utf-8');
        this.questions = data.split('\n').map((q, index) => ({ questionId: index, question: q }));
    }

    vote(token: string, vote: string[] | null) {
        if (!this.data[token]) return;
        this.data[token].vote = vote;

        const votePendingCount = Object.values(this.data).filter((d) => d.vote === null).length;
        if (this.state === 'guessing' && votePendingCount === 0) {
            this.state = 'result';
            this.clientManager?.broadcast(this.getState());

            for (const token of Object.keys(this.data)) {
                const score = this.data[token].vote!.filter(
                    (v, i) => v === this.guessingResults[i],
                ).length;
                this.data[token].score += score;
            }
        }

        if (this.state === 'result' && this.playerCount === votePendingCount) {
            if (this.guessingQuestionId >= this.questions.length - 1) {
                this.state = 'finished';
                this.clientManager?.broadcast(this.getState());
                return;
            }
            this.guessingQuestionId++;
            this.state = 'guessing';
            this.nextGuessing();
        }
    }

    nextGuessing() {
        const results = Object.keys(this.data);
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }
        this.guessingResults = results;
        console.log('Next guessing phase', this.guessingQuestionId, this.guessingResults);

        this.clientManager?.broadcast(this.getState());
    }

    getState() {
        if (this.state === 'guessing') {
            const options = this.guessingResults.map(
                (token) => this.data[token].answers[this.guessingQuestionId],
            );
            return JSON.stringify({
                type: 'stateChange',
                state: 'guessing',
                questionId: this.guessingQuestionId,
                options,
            });
        }
        if (this.state === 'result') {
            return JSON.stringify({
                type: 'stateChange',
                state: 'result',
                questionId: this.guessingQuestionId,
                result: this.guessingResults,
            });
        }
        if (this.state === 'finished') {
            return JSON.stringify({
                type: 'stateChange',
                state: 'finished',
                score: Object.entries(this.data)
                    .map(([token, data]) => ({ token, score: data.score }))
                    .sort((a, b) => b.score - a.score),
            });
        }
        return JSON.stringify({
            type: 'stateChange',
            state: this.state,
        });
    }

    get playerCount() {
        return Object.keys(this.data).length;
    }

    didPlayerVote = (token: string) => {
        if (this.state === 'questions') {
            return Object.keys(this.data[token].answers).length === this.questions.length;
        }
        if (this.state === 'guessing') {
            return this.data[token].vote !== null;
        }
        if (this.state === 'result') {
            return this.data[token].vote === null;
        }
        return false;
    };
}

type TData = {
    name: string;
    answers: Record<number, string>;
    vote: null | string[]; // tokens
    score: number;
};

type TQuestion = {
    questionId: number;
    question: string;
};
