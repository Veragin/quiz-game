import type { Player } from '../../types';
import styles from './ScoreboardScreen.module.css';

interface ScoreboardScreenProps {
  scores: { token: string; score: number }[];
  players: Player[];
}

function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '🦈';
  }
}

export function ScoreboardScreen({ scores, players }: ScoreboardScreenProps) {
  const getPlayerName = (token: string): string => {
    const player = players.find((p) => p.token === token);
    return player ? player.name : 'Unknown';
  };

  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>🏆 Final Scores</h2>
      </div>

      <div className={styles.trophy}>🦈</div>

      <div className={styles.leaderboard}>
        {sortedScores.map((entry, index) => {
          const rank = index + 1;
          const entryClass = [
            styles.entry,
            rank === 1 ? styles.entryFirst : '',
            rank === 2 ? styles.entrySecond : '',
            rank === 3 ? styles.entryThird : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={entry.token} className={entryClass}>
              <span className={styles.rank}>{getRankEmoji(rank)}</span>
              <div className={styles.playerInfo}>
                <span
                  className={`${styles.playerName} ${
                    rank === 1 ? styles.playerNameFirst : ''
                  }`}
                >
                  {getPlayerName(entry.token)}
                </span>
              </div>
              <span
                className={`${styles.score} ${
                  rank === 1 ? styles.scoreFirst : ''
                }`}
              >
                {entry.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ScoreboardScreen;
