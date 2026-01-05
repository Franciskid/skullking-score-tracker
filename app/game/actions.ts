'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function getAllPlayers() {
  const supabase = await createClient();
  const { data } = await supabase.from('players').select('id, name').order('name');
  return data || [];
}

function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export async function createNewGame(playerNames: string[]) {
  const supabase = await createClient();
  const validNames = playerNames.filter(n => n.trim() !== '');

  if (validNames.length < 2) {
    throw new Error("At least 2 players are required");
  }

  // 1. Create Game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({ status: 'active' })
    .select()
    .single();

  if (gameError || !game) {
    console.error('Error creating game:', gameError);
    throw new Error('Failed to create game');
  }

  // Fetch all existing players to enable fuzzy matching
  const { data: allPlayers } = await supabase.from('players').select('id, name');
  const existingPlayersMap = new Map<string, { id: string, originalName: string }>();

  if (allPlayers) {
    allPlayers.forEach(p => {
      existingPlayersMap.set(normalizeName(p.name), { id: p.id, originalName: p.name });
    });
  }

  // 2. Handle Players & Links
  for (const name of validNames) {
    const normalizedInput = normalizeName(name);
    let playerId: string;

    if (existingPlayersMap.has(normalizedInput)) {
      // Use existing player
      playerId = existingPlayersMap.get(normalizedInput)!.id;
    } else {
      // Create new
      const { data: newPlayer, error: createError } = await supabase
        .from('players')
        .insert({ name: name.trim() }) // Store as typed
        .select('id, name')
        .single();

      if (createError || !newPlayer) {
        console.error('Error creating player:', name, createError);
        continue;
      }
      playerId = newPlayer.id;
      // Add to local map in case duplicates in input list (though unusual)
      existingPlayersMap.set(normalizeName(newPlayer.name), { id: newPlayer.id, originalName: newPlayer.name });
    }

    // Link to Game
    await supabase.from('game_players').insert({
      game_id: game.id,
      player_id: playerId
    });
  }

  return game.id;
}

