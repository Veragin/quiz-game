// Player from server
export interface Player {
  token: string;
  name: string;
  voted: boolean;
}

// Question from server
export interface Question {
  questionId: number;
  question: string;
}

// Game states
export type GamePhase = 'login' | 'questions' | 'guessing' | 'result' | 'finished';

// Messages from server
export interface PlayersMessage {
  type: 'players';
  data: Player[];
}

export interface QuestionsMessage {
  type: 'questions';
  questions: Question[];
}

export interface AnswersMessage {
  type: 'answers';
  answers: Record<number, string>;
}

export interface StateChangeQuestionsMessage {
  type: 'stateChange';
  state: 'questions';
}

export interface StateChangeGuessingMessage {
  type: 'stateChange';
  state: 'guessing';
  questionId: number;
  options: string[];
}

export interface StateChangeResultMessage {
  type: 'stateChange';
  state: 'result';
  questionId: number;
  result: string[]; // array of correct player tokens
}

export interface StateChangeFinishedMessage {
  type: 'stateChange';
  state: 'finished';
  score: { token: string; score: number }[];
}

export type ServerMessage =
  | PlayersMessage
  | QuestionsMessage
  | AnswersMessage
  | StateChangeQuestionsMessage
  | StateChangeGuessingMessage
  | StateChangeResultMessage
  | StateChangeFinishedMessage;

// Game state managed by the app
export interface GameState {
  phase: GamePhase;
  players: Player[];
  questions: Question[];
  answers: Record<number, string>;
  // Guessing state
  currentQuestionId: number | null;
  options: string[];
  votes: string[];
  // Result state
  result: string[];
  resultScore: number | null;
  // Final scores
  finalScores: { token: string; score: number }[];
}
