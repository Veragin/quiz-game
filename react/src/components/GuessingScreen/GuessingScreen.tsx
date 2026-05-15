import type { Player } from '../../types';
import { PlayerVotes } from '../PlayerVotes/PlayerVotes';
import styles from './GuessingScreen.module.css';

interface GuessingScreenProps {
  phase: 'guessing' | 'result';
  currentQuestion: string;
  options: string[];
  players: Player[];
  votes: string[];
  result: string[];
  resultScore: number | null;
  onVote: (optionIndex: number, playerToken: string) => void;
  onSendVote: () => void;
}

export function GuessingScreen({
  phase,
  currentQuestion,
  options,
  players,
  votes,
  result,
  resultScore,
  onVote,
  onSendVote,
}: GuessingScreenProps) {
  const getButtonClass = (optionIndex: number, player: Player): string => {
    const classes = [styles.playerButton];
    const isSelected = votes[optionIndex] === player.token;
    const isCorrect = phase === 'result' && result[optionIndex] === player.token;
    const isWrongSelection =
      phase === 'result' && isSelected && result[optionIndex] !== player.token;

    if (isCorrect) {
      classes.push(styles.playerButtonCorrect);
    } else if (isWrongSelection) {
      classes.push(styles.playerButtonWrong);
    } else if (isSelected) {
      classes.push(styles.playerButtonSelected);
    }

    return classes.join(' ');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {phase === 'guessing' ? (
          <h2 className={styles.title}>Who Said What? 🔍</h2>
        ) : (
          <>
            <h2 className={styles.title}>Results</h2>
            {resultScore !== null && (
              <div className={styles.scoreDisplay}>
                🎯 Score: +{resultScore}
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.currentQuestion}>
        <p className={styles.questionText}>{currentQuestion}</p>
      </div>

      {options.map((option, optionIndex) => (
        <div
          key={optionIndex}
          className={`${styles.optionCard} ${
            phase === 'result' && result[optionIndex] ? styles.optionCorrect : ''
          }`}
        >
          <p className={styles.answerText}>"{option}"</p>
          <div className={styles.playerButtons}>
            {players.map((player) => (
              <button
                key={player.token}
                className={getButtonClass(optionIndex, player)}
                onClick={() => onVote(optionIndex, player.token)}
                disabled={phase === 'result'}
              >
                {phase === 'result' && result[optionIndex] === player.token
                  ? `✓ ${player.name}`
                  : player.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className={styles.footer}>
        <button className={styles.voteButton} onClick={onSendVote}>
          {phase === 'guessing' ? 'Vote 🌊' : 'Next ▶'}
        </button>
        <PlayerVotes players={players} />
      </div>
    </div>
  );
}

export default GuessingScreen;
