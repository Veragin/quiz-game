import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RoomsService } from '../rooms/rooms.service';
import { getDefaultQuestions, toQuestions } from './questions';
import {
    TGamePhase,
    TGamePlayerSummary,
    TGameState,
    TQuestion,
    TReveal,
    TRevealBreakdown,
    TScoreEntry,
} from '../types';

/** Guessing needs somebody to guess about. */
const MIN_PLAYERS = 2;
const MAX_QUESTIONS = 50;
const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 500;

type TGamePlayer = {
    userId: string;
    /** questionId → answer */
    answers: Record<string, string>;
    /** answering phase done */
    submitted: boolean;
    /** per option index → guessed userId */
    guess: string[] | null;
    /** index into `order` of the best answer */
    bestVote: number | null;
    score: number;
    /**
     * Left the room mid-game. The seat is gone, but the answers already dealt
     * into the current round stay -- otherwise an option on the table would have
     * no author to guess.
     */
    hasLeft: boolean;
};

type TGame = {
    roomId: string;
    phase: TGamePhase;
    questions: TQuestion[];
    /** userId → player */
    players: Map<string, TGamePlayer>;
    /** which question is being guessed */
    questionIndex: number;
    /** shuffled userIds = the answer order for this question */
    order: string[];
    /** who pressed "Next" on the reveal screen */
    readyForNext: Set<string>;
    /** last scored round, shown during `reveal` */
    reveal: TReveal | null;
};

export type TGameResult = { success: true } | { success: false; error: string };

const ok: TGameResult = { success: true };
const fail = (error: string): TGameResult => ({ success: false, error });

/**
 * One game per room, all in memory. Created with the room and destroyed with it;
 * a server restart wipes every game along with every room and session.
 */
@Injectable()
export class GameService {
    private games = new Map<string, TGame>();
    /** Fired whenever a game's state changed and the room needs a push. */
    private changeListeners: Array<(roomId: string) => void> = [];

    constructor(
        private authService: AuthService,
        private roomsService: RoomsService,
    ) {}

    onChange(listener: (roomId: string) => void): void {
        this.changeListeners.push(listener);
    }

    private emitChange(roomId: string): void {
        for (const listener of this.changeListeners) {
            try {
                listener(roomId);
            } catch {
                // A broadcast failure must not corrupt game state.
            }
        }
    }

    // -- Lifecycle --

    createGame(roomId: string): TGame {
        const game: TGame = {
            roomId,
            phase: 'prepare',
            questions: getDefaultQuestions(),
            players: new Map(),
            questionIndex: 0,
            order: [],
            readyForNext: new Set(),
            reveal: null,
        };
        this.games.set(roomId, game);
        return game;
    }

    destroyGame(roomId: string): void {
        this.games.delete(roomId);
    }

    getGame(roomId: string): TGame | null {
        return this.games.get(roomId) ?? null;
    }

    /** A game is created lazily for rooms that predate the game module. */
    private ensureGame(roomId: string): TGame {
        return this.games.get(roomId) ?? this.createGame(roomId);
    }

    /** Adds a seat to the game. Called when a user joins the room. */
    addPlayer(roomId: string, userId: string): void {
        const game = this.ensureGame(roomId);
        const existing = game.players.get(userId);
        if (existing) {
            // Came back after leaving: reinstate the seat, keep the score.
            existing.hasLeft = false;
        } else {
            game.players.set(userId, {
                userId,
                answers: {},
                submitted: false,
                guess: null,
                bestVote: null,
                score: 0,
                hasLeft: false,
            });
        }
        this.emitChange(roomId);
    }

    /**
     * A player left the room. In `prepare` the seat simply disappears; mid-game
     * it is only flagged, because their answers may already be on the table and
     * the reveal has to be able to name them.
     */
    removePlayer(roomId: string, userId: string): void {
        const game = this.games.get(roomId);
        if (!game) return;

        const player = game.players.get(userId);
        if (!player) return;

        if (game.phase === 'prepare') {
            game.players.delete(userId);
        } else {
            player.hasLeft = true;
        }
        game.readyForNext.delete(userId);

        // Their pending "ready" was what everyone else was waiting for.
        this.advanceIfReady(game);
        this.emitChange(roomId);
    }

