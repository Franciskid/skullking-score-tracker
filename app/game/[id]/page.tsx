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
    .order('created_at', { ascending: true });

  if (error || !gamePlayers || gamePlayers.length === 0) {
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

  // Separate completed rounds from pending (bids entered, no tricks yet)
  const completedRounds: any[] = [];
  let pendingRoundData: { roundNumber: number; bids: Record<string, number> } | null = null;

  for (const r of (roundsData || [])) {
    // Check if any score has null tricks_won (indicates pending)
    const hasPending = (r as any).scores.some((s: any) => s.tricks_won === null);

    if (hasPending) {
      // This is a pending round - extract bids
      const bidsMap: Record<string, number> = {};
      (r as any).scores.forEach((s: any) => {
        bidsMap[s.game_player_id] = s.bid;
      });
      pendingRoundData = { roundNumber: (r as any).round_number, bids: bidsMap };
    } else {
      // Completed round
      const scoreMap: Record<string, any> = {};
      (r as any).scores.forEach((s: any) => {
        scoreMap[s.game_player_id] = {
          bid: s.bid,
          tricks: s.tricks_won,
          bonus: s.bonus_points,
          score: s.round_score
        };
      });
      completedRounds.push({
        roundId: (r as any).id,
        roundNumber: (r as any).round_number,
        playerScores: scoreMap
      });
    }
  }

  // Current round is: pending round number if exists, else completed + 1
  const currentRound = pendingRoundData !== null ? pendingRoundData.roundNumber : completedRounds.length + 1;
  // Initial phase is SCORING if we have a pending round (bids saved), else BIDDING
  const initialPhase = pendingRoundData !== null ? 'SCORING' as const : 'BIDDING' as const;
  // Initial bids from pending round
  const initialBids = pendingRoundData !== null ? pendingRoundData.bids : {};

  return (
    <GameInterface
      gameId={id}
      players={players}
      history={completedRounds}
      currentRoundNumber={currentRound}
      initialPhase={initialPhase}
      initialBids={initialBids}
    />
  );
}