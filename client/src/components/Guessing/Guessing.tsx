import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useGameService } from '../../context/GameContext';
import { PlayerStatus } from '../PlayerStatus/PlayerStatus';
import styles from './Guessing.module.css';

/**
 * Who said what: one guess per anonymised answer, plus a single vote for the
 * best answer of the round. Voting for your own answer is not allowed -- the
 * server enforces it, this only greys the option out.
 */
export const Guessing = observer(() => {
    const game = useGameService();
    const [submitting, setSubmitting] = useState(false);
    const state = game.state;

    if (!state) return null;

    const submitted = state.myGuess !== null;
    // Only players whose answer is on the table can be guessed.
    const authors = game.players.filter((player) => state.authorIds.includes(player.userId));

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await game.submitGuess();
        } catch {
            // GameService already surfaced the error.
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Who Said What? 🔍</h2>
                <p className={styles.progress}>
                    Question {state.questionIndex + 1} / {state.questionCount}
                </p>
            </div>

            <div className={styles.currentQuestion}>
                <p className={styles.questionText}>{state.currentQuestion?.text}</p>
            </div>

            {state.options.map((option, optionIndex) => {
                const isMine = optionIndex === state.myOptionIndex;
                const isBest = game.draftBestVote === optionIndex;

                return (
                    <div key={optionIndex} className={styles.optionCard}>
                        <div className={styles.answerRow}>
                            <p className={styles.answerText}>"{option}"</p>
                            <button
                                className={`${styles.bestButton} ${
                                    isBest ? styles.bestButtonActive : ''
                                }`}
                                onClick={() => game.setBestVote(optionIndex)}
                                disabled={isMine || submitted}
                                title={
                                    isMine
                                        ? 'You cannot vote for your own answer'
                                        : 'Vote for the best answer'
                                }
                            >
                                {isBest ? '⭐ Best' : '☆ Best'}
                            </button>
                        </div>
                        <div className={styles.playerButtons}>
                            {authors.map((player) => (
                                <button
                                    key={player.userId}
                                    className={`${styles.playerButton} ${
                                        game.draftGuess[optionIndex] === player.userId
                                            ? styles.playerButtonSelected
                                            : ''
                                    }`}
                                    onClick={() => game.setGuess(optionIndex, player.userId)}
                                    disabled={submitted}
                                >
                                    {player.name}
                                </button>
                            ))}
                        </div>
                        {isMine && <p className={styles.ownHint}>Your answer</p>}
                    </div>
                );
            })}

            <div className={styles.footer}>
                <button
                    className={styles.voteButton}
                    onClick={handleSubmit}
                    disabled={submitted || submitting || !game.canSubmitGuess}
                >
                    {submitted
                        ? 'Locked in — waiting for the others 🌊'
                        : submitting
                          ? 'Sending...'
                          : 'Vote 🌊'}
                </button>
                <PlayerStatus />
            </div>
        </div>
    );
});
