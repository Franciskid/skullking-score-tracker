import Link from 'next/link';
import styles from './admin.module.css';

export default function AdminDashboard() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Commandement</h1>
        <p>Contrôlez les Sept Mers</p>
      </header>

      <div className={styles.grid}>
        <Link href="/admin/cards" className={`glass ${styles.card}`}>
          <h3>Forge de Cartes</h3>
          <p>Gérer les trésors et l'IA</p>
        </Link>
        
        <Link href="/admin/games" className={`glass ${styles.card}`}>
          <h3>Historique des Parties</h3>
          <p>Voir et gérer les voyages passés</p>
        </Link>
      </div>
    </div>
  );
}
