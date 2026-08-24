// Shared types live here and ONLY here. client/src/types is a symlink to this
// directory, so the client sees every change automatically -- always edit the
// server-side file.

export type TUser = {
    id: string;
    /** Login name (immutable after login) */
    name: string;
    token: string;
};

export type TPlayer = {
    userId: string;
    /** Socket dropped but the seat is kept, so a refresh puts the player back. */
    isDisconnected: boolean;
};

export type TRoomSettings = {
    maxPlayers: number;
};

export type TRoom = {
    id: string;
    name: string;
    players: Map<string, TPlayer>;
    settings: TRoomSettings;
    createdBy: string;
};

export type TPlayerSummary = {
    userId: string;
    name: string;
    isDisconnected: boolean;
};

/** One entry of the room list on the /rooms screen. */
export type TRoomSummary = {
    id: string;
    name: string;
    playerCount: number;
    maxPlayers: number;
    players: TPlayerSummary[];
    createdBy: string;
    /** false once the game started -- the Join button is disabled for newcomers. */
    isOpen: boolean;
    /** Phase of the room's game, so the list can say "in progress". */
    phase: TGamePhase;
};

/** Detail of a single room, broadcast to everyone inside it. */
export type TRoomState = {
    id: string;
    name: string;
    maxPlayers: number;
    createdBy: string;
    players: TPlayerSummary[];
};

/** Server-driven navigation, e.g. after a reconnect. */
export type TRedirect = {
    to: string;
};

// -- Game --

export type TGamePhase = 'prepare' | 'answering' | 'guessing' | 'reveal' | 'scoreboard';

export type TQuestion = {
    id: string;
    text: string;
};

/** One row of the "3 / 5 ready" badge. */
export type TGamePlayerSummary = {
    userId: string;
    name: string;
    isDisconnected: boolean;
    /** Done with whatever the current phase asks of them. */
    ready: boolean;
    score: number;
};

/**
 * The game as one player sees it. Built per recipient: during `answering` it
 * carries only that player's own answers, and during `guessing` the option list
 * is anonymous -- the authors are never sent before the reveal.
 */
export type TGameState = {
    roomId: string;
    phase: TGamePhase;
    questions: TQuestion[];
    isHost: boolean;
    players: TGamePlayerSummary[];
    /** answering: the recipient's own answers so far (questionId -> answer). */
    myAnswers: Record<string, string>;
    /** answering: true once the recipient submitted. */
    hasSubmitted: boolean;
    /** guessing/reveal: which question is on the table. */
    questionIndex: number;
    questionCount: number;
    currentQuestion: TQuestion | null;
    /** guessing/reveal: the shuffled answers, authors withheld until the reveal. */
    options: string[];
    /**
     * guessing/reveal: who is in the round, i.e. the userIds a guess may name.
     * Sorted by userId, deliberately unrelated to the option order -- who
     * answered is public, which answer is theirs is not.
     */
    authorIds: string[];
    /** guessing: index into `options` holding the recipient's own answer, or -1. */
    myOptionIndex: number;
    /** guessing: the recipient's pending guess (per option -> userId), if any. */
    myGuess: string[] | null;
    /** guessing: the recipient's best-answer vote (index into `options`), if any. */
    myBestVote: number | null;
    /** reveal: filled in only once the round is scored. */
    reveal: TReveal | null;
    /** scoreboard: final standings. */
    scoreboard: TScoreEntry[];
};

/** Sent when a guessing round closes; safe to broadcast, the round is over. */
export type TReveal = {
    questionIndex: number;
    questionText: string;
    /** Per option index: who actually wrote it. */
    authors: string[];
    /** Per option index: how many best-answer votes it collected. */
    votes: number[];
    /** Per option index: the answer text (so the reveal stands on its own). */
    options: string[];
    /** userIds that won the best-answer bonus this round (ties share it). */
    bestAuthors: string[];
    /** Per player: what this round earned them. */
    breakdown: TRevealBreakdown[];
};

export type TRevealBreakdown = {
    userId: string;
    name: string;
    /** Correct author guesses this round. */
    correctGuesses: number;
    /** 1 when this player's answer won the best-answer vote, else 0. */
    bestBonus: number;
    /** correctGuesses + bestBonus. */
    gained: number;
    /** Running total after the round. */
    score: number;
};

export type TScoreEntry = {
    userId: string;
    name: string;
    score: number;
};