    /** A socket dropped or came back: the "everyone is ready" gate moved. */
    handleConnectionChange(roomId: string): void {
        const game = this.games.get(roomId);
        if (!game) return;
        this.advanceIfReady(game);
        this.emitChange(roomId);
    }

    // -- Join guard --

    /** Newcomers are only allowed while the game has not started. */
    isOpen(roomId: string): boolean {
        const game = this.games.get(roomId);
        return !game || game.phase === 'prepare';
    }

    isSeated(roomId: string, userId: string): boolean {
        const player = this.games.get(roomId)?.players.get(userId);
        return !!player && !player.hasLeft;
    }

    getPhase(roomId: string): TGamePhase {
        return this.games.get(roomId)?.phase ?? 'prepare';
    }

    // -- Prepare --

    setQuestions(roomId: string, userId: string, texts: string[]): TGameResult {
        const game = this.games.get(roomId);
        if (!game) return fail('Game not found');
        if (game.phase !== 'prepare') return fail('Questions can only be edited before the game');
        if (!this.isHost(roomId, userId)) return fail('Only the host can edit the questions');

        const cleaned = texts
            .map((text) => String(text ?? '').trim().slice(0, MAX_QUESTION_LENGTH))
            .filter(Boolean)
            .slice(0, MAX_QUESTIONS);
        if (!cleaned.length) return fail('At least one question is required');

        game.questions = toQuestions(cleaned);
        this.emitChange(roomId);
        return ok;
    }

    start(roomId: string, userId: string): TGameResult {
        const game = this.games.get(roomId);
        if (!game) return fail('Game not found');
        if (game.phase !== 'prepare') return fail('The game has already started');
        if (!this.isHost(roomId, userId)) return fail('Only the host can start the game');
        if (!game.questions.length) return fail('At least one question is required');
        if (this.activePlayers(game).length < MIN_PLAYERS) {
            return fail(`At least ${MIN_PLAYERS} players are needed`);
        }

        for (const player of game.players.values()) {
            player.answers = {};
            player.submitted = false;
            player.guess = null;
            player.bestVote = null;
            player.score = 0;
        }
        game.phase = 'answering';
        game.questionIndex = 0;
        game.order = [];
        game.reveal = null;
        game.readyForNext.clear();

        this.emitChange(roomId);
        return ok;
    }

    // -- Answering --

    submitAnswers(roomId: string, userId: string, answers: Record<string, string>): TGameResult {
        const game = this.games.get(roomId);
        if (!game) return fail('Game not found');
        if (game.phase !== 'answering') return fail('Not in the answering phase');

        const player = game.players.get(userId);
        if (!player || player.hasLeft) return fail('Not a player in this game');

        const cleaned: Record<string, string> = {};
        for (const question of game.questions) {
            const answer = String(answers?.[question.id] ?? '').trim();
            // A blank answer would leave a hole in the guessing options.
            if (!answer) return fail('Every question needs an answer');
            cleaned[question.id] = answer.slice(0, MAX_ANSWER_LENGTH);
        }

        player.answers = cleaned;
        player.submitted = true;

        this.advanceIfReady(game);
        this.emitChange(roomId);
        return ok;
    }

    // -- Guessing --

    submitGuess(
        roomId: string,
        userId: string,
        guess: string[],
        bestVote: number | null,
    ): TGameResult {
        const game = this.games.get(roomId);
        if (!game) return fail('Game not found');
        if (game.phase !== 'guessing') return fail('Not in the guessing phase');

        const player = game.players.get(userId);
        if (!player || player.hasLeft) return fail('Not a player in this game');

        if (!Array.isArray(guess) || guess.length !== game.order.length) {
            return fail('Guess every answer first');
        }
        const authors = new Set(game.order);
        for (const guessed of guess) {
            if (!authors.has(guessed)) return fail('Guess every answer first');
        }

        if (bestVote !== null) {
            if (!Number.isInteger(bestVote) || bestVote < 0 || bestVote >= game.order.length) {
                return fail('Invalid best-answer vote');
            }
            // The options are anonymised, so this has to be checked here -- the
            // client greying out its own answer is only a convenience.
            if (game.order[bestVote] === userId) {
                return fail('You cannot vote for your own answer');
            }
        }

        player.guess = [...guess];
        player.bestVote = bestVote;

        this.advanceIfReady(game);
        this.emitChange(roomId);
        return ok;
    }

