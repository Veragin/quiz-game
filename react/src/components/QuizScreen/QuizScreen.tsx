import type { Question, Player } from '../../types';
import { PlayerVotes } from '../PlayerVotes/PlayerVotes';
import styles from './QuizScreen.module.css';

interface QuizScreenProps {
  questions: Question[];
  answers: Record<number, string>;
  onAnswerChange: (questionId: number, answer: string) => void;
  onSubmit: () => void;
  players: Player[];
}

export function QuizScreen({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  players,
}: QuizScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Answer the Questions 📝</h2>
      </div>

      {questions.map((q, index) => (
        <div key={q.questionId} className={styles.questionCard}>
          <div className={styles.questionHeader}>
            <div className={styles.questionNumber}>{index + 1}</div>
            <p className={styles.questionText}>{q.question}</p>
          </div>
          <textarea
            className={styles.textarea}
            value={answers[q.questionId] || ''}
            onChange={(e) => onAnswerChange(q.questionId, e.target.value)}
            placeholder="Type your answer..."
          />
        </div>
      ))}

      <div className={styles.footer}>
        <button className={styles.submitButton} onClick={onSubmit}>
          Submit Answers 🦈
        </button>
        <PlayerVotes players={players} />
      </div>
    </div>
  );
}

export default QuizScreen;
