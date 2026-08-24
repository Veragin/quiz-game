import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useGameService } from '../../context/GameContext';
import styles from './Prepare.module.css';

/**
 * The lobby: who is in, and the question list the host can edit before the
 * game starts. The list is seeded from questions.txt by the server.
 */
export const Prepare = observer(() => {
    const game = useGameService();
    const { isHost } = game;

    const [drafts, setDrafts] = useState<string[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [starting, setStarting] = useState(false);

    // Follow the server list until the host starts editing, so another host's
    // changes are not overwritten by a stale draft.
    const serverQuestions = JSON.stringify(game.questions.map((question) => question.text));
    useEffect(() => {
        if (!dirty) {
            setDrafts(JSON.parse(serverQuestions) as string[]);
        }
    }, [serverQuestions, dirty]);

    const edit = (next: string[]) => {
        setDrafts(next);
        setDirty(true);
    };

    const update = (index: number, text: string) =>
        edit(drafts.map((item, i) => (i === index ? text : item)));

    const remove = (index: number) => edit(drafts.filter((_, i) => i !== index));

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= drafts.length) return;
        const next = [...drafts];
        [next[index], next[target]] = [next[target], next[index]];
        edit(next);
    };

    const add = () => edit([...drafts, '']);

    const save = async () => {
        setSaving(true);
        try {
            await game.setQuestions(drafts.map((text) => text.trim()).filter(Boolean));
            setDirty(false);
        } catch {
            // GameService already surfaced the error.
        } finally {
            setSaving(false);
        }
    };

    const start = async () => {
        setStarting(true);
        try {
            if (dirty) {
                await game.setQuestions(drafts.map((text) => text.trim()).filter(Boolean));
                setDirty(false);
            }
            await game.start();
        } catch {
            // GameService already surfaced the error.
        } finally {
            setStarting(false);
        }
    };

    const validCount = drafts.filter((text) => text.trim()).length;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Gathering the Shiver 🦈</h2>
                <p className={styles.subtitle}>
                    {isHost
                        ? 'Set the questions and start when everyone is aboard.'
                        : 'Waiting for the host to start the game...'}
                </p>
            </div>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Players ({game.players.length})</h3>
                <div className={styles.playerList}>
                    {game.players.map((player) => (
                        <span
                            key={player.userId}
                            className={`${styles.playerTag} ${
                                player.isDisconnected ? styles.playerTagAway : ''
                            }`}
                        >
                            {player.name}
                        </span>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Questions ({validCount})</h3>

                {!isHost && (
                    <ol className={styles.readonlyList}>
                        {game.questions.map((question) => (
                            <li key={question.id} className={styles.readonlyItem}>
                                {question.text}
                            </li>
                        ))}
                    </ol>
                )}

                {isHost && (
                    <>
                        <ol className={styles.editList}>
                            {drafts.map((text, index) => (
                                <li key={index} className={styles.editRow}>
                                    <span className={styles.rowNumber}>{index + 1}</span>
                                    <input
                                        className={styles.input}
                                        value={text}
                                        onChange={(e) => update(index, e.target.value)}
                                        placeholder="Ask something..."
                                        maxLength={300}
                                    />
                                    <button
                                        className={styles.iconButton}
                                        onClick={() => move(index, -1)}
                                        disabled={index === 0}
                                        title="Move up"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        className={styles.iconButton}
                                        onClick={() => move(index, 1)}
                                        disabled={index === drafts.length - 1}
                                        title="Move down"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                        onClick={() => remove(index)}
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ol>

                        <div className={styles.editActions}>
                            <button className={styles.secondaryButton} onClick={add}>
                                + Add question
                            </button>
                            <button
                                className={styles.secondaryButton}
                                onClick={save}
                                disabled={!dirty || saving || validCount === 0}
                            >
                                {saving ? 'Saving...' : 'Save questions'}
                            </button>
                        </div>
                    </>
                )}
            </section>

            {isHost && (
                <div className={styles.footer}>
                    <button
                        className={styles.startButton}
                        onClick={start}
                        disabled={starting || validCount === 0 || game.activePlayers.length < 2}
                    >
                        {starting ? 'Starting...' : 'Start the game 🌊'}
                    </button>
                    {game.activePlayers.length < 2 && (
                        <span className={styles.hint}>At least 2 players are needed.</span>
                    )}
                </div>
            )}
        </div>
    );
});
