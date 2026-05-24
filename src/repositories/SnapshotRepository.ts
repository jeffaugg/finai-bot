import { supabase } from '../config/clients';
import { CloseResult, DailySnapshot, DailySnapshotSchema } from '../types';
import { DatabaseError } from '../types/errors';

export interface DailySnapshotInput {
  user_id: string;
  snapshot_date: string;
  current_streak: number;
  success_reserve: number;
  daily_limit: number;
  total_spent: number;
  had_activity: boolean;
  close_result: CloseResult;
}

export class SnapshotRepository {
  async existsForDate(userId: string, dateStr: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('daily_snapshots')
      .select('id')
      .eq('user_id', userId)
      .eq('snapshot_date', dateStr)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(error.message);
    }

    return data !== null;
  }

  // Retorna null se o snapshot do dia já existe o que torna o fechamento idempotente e seguro contra corrida.
  async insert(input: DailySnapshotInput): Promise<DailySnapshot | null> {
    const { data, error } = await supabase
      .from('daily_snapshots')
      .insert(input)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return null;
      }
      throw new DatabaseError(error.message);
    }

    return DailySnapshotSchema.parse(data);
  }
}
