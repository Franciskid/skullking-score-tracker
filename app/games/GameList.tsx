'use client';

import styles from './games.module.css';
import Link from 'next/link';

export default function GameList({ games }: { games: any[] }) {
    return (
        <>
            {/* Desktop Table */}
            <div className={`glass ${styles.tableContainer}`}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>ID</th>
                            <th>Pirates</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {games.map((game) => (
                            <tr key={game.id}>
                                <td>{new Date(game.created_at).toLocaleDateString('fr-FR')}</td>
                                <td className={styles.idCol}>{game.id.slice(0, 8)}...</td>
                                <td>
                                    <div className={styles.playerScroll}>
                                        {game.game_players?.map((gp: any) => gp.player?.name).join(', ') || '-'}
                                    </div>
                                </td>
                                <td>
                                    <span className={`${styles.status} ${styles[game.status]}`}>
                                        {game.status === 'active' ? 'En Cours' : 'Terminé'}
                                    </span>
                                </td>
                                <td className={styles.actions}>
                                    <Link href={`/game/${game.id}`} className={styles.viewBtn}>
                                        👁️ Voir
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {games.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                    Aucun voyage enregistré.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className={styles.mobileCards}>
                {games.map((game) => (
                    <div key={game.id} className={`glass ${styles.gameCard}`}>
                        <div className={styles.cardHeader}>
                            <span className={styles.cardDate}>{new Date(game.created_at).toLocaleDateString('fr-FR')}</span>
                            <span className={`${styles.status} ${styles[game.status]}`}>
                                {game.status === 'active' ? 'En Cours' : 'Terminé'}
                            </span>
                        </div>
                        <div className={styles.cardPlayers}>
                            {game.game_players?.map((gp: any) => gp.player?.name).join(', ') || '-'}
                        </div>
                        <div className={styles.cardId}>#{game.id.slice(0, 8)}</div>
                        <div className={styles.cardActions}>
                            <Link href={`/game/${game.id}`} className={styles.viewBtn}>
                                👁️ Voir la partie
                            </Link>
                        </div>
                    </div>
                ))}
                {games.length === 0 && (
                    <div className={`glass ${styles.gameCard}`} style={{ textAlign: 'center' }}>
                        Aucun voyage enregistré.
                    </div>
                )}
            </div>
        </>
    );
}
