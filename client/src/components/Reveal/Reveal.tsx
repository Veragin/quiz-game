import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useAuth } from '../../context/AuthContext';
import { useGameService } from '../../context/GameContext';
import { PlayerStatus } from '../PlayerStatus/PlayerStatus';
import styles from '../Guessing/Guessing.module.css';

/** The round is over: authors, best-answer tally and what everyone gained. */
export const Reveal = observer(() => {
    const game = useGameService();
    const { userId } = useAuth();
    const [sending, setSending] = useState(false);

    const state = game.state;
    const reveal = game.reveal;
    if (!state || !reveal) return null;

    const myGuess = state.myGuess ?? [];
    const mine = reveal.breakdown.find((entry) => entry.userId === userId);
    const nameOf = (id: string) =>
        game.players.find((player) => player.userId === id)?.name ?? 'Unknown';
    const ready = game.players.find((player) => player.userId === userId)?.ready ?? false;

    const handleNext = async () => {
        setSending(true);
        try {
            await game.next();
        } catch {
            // GameService already surfaced the error.
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Results</h2>
                {mine && (
                    <div className={styles.scoreDisplay}>
                        🎯 +{mine.gained}
                        {mine.bestBonus > 0 && ' (incl. ⭐ best answer)'}
                    </div>
                )}
                <p className={styles.progress}>
                    Question {reveal.questionIndex + 1} / {state.questionCount}
                </p>
            </div>

            <div className={styles.currentQuestion}>
                <p className={styles.questionText}>{reveal.questionText}</p>
            </div>

            {reveal.options.map((option, optionIndex) => {
                const authorId = reveal.authors[optionIndex];
                const guessedId = myGuess[optionIndex];
                const wasRight = guessedId === authorId;
                const isBest = reveal.bestAuthors.includes(authorId);

                return (
                    <div
                        key={optionIndex}
                        className={`${styles.optionCard} ${isBest ? styles.optionBest : ''}`}
                    >
                        <div className={styles.answerRow}>
                            <p className={styles.answerText}>"{option}"</p>
                            <span className={styles.voteCount}>
                                ⭐ {reveal.votes[optionIndex]}
                            </span>
                        </div>
                        <div className={styles.playerButtons}>
                            <span
                                className={`${styles.playerButton} ${styles.playerButtonCorrect}`}
                            >
                                ✓ {nameOf(authorId)}
                            </span>
                            {guessedId && !wasRight && (
                                <span
                                    className={`${styles.playerButton} ${styles.playerButtonWrong}`}
                                >
                                    ✗ you said {nameOf(guessedId)}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            <div className={styles.breakdown}>
                <h3 className={styles.breakdownTitle}>This round</h3>
                {reveal.breakdown.map((entry) => (
                    <div key={entry.userId} className={styles.breakdownRow}>
                        <span className={styles.breakdownName}>{entry.name}</span>
                        <span className={styles.breakdownDetail}>
                            {entry.correctGuesses} correct
                            {entry.bestBonus > 0 && ' + ⭐ best answer'} · total {entry.score}
                        </span>
                        <span className={styles.breakdownGain}>+{entry.gained}</span>
                    </div>
                ))}
            </div>

            <div className={styles.footer}>
                <button
                    className={styles.voteButton}
                    onClick={handleNext}
                    disabled={ready || sending}
                >
                    {ready ? 'Waiting for the others 🌊' : sending ? 'Sending...' : 'Next ▶'}
                </button>
                <PlayerStatus />
            </div>
        </div>
    );
});
