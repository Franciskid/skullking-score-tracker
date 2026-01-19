import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="glow-text">Skull King</h1>
        <p>Le Scoreboard Ultime</p>
      </header>

      <section className={styles.hero}>
        <div className={styles.pirateWrapper}>
          <img src="/assets/Pirate.png" alt="" className={styles.peekingPirate} />
          <div className={`glass ${styles.mainCard}`}>
            <h2>Prêt pour l'aventure ?</h2>
            <div className={styles.actions}>
              <Link href="/game/new" className={styles.primaryBtn}>Nouvelle Partie</Link>
              <Link href="/games" className={styles.secondaryBtn}>Historique</Link>
              <Link href="/leaderboard" className={styles.secondaryBtn}>Classement</Link>
            </div>
          </div>
        </div>
        <div className={styles.adminLink}>
          <Link href="/admin/login">Connexion Admin</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>
          © 2025 Skull King Tracker
          <span style={{ margin: '0 8px' }}>•</span>
          <a href="https://github.com/Franciskid/skullking-score-tracker" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Git</a>
        </p>
      </footer>
    </div>
  );
}