// Save bids during bidding phase - creates round with bids, tricks_won = null
export async function saveBids(
  gameId: string,
  roundNumber: number,
  bids: { gamePlayerId: string, bid: number }[]
) {
  const supabase = await createClient();

  // Check if round already exists
  let { data: existingRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('game_id', gameId)
    .eq('round_number', roundNumber)
    .single();

  let roundId: string;

  if (existingRound) {
    roundId = existingRound.id;
    // Update existing scores
    for (const b of bids) {
      await supabase
        .from('scores')
        .upsert({
          round_id: roundId,
          game_player_id: b.gamePlayerId,
          bid: b.bid,
          tricks_won: null,  // null means bids entered but round not finished
          bonus_points: 0,
          round_score: 0
        }, { onConflict: 'round_id,game_player_id' });
    }
  } else {
    // Create new round
    const { data: newRound, error } = await supabase
      .from('rounds')
      .insert({ game_id: gameId, round_number: roundNumber })
      .select()
      .single();

    if (error || !newRound) throw new Error("Failed to create round");
    roundId = newRound.id;

    // Insert scores with bids only
    for (const b of bids) {
      await supabase.from('scores').insert({
        round_id: roundId,
        game_player_id: b.gamePlayerId,
        bid: b.bid,
        tricks_won: null,  // null means bids entered but round not finished
        bonus_points: 0,
        round_score: 0
      });
    }
  }

  return { success: true, roundId };
}
export async function submitRoundScore(
  gameId: string,
  roundNumber: number,
  playerScores: { gamePlayerId: string, bid: number, tricks: number, bonus: number, score: number }[]
) {
  const supabase = await createClient();

  // 1. Check if round already exists (from saveBids)
  let { data: existingRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('game_id', gameId)
    .eq('round_number', roundNumber)
    .single();

  let roundId: string;

  if (existingRound) {
    // Round exists from bids - update existing scores
    roundId = existingRound.id;
    for (const p of playerScores) {
      // Update existing score row
      await supabase
        .from('scores')
        .update({
          bid: p.bid,
          tricks_won: p.tricks,
          bonus_points: p.bonus,
          round_score: p.score
        })
        .eq('round_id', roundId)
        .eq('game_player_id', p.gamePlayerId);

      // Update total (since previous round_score was 0)
      const { data: gp } = await supabase.from('game_players').select('total_score').eq('id', p.gamePlayerId).single();
      if (gp) {
        await supabase.from('game_players').update({ total_score: gp.total_score + p.score }).eq('id', p.gamePlayerId);
      }
    }
  } else {
    // Create new round
    const { data: newRound, error: roundError } = await supabase
      .from('rounds')
      .insert({ game_id: gameId, round_number: roundNumber })
      .select()
      .single();

    if (roundError || !newRound) throw new Error("Failed to create round");
    roundId = newRound.id;

    // Insert Scores & Update Totals
    for (const p of playerScores) {
      await supabase.from('scores').insert({
        game_player_id: p.gamePlayerId,
        round_id: roundId,
        bid: p.bid,
        tricks_won: p.tricks,
        bonus_points: p.bonus,
        round_score: p.score
      });

      const { data: gp } = await supabase.from('game_players').select('total_score').eq('id', p.gamePlayerId).single();
      if (gp) {
        await supabase.from('game_players').update({ total_score: gp.total_score + p.score }).eq('id', p.gamePlayerId);
      }
    }
  }

  // 3. If Round 10 is finished, mark game as finished
  if (roundNumber === 10) {
    const { data: allPlayers } = await supabase
      .from('game_players')
      .select('player_id, total_score')
      .eq('game_id', gameId)
      .order('total_score', { ascending: false });

    if (allPlayers && allPlayers.length > 0) {
      await supabase
        .from('games')
        .update({
          status: 'finished',
          winner_id: allPlayers[0].player_id
        })
        .eq('id', gameId);
    }
  }

  return { success: true };
}


export async function updateRoundScore(
  gameId: string,
  roundNumber: number,
  playerScores: { gamePlayerId: string, bid: number, tricks: number, bonus: number, score: number }[]
) {
  const supabase = await createClient();

  // 1. Get Round ID
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id')
    .eq('game_id', gameId)
    .eq('round_number', roundNumber)
    .single();

  if (roundError || !round) {
    console.error('Round not found:', roundError);
    throw new Error("Round not found");
  }

  // 2. Update Scores
  for (const p of playerScores) {
    const { data: oldScoreRow } = await supabase
      .from('scores')
      .select('id')
      .eq('round_id', round.id)
      .eq('game_player_id', p.gamePlayerId)
      .single();

    if (!oldScoreRow) {
      console.error('Score row not found for player:', p.gamePlayerId);
      continue;
    }

    // Update Score using the score row ID
    const { error: updateError } = await supabase
      .from('scores')
      .update({
        bid: p.bid,
        tricks_won: p.tricks,
        bonus_points: p.bonus,
        round_score: p.score
      })
      .eq('id', oldScoreRow.id);

    if (updateError) {
      console.error('Error updating score:', updateError);
    }
  }

  // 3. Recalculate total scores from scratch for all players in this game
  for (const p of playerScores) {
    // Get ALL scores for this player in this game
    const { data: allScores } = await supabase
      .from('scores')
      .select('round_score')
      .eq('game_player_id', p.gamePlayerId);

    const totalScore = allScores?.reduce((sum, s) => sum + (s.round_score || 0), 0) || 0;

    await supabase
      .from('game_players')
      .update({ total_score: totalScore })
      .eq('id', p.gamePlayerId);
  }

  return { success: true };
}

export async function resetGame(gameId: string) {
  const supabase = await createClient();

  // Delete all rounds (cascade deletes scores)
  const { error } = await supabase
    .from('rounds')
    .delete()
    .eq('game_id', gameId);

  // Reset total scores
  await supabase
    .from('game_players')
    .update({ total_score: 0 })
    .eq('game_id', gameId);



  return { success: true };

}



export async function getAvailablePlayers() {

  const supabase = await createClient();



  // Fetch players and their game history

  const { data: players } = await supabase

    .from('players')

    .select(`

        id, 

        name,

        game_players (

          total_score,

          game_id

        )

      `);



  if (!players) return [];



  // Calculate stats

  // We need to know if they won. This is expensive without a dedicated stats table/view.

  // For MVP, we'll just count games played and total score. 

  // Wins calculation requires checking all other players in those games.

  // Let's simplified: just return Games Played and Total Score.



  return players.map(p => ({

    id: p.id,

    name: p.name,

    gamesPlayed: p.game_players.length,

    totalScore: p.game_players.reduce((sum, gp) => sum + (gp.total_score || 0), 0)

  })).sort((a, b) => b.gamesPlayed - a.gamesPlayed);

}




