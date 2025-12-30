import { createClient } from '@/lib/supabase/server';
import GameInterface from './GameInterface';
import { notFound } from 'next/navigation';

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch Game Players (Columns)
  const { data: gamePlayers, error } = await supabase
    .from('game_players')
    .select(`
      id,
      total_score,
      player_id,
      players (name)
    `)
    .eq('game_id', id)
    .order('created_at', { ascending: true }); // Ensure consistent order

  if (error || !gamePlayers || gamePlayers.length === 0) {
    // console.error("Game Load Error:", error);
    notFound();
  }

  // 2. Fetch All Rounds & Scores (Rows)
  const { data: roundsData } = await supabase
    .from('rounds')
    .select(`
      id,
      round_number,
      scores (
        game_player_id,
        bid,
        tricks_won,
        bonus_points,
        round_score
      )
    `)
    .eq('game_id', id)
    .order('round_number', { ascending: true });

  // 3. Transform Data for the ScoreSheet
  const players = gamePlayers.map((gp: any) => ({
    gamePlayerId: gp.id,
    name: gp.players?.name || 'Unknown',
    total: gp.total_score
  }));

  // Create a map of roundNumber -> playerScores
  const history = (roundsData || []).map((r: any) => {
    const scoreMap: Record<string, any> = {};
    r.scores.forEach((s: any) => {
      scoreMap[s.game_player_id] = {
        bid: s.bid,
        tricks: s.tricks_won,
        bonus: s.bonus_points,
        score: s.round_score
      };
    });
    return {
      roundId: r.id,
      roundNumber: r.round_number,
      playerScores: scoreMap
    };
  });

  // Calculate current round number based on completed rounds
  const currentRound = (roundsData?.length || 0) + 1;

  return (
    <GameInterface
      gameId={id}
      players={players}
      history={history}
      currentRoundNumber={currentRound}
    />
  );
}