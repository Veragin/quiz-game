import { observer } from 'mobx-react-lite';
import { useGameService } from '../../context/GameContext';
import styles from './PlayerStatus.module.css';

/**
 * The "3 / 5 ready" badge. Only connected players are counted -- they are the
 * ones the round is actually waiting for.
 */
export const PlayerStatus = observer(() => {
    const game = useGameService();
    const active = game.activePlayers;
    const readyCount = active.filter((player) => player.ready).length;

    return (
        <div className={styles.badge}>
            <span className={styles.icon}>🌊</span>
            <span>
                {readyCount} / {active.length} ready
            </span>
            <div className={styles.tooltip}>
                {game.players.map((player) => (
                    <div key={player.userId} className={styles.playerRow}>
                        <span className={styles.playerName}>{player.name}</span>
                        {player.isDisconnected ? (
                            <span className={styles.statusOffline}>⚓ away</span>
                        ) : player.ready ? (
                            <span className={styles.statusReady}>✓ Ready</span>
                        ) : (
                            <span className={styles.statusWaiting}>✗ Waiting</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});
