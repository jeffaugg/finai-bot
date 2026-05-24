import { supabase } from '../config/clients';
import { DatabaseError } from '../types/errors';

export class FeedbackRepository {
  async create(userId: string, content: string): Promise<void> {
    const { error } = await supabase.from('feedback').insert({ user_id: userId, content });

    if (error) {
      throw new DatabaseError(error.message);
    }
  }
}