    // -- Reveal --

    markNextReady(roomId: string, userId: string): TGameResult {
        const game = this.games.get(roomId);
        if (!game) return fail('Game not found');
        if (game.phase !== 'reveal') return fail('Not in the reveal phase');

        const player = game.players.get(userId);
        if (!player || player.hasLeft) return fail('Not a player in this game');

        game.readyForNext.add(userId);
        this.advanceIfReady(game);
        this.emitChange(roomId);
        return ok;
    }

    // -- Scoreboard --

    restart(roomId: string, userId: string): TGameResult {
        const game = this.games.get(roomId);
        if (!game) return fail('Game not found');
        if (game.phase !== 'scoreboard') return fail('The game is still running');
        if (!this.isHost(roomId, userId)) return fail('Only the host can start a new game');

        // Players who left during the game do not carry over into the new one.
        for (const [id, player] of game.players) {
            if (player.hasLeft) game.players.delete(id);
        }
        for (const player of game.players.values()) {
            player.answers = {};
            player.submitted = false;
            player.guess = null;
            player.bestVote = null;
            player.score = 0;
        }
        game.phase = 'prepare';
        game.questionIndex = 0;
        game.order = [];
        game.reveal = null;
        game.readyForNext.clear();

        this.emitChange(roomId);
        return ok;
    }

    // -- Phase transitions --

    /**
     * The single "is everyone done?" gate. Only players who are seated, present
     * and connected count -- one closed tab must never freeze the room.
     */
    private advanceIfReady(game: TGame): void {
        const active = this.activePlayers(game);
        if (!active.length) return;

        if (game.phase === 'answering') {
            if (active.every((player) => player.submitted)) {
                this.startRound(game, 0);
            }
            return;
        }

        if (game.phase === 'guessing') {
            if (active.every((player) => player.guess !== null)) {
                this.scoreRound(game);
            }
            return;
        }

        if (game.phase === 'reveal') {
            if (active.every((player) => game.readyForNext.has(player.userId))) {
                if (game.questionIndex >= game.questions.length - 1) {
                    game.phase = 'scoreboard';
                    game.readyForNext.clear();
                } else {
                    this.startRound(game, game.questionIndex + 1);
                }
            }
        }
    }

    /** Deals the answers for one question in a random order. */
    private startRound(game: TGame, questionIndex: number): void {
        const question = game.questions[questionIndex];
        // Only players who actually answered can be on the table.
        const authors = Array.from(game.players.values())
            .filter((player) => player.submitted && player.answers[question.id])
            .map((player) => player.userId);

        for (let i = authors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [authors[i], authors[j]] = [authors[j], authors[i]];
        }

        game.phase = 'guessing';
        game.questionIndex = questionIndex;
        game.order = authors;
        game.reveal = null;
        game.readyForNext.clear();
        for (const player of game.players.values()) {
            player.guess = null;
            player.bestVote = null;
        }
    }

    /** Scores the closed round and builds the reveal payload. */
    private scoreRound(game: TGame): void {
        const question = game.questions[game.questionIndex];
        const votes = game.order.map(() => 0);
        const breakdown: TRevealBreakdown[] = [];

        // Correct-author guesses.
        const correctByUser = new Map<string, number>();
        for (const player of game.players.values()) {
            if (!player.guess) continue;
            const correct = player.guess.filter((guessed, i) => guessed === game.order[i]).length;
            correctByUser.set(player.userId, correct);
            player.score += correct;
            if (player.bestVote !== null && player.bestVote < votes.length) {
                votes[player.bestVote] += 1;
            }
        }

        // Best answer: the most-voted answer(s) earn their author +1. Ties share
        // the bonus; a round where nobody voted awards none.
        const maxVotes = votes.reduce((max, count) => Math.max(max, count), 0);
        const bestAuthors: string[] = [];
        if (maxVotes > 0) {
            votes.forEach((count, i) => {
                const authorId = game.order[i];
                if (count === maxVotes && !bestAuthors.includes(authorId)) {
                    bestAuthors.push(authorId);
                }
            });
            for (const authorId of bestAuthors) {
                const author = game.players.get(authorId);
                if (author) author.score += 1;
            }
        }

        for (const player of game.players.values()) {
            const correctGuesses = correctByUser.get(player.userId) ?? 0;
            const bestBonus = bestAuthors.includes(player.userId) ? 1 : 0;
            breakdown.push({
                userId: player.userId,
                name: this.authService.getDisplayName(player.userId),
                correctGuesses,
                bestBonus,
                gained: correctGuesses + bestBonus,
                score: player.score,
            });
        }

        game.reveal = {
            questionIndex: game.questionIndex,
            questionText: question?.text ?? '',
            authors: [...game.order],
            votes,
            options: game.order.map((userId) => game.players.get(userId)?.answers[question.id] ?? ''),
            bestAuthors,
            breakdown: breakdown.sort((a, b) => b.gained - a.gained),
        };
        game.phase = 'reveal';
        game.readyForNext.clear();
    }

