import { createClient } from '@/lib/supabase/server';
import GameList from './GameList';
import styles from './games.module.css';

export default async function PublicGames() {
    const supabase = await createClient();

    // Fetch games with player count
    const { data: games } = await supabase
        .from('games')
        .select(`
      *,
      game_players (
        player:players (name)
      )
    `)
        .order('created_at', { ascending: false });

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Historique des Voyages</h1>
                <p>Registre officiel du Capitaine</p>
            </header>
            <GameList games={games || []} />
        </div>
    );
}
