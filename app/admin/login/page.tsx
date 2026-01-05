'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      // Use hard navigation to ensure middleware sees the new cookie
      window.location.href = '/admin';
    } else {
      setError('Mot de passe invalide');
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={`glass ${styles.form}`}>
        <h2>Accès Capitaine</h2>
        {error && <p className={styles.error}>{error}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className={styles.input}
        />
        <button type="submit" className={styles.button}>Connexion</button>
      </form>
    </div>
  );
}