    // -- Projection --

    /** Everyone whose vote we are still waiting for: seated, present, online. */
    private activePlayers(game: TGame): TGamePlayer[] {
        const room = this.roomsService.getRoom(game.roomId);
        return Array.from(game.players.values()).filter((player) => {
            if (player.hasLeft) return false;
            const seat = room?.players.get(player.userId);
            return !!seat && !seat.isDisconnected;
        });
    }

    private isHost(roomId: string, userId: string): boolean {
        return this.roomsService.getRoom(roomId)?.createdBy === userId;
    }

    private isReady(game: TGame, player: TGamePlayer): boolean {
        switch (game.phase) {
            case 'answering':
                return player.submitted;
            case 'guessing':
                return player.guess !== null;
            case 'reveal':
                return game.readyForNext.has(player.userId);
            default:
                return false;
        }
    }

    getPlayerSummaries(roomId: string): TGamePlayerSummary[] {
        const game = this.games.get(roomId);
        if (!game) return [];
        const room = this.roomsService.getRoom(roomId);

        return Array.from(game.players.values()).map((player) => ({
            userId: player.userId,
            name: this.authService.getDisplayName(player.userId),
            isDisconnected: player.hasLeft || (room?.players.get(player.userId)?.isDisconnected ?? true),
            ready: this.isReady(game, player),
            score: player.score,
        }));
    }

    getScoreboard(roomId: string): TScoreEntry[] {
        const game = this.games.get(roomId);
        if (!game) return [];
        return Array.from(game.players.values())
            .map((player) => ({
                userId: player.userId,
                name: this.authService.getDisplayName(player.userId),
                score: player.score,
            }))
            .sort((a, b) => b.score - a.score);
    }

    /**
     * The state as one player may see it. Answers stay private during
     * `answering` and the option ordering stays secret during `guessing` -- the
     * authors only ship with the reveal.
     */
    getStateFor(roomId: string, userId: string): TGameState | null {
        const game = this.games.get(roomId);
        if (!game) return null;

        const player = game.players.get(userId);
        const question = game.questions[game.questionIndex] ?? null;
        const showRound = game.phase === 'guessing' || game.phase === 'reveal';
        const options = showRound
            ? game.order.map((authorId) => game.players.get(authorId)?.answers[question?.id ?? ''] ?? '')
            : [];

        return {
            roomId,
            phase: game.phase,
            questions: game.questions,
            isHost: this.isHost(roomId, userId),
            players: this.getPlayerSummaries(roomId),
            myAnswers: player?.answers ?? {},
            hasSubmitted: player?.submitted ?? false,
            questionIndex: game.questionIndex,
            questionCount: game.questions.length,
            currentQuestion: showRound ? question : null,
            options,
            authorIds: showRound ? [...game.order].sort() : [],
            myOptionIndex: game.phase === 'guessing' ? game.order.indexOf(userId) : -1,
            myGuess: player?.guess ?? null,
            myBestVote: player?.bestVote ?? null,
            reveal: game.phase === 'reveal' ? game.reveal : null,
            scoreboard: game.phase === 'scoreboard' ? this.getScoreboard(roomId) : [],
        };
    }
}
