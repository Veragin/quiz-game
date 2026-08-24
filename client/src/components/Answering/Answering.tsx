import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useGameService } from '../../context/GameContext';
import { PlayerStatus } from '../PlayerStatus/PlayerStatus';
import styles from './Answering.module.css';

/** Everyone answers every question; the round opens once all of them submitted. */
export const Answering = observer(() => {
    const game = useGameService();
    const [submitting, setSubmitting] = useState(false);
    const submitted = game.state?.hasSubmitted ?? false;

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await game.submitAnswers();
        } catch {
            // GameService already surfaced the error.
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Answer the Questions 📝</h2>
            </div>

            {game.questions.map((question, index) => (
                <div key={question.id} className={styles.questionCard}>
                    <div className={styles.questionHeader}>
                        <div className={styles.questionNumber}>{index + 1}</div>
                        <p className={styles.questionText}>{question.text}</p>
                    </div>
                    <textarea
                        className={styles.textarea}
                        value={game.draftAnswers[question.id] ?? ''}
                        onChange={(e) => game.setAnswer(question.id, e.target.value)}
                        placeholder="Type your answer..."
                        maxLength={500}
                        disabled={submitted}
                    />
                </div>
            ))}

            <div className={styles.footer}>
                <button
                    className={styles.submitButton}
                    onClick={handleSubmit}
                    disabled={submitted || submitting || !game.canSubmitAnswers}
                >
                    {submitted
                        ? 'Submitted — waiting for the others 🌊'
                        : submitting
                          ? 'Sending...'
                          : 'Submit Answers 🦈'}
                </button>
                <PlayerStatus />
            </div>
        </div>
    );
});
