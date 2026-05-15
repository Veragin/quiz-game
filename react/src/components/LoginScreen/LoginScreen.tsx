import { useState, type FormEvent, type KeyboardEvent } from 'react';
import styles from './LoginScreen.module.css';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onLogin(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
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
          onKeyDown={handleKeyDown}
          placeholder="Your name, brave sailor..."
          autoFocus
        />
        <button className={styles.button} type="submit" disabled={!name.trim()}>
          Dive In 🌊
        </button>
      </form>
    </div>
  );
}

export default LoginScreen;
