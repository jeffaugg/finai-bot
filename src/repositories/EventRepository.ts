import { supabase } from '../config/clients';
import { UserEventType } from '../types';

export class EventRepository {
  async record(
    userId: string,
    type: UserEventType,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_events')
        .insert({ user_id: userId, type, payload });

      if (error) {
        console.error(`[EventRepository] falha ao registrar evento ${type}:`, error.message);
      }
    } catch (err) {
      console.error(`[EventRepository] erro inesperado ao registrar evento ${type}:`, err);
    }
  }
}
