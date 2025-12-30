'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('games').delete().eq('id', gameId);
  if (error) throw new Error("Erreur suppression partie");
  revalidatePath('/admin/games');
}
