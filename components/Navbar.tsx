'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/">
          <Image 
            src="/assets/skull-head.png" 
            alt="Skull" 
            width={40} 
            height={40} 
            className={styles.skullIcon}
          />
          Skull King
        </Link>
      </div>
      <ul className={styles.links}>
        <li>
          <Link href="/" className={pathname === '/' ? styles.active : ''}>Accueil</Link>
        </li>
        <li>
          <Link href="/game/new" className={pathname === '/game/new' ? styles.active : ''}>Nouvelle Partie</Link>
        </li>
        <li>
          <Link href="/leaderboard" className={pathname === '/leaderboard' ? styles.active : ''}>Classement</Link>
        </li>
        <li>
          <Link href="/admin" className={pathname.startsWith('/admin') ? styles.active : ''}>Admin</Link>
        </li>
      </ul>
    </nav>
  );
}
