import type React from 'react';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>🦈 Quiz Game 🌊</h1>
      </header>

      <main className={styles.content}>{children}</main>

      {/* Animated wave layers */}
      <div className={styles.wavesContainer}>
        <svg
          className={styles.wave}
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            fill="#0d2137"
            d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,234.7C672,245,768,235,864,208C960,181,1056,139,1152,133.3C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        <svg
          className={styles.wave}
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            fill="#00d4aa"
            d="M0,288L48,272C96,256,192,224,288,213.3C384,203,480,213,576,229.3C672,245,768,267,864,261.3C960,256,1056,224,1152,208C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        <svg
          className={styles.wave}
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            fill="#0ea5e9"
            d="M0,256L48,240C96,224,192,192,288,197.3C384,203,480,245,576,256C672,267,768,245,864,224C960,203,1056,181,1152,186.7C1248,192,1344,224,1392,240L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

      {/* Floating bubbles */}
      <div className={styles.bubblesContainer}>
        <div className={styles.bubble} />
        <div className={styles.bubble} />
        <div className={styles.bubble} />
        <div className={styles.bubble} />
        <div className={styles.bubble} />
        <div className={styles.bubble} />
      </div>

      {/* Swimming shark fin */}
      <svg
        className={styles.sharkFin}
        width="40"
        height="30"
        viewBox="0 0 40 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 0C20 0 22 15 35 28C25 28 15 28 5 28C18 15 20 0 20 0Z"
          fill="#1e293b"
          stroke="rgba(0,212,170,0.3)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

export default Layout;
