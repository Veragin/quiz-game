import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useGameService } from '../../context/GameContext';
import styles from './Scoreboard.module.css';

const getRankEmoji = (rank: number): string => {
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
};

/** Final standings, and a Play again button for the host. */
export const Scoreboard = observer(() => {
    const game = useGameService();
    const [restarting, setRestarting] = useState(false);

    const handleRestart = async () => {
        setRestarting(true);
        try {
            await game.restart();
        } catch {
            // GameService already surfaced the error.
        } finally {
            setRestarting(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>🏆 Final Scores</h2>
            </div>

            <div className={styles.trophy}>🦈</div>

            <div className={styles.leaderboard}>
                {game.scoreboard.map((entry, index) => {
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
                        <div key={entry.userId} className={entryClass}>
                            <span className={styles.rank}>{getRankEmoji(rank)}</span>
                            <div className={styles.playerInfo}>
                                <span
                                    className={`${styles.playerName} ${
                                        rank === 1 ? styles.playerNameFirst : ''
                                    }`}
                                >
                                    {entry.name}
                                </span>
                            </div>
                            <span
                                className={`${styles.score} ${rank === 1 ? styles.scoreFirst : ''}`}
                            >
                                {entry.score}
                            </span>
                        </div>
                    );
                })}
            </div>

            {game.isHost && (
                <button
                    className={styles.restartButton}
                    onClick={handleRestart}
                    disabled={restarting}
                >
                    {restarting ? 'Starting...' : 'Play again 🌊'}
                </button>
            )}
        </div>
    );
});
