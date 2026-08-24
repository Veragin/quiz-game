import { makeAutoObservable, runInAction } from 'mobx';
import type { Socket } from 'socket.io-client';
import type { TGamePlayerSummary, TGameState } from '../types';

type TAck = { success: true } | { error: string };

/**
 * The client half of the game contract. Everything the screens render comes
 * from `state`, which the server pushes per recipient -- answers and the author
 * ordering are never in it before they are meant to be.
 */
export class GameService {
    state: TGameState | null = null;
    /** Kept separately: the ready badge updates more often than the phase. */
    players: TGamePlayerSummary[] = [];
    error: string | null = null;

    /** Local edits, flushed to the server on submit. */
    draftAnswers: Record<string, string> = {};
    draftGuess: string[] = [];
    draftBestVote: number | null = null;

    private socket: Socket | null = null;
    private cleanupListeners?: () => void;
    /** Which round the draft guess belongs to, so a new round resets it. */
    private draftRound = -1;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    setSocket(socket: Socket | null) {
        this.cleanupListeners?.();
        this.socket = socket;

        if (!socket) return;

        const handleState = (state: TGameState) => {
            runInAction(() => {
                this.applyState(state);
            });
        };

        const handlePlayers = (players: TGamePlayerSummary[]) => {
            runInAction(() => {
                this.players = players;
            });
        };

        socket.on('game:state', handleState);
        socket.on('game:players', handlePlayers);
        // The push fired while this client was mounting may have been missed.
        socket.emit('game:request-state');

        this.cleanupListeners = () => {
            socket.off('game:state', handleState);
            socket.off('game:players', handlePlayers);
        };
    }

    /** Mirrors the server state into the local drafts without losing typing. */
    private applyState(state: TGameState) {
        this.state = state;
        this.players = state.players;

        if (state.phase === 'answering') {
            // Server-side answers win on the first load / after a reconnect.
            for (const [questionId, answer] of Object.entries(state.myAnswers)) {
                if (this.draftAnswers[questionId] === undefined) {
                    this.draftAnswers[questionId] = answer;
                }
            }
        }

        if (state.phase === 'guessing') {
            if (this.draftRound !== state.questionIndex) {
                this.draftRound = state.questionIndex;
                this.draftGuess = state.myGuess ?? state.options.map(() => '');
                this.draftBestVote = state.myBestVote;
            }
        } else if (state.phase !== 'reveal') {
            this.draftRound = -1;
        }

        if (state.phase === 'prepare') {
            this.draftAnswers = {};
        }
    }

    // -- Derived --

    get phase() {
        return this.state?.phase ?? null;
    }

    get isHost() {
        return this.state?.isHost ?? false;
    }

    get questions() {
        return this.state?.questions ?? [];
    }

    get options() {
        return this.state?.options ?? [];
    }

    get reveal() {
        return this.state?.reveal ?? null;
    }

    get scoreboard() {
        return this.state?.scoreboard ?? [];
    }

    get readyCount() {
        return this.players.filter((player) => player.ready).length;
    }

    /** Everyone we are actually waiting for -- a dropped tab does not count. */
    get activePlayers() {
        return this.players.filter((player) => !player.isDisconnected);
    }

    /** Every question answered = the submit button may light up. */
    get canSubmitAnswers() {
        return this.questions.every((question) => !!this.draftAnswers[question.id]?.trim());
    }

    get canSubmitGuess() {
        return (
            this.draftGuess.length === this.options.length &&
            this.draftGuess.every((userId) => !!userId)
        );
    }

    // -- Local edits --

    setAnswer(questionId: string, answer: string) {
        this.draftAnswers[questionId] = answer;
    }

    setGuess(optionIndex: number, userId: string) {
        const next = [...this.draftGuess];
        next[optionIndex] = userId;
        this.draftGuess = next;
    }

    setBestVote(optionIndex: number | null) {
        this.draftBestVote = this.draftBestVote === optionIndex ? null : optionIndex;
    }

    // -- Server calls --

    setQuestions(questions: string[]) {
        return this.emit('game:set-questions', { questions });
    }

    start() {
        return this.emit('game:start');
    }

    submitAnswers() {
        const answers: Record<string, string> = {};
        for (const question of this.questions) {
            answers[question.id] = this.draftAnswers[question.id]?.trim() ?? '';
        }
        return this.emit('game:submit-answers', { answers });
    }

    submitGuess() {
        return this.emit('game:submit-guess', {
            guess: this.draftGuess,
            bestVote: this.draftBestVote,
        });
    }

    next() {
        return this.emit('game:next');
    }

    restart() {
        return this.emit('game:restart');
    }

    requestState() {
        this.socket?.emit('game:request-state');
    }

    private emit(event: string, payload?: object): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Not connected'));
                return;
            }
            const handle = (res: TAck) => {
                if (res && 'error' in res) {
                    runInAction(() => {
                        this.error = res.error;
                    });
                    reject(new Error(res.error));
                    return;
                }
                runInAction(() => {
                    this.error = null;
                });
                resolve();
            };

            if (payload) this.socket.emit(event, payload, handle);
            else this.socket.emit(event, handle);
        });
    }

    destroy() {
        this.cleanupListeners?.();
        this.socket = null;
    }
}
