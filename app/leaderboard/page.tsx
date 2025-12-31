import { createClient } from '@/lib/supabase/server';
import styles from './leaderboard.module.css';

interface PlayerStats {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  totalPoints: number;
  average: number;
}

export default async function LeaderboardPage() {
  const supabase = await createClient();

  // Fetch only finished game results
  const { data: results } = await supabase
    .from('game_players')
    .select(`
      player_id,
      total_score,
      players (name),
      game_id,
      games!inner(status)
    `)
    .eq('games.status', 'finished');

  const statsMap = new Map<string, PlayerStats>();
  const gameTopScores = new Map<string, number>();
  const gameWinnerIds = new Map<string, Set<string>>();

  if (results) {
    // 1. Find top score for each game
    results.forEach(r => {
      const currentTop = gameTopScores.get(r.game_id) || -Infinity;
      if (r.total_score > currentTop) {
        gameTopScores.set(r.game_id, r.total_score);
        gameWinnerIds.set(r.game_id, new Set([r.player_id]));
      } else if (r.total_score === currentTop) {
        // Tie - add to winners
        gameWinnerIds.get(r.game_id)?.add(r.player_id);
      }
    });

    // 2. Aggregate Stats
    results.forEach(r => {
      if (!r.players) return;

      const stats = statsMap.get(r.player_id) || {
        id: r.player_id,
        name: (r.players as any)?.name || 'Unknown',
        gamesPlayed: 0,
        wins: 0,
        totalPoints: 0,
        average: 0
      };

      stats.gamesPlayed += 1;
      stats.totalPoints += r.total_score;
      // Award win to ALL tied players
      if (gameWinnerIds.get(r.game_id)?.has(r.player_id)) {
        stats.wins += 1;
      }
      statsMap.set(r.player_id, stats);
    });
  }

  // 3. Calculate Average & Sort
  const leaderboard = Array.from(statsMap.values())
    .map(p => ({ ...p, average: Math.round(p.totalPoints / p.gamesPlayed) }))
    .sort((a, b) => b.wins - a.wins || b.totalPoints - a.totalPoints);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="glow-text">Panthéon des Pirates</h1>
        <p>Les plus redoutables pirates des sept mers</p>
      </header>

      <div className={styles.tableContainer}>
        <table className={`glass ${styles.table}`}>
          <thead>
            <tr>
              <th>Rang</th>
              <th>Pirate</th>
              <th>Victoires</th>
              <th>Parties</th>
              <th>Moy. Pts</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player, index) => (
              <tr key={player.id} className={index < 3 ? styles[`rank${index + 1}`] : ''}>
                <td className={styles.rank}>
                  {index === 0 && '👑'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && index + 1}
                </td>
                <td className={styles.name}>{player.name}</td>
                <td>{player.wins}</td>
                <td>{player.gamesPlayed}</td>
                <td>{player.average}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
