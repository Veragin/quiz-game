import type { Player } from '../../types';
import styles from './PlayerVotes.module.css';

interface PlayerVotesProps {
  players: Player[];
}

export function PlayerVotes({ players }: PlayerVotesProps) {
  const readyCount = players.filter((p) => p.voted).length;
  const totalCount = players.length;

  return (
    <div className={styles.badge}>
      <span className={styles.icon}>🌊</span>
      <span>
        {readyCount} / {totalCount} ready
      </span>
      <div className={styles.tooltip}>
        {players.map((player) => (
          <div key={player.token} className={styles.playerRow}>
            <span className={styles.playerName}>{player.name}</span>
            {player.voted ? (
              <span className={styles.statusReady}>✓ Ready</span>
            ) : (
              <span className={styles.statusWaiting}>✗ Waiting</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlayerVotes;
