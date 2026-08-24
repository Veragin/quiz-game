import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout/Layout';
import styles from './LoginPage.module.css';

export const LoginPage = () => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError(null);
        try {
            await login(name.trim());
            navigate('/rooms');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.icon}>🦈</div>
                <h2 className={styles.title}>Dive Into the Quiz!</h2>
                <p className={styles.subtitle}>Enter your name to join the deep...</p>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <input
                        className={styles.input}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name, brave sailor..."
                        maxLength={30}
                        disabled={loading}
                        autoFocus
                    />
                    <button
                        className={styles.button}
                        type="submit"
                        disabled={loading || !name.trim()}
                    >
                        {loading ? 'Diving...' : 'Dive In 🌊'}
                    </button>
                    {error && <p className={styles.error}>{error}</p>}
                </form>
            </div>
        </Layout>
    );
};
