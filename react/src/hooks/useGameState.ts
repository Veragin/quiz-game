import { useCallback, useState } from 'react';
import type { GameState, ServerMessage } from '../types';

const initialState: GameState = {
  phase: 'login',
  players: [],
  questions: [],
  answers: {},
  currentQuestionId: null,
  options: [],
  votes: [],
  result: [],
  resultScore: null,
  finalScores: [],
};

export function useGameState() {
  const [state, setState] = useState<GameState>(initialState);

  const handleMessage = useCallback((msg: ServerMessage) => {
    setState((prev) => {
      switch (msg.type) {
        case 'players':
          return { ...prev, players: msg.data };

        case 'questions':
          return { ...prev, questions: msg.questions };

        case 'answers':
          return { ...prev, answers: { ...prev.answers, ...msg.answers } };

        case 'stateChange': {
          const base = { ...prev, phase: msg.state as GameState['phase'] };

          if (msg.state === 'guessing') {
            return {
              ...base,
              currentQuestionId: msg.questionId,
              options: msg.options,
              votes: msg.options.map(() => ''),
              result: [],
              resultScore: null,
            };
          }

          if (msg.state === 'result') {
            const correctResult = msg.result;
            const score = prev.votes.filter((v, i) => v === correctResult[i]).length;
            return {
              ...base,
              result: correctResult,
              resultScore: score,
            };
          }

          if (msg.state === 'finished') {
            return {
              ...base,
              finalScores: msg.score,
            };
          }

          return base;
        }

        default:
          return prev;
      }
    });
  }, []);

  const setAnswer = useCallback((questionId: number, answer: string) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));
  }, []);

  const setVote = useCallback((index: number, token: string) => {
    setState((prev) => {
      const newVotes = [...prev.votes];
      newVotes[index] = token;
      return { ...prev, votes: newVotes };
    });
  }, []);

  return { state, handleMessage, setAnswer, setVote };
}
