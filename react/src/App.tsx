import { useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useGameState } from './hooks/useGameState';
import Layout from './components/Layout/Layout';
import LoginScreen from './components/LoginScreen/LoginScreen';
import QuizScreen from './components/QuizScreen/QuizScreen';
import GuessingScreen from './components/GuessingScreen/GuessingScreen';
import ScoreboardScreen from './components/ScoreboardScreen/ScoreboardScreen';

function App() {
  const { state, handleMessage, setAnswer, setVote } = useGameState();
  const { send, login } = useWebSocket({ onMessage: handleMessage });

  const handleLogin = useCallback((name: string) => {
    login(name);
  }, [login]);

  const handleSubmitAnswers = useCallback(() => {
    send({ type: 'answers', answers: state.answers });
  }, [send, state.answers]);

  const handleSendVote = useCallback(() => {
    send({
      type: 'vote',
      vote: state.phase === 'guessing' ? state.votes : null,
    });
  }, [send, state.phase, state.votes]);

  const currentQuestion = state.questions.find(
    (q) => q.questionId === state.currentQuestionId
  )?.question ?? '';

  return (
    <Layout>
      {state.phase === 'login' && (
        <LoginScreen onLogin={handleLogin} />
      )}
      {state.phase === 'questions' && (
        <QuizScreen
          questions={state.questions}
          answers={state.answers}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmitAnswers}
          players={state.players}
        />
      )}
      {(state.phase === 'guessing' || state.phase === 'result') && (
        <GuessingScreen
          phase={state.phase}
          currentQuestion={currentQuestion}
          options={state.options}
          players={state.players}
          votes={state.votes}
          result={state.result}
          resultScore={state.resultScore}
          onVote={setVote}
          onSendVote={handleSendVote}
        />
      )}
      {state.phase === 'finished' && (
        <ScoreboardScreen
          scores={state.finalScores}
          players={state.players}
        />
      )}
    </Layout>
  );
}

export default App;
