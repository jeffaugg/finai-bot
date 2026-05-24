import { supabase } from '../config/clients';

export type ConversationRole = 'user' | 'model';

export interface ConversationTurn {
  role: ConversationRole;
  content: string;
}

const DEFAULT_WINDOW = 10;

export class ConversationRepository {
  async append(userId: string, role: ConversationRole, content: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_turns')
        .insert({ user_id: userId, role, content });

      if (error) {
        console.error('[ConversationRepository] falha ao gravar turno:', error.message);
      }
    } catch (err) {
      console.error('[ConversationRepository] erro inesperado ao gravar turno:', err);
    }
  }

  async recentWindow(userId: string, limit = DEFAULT_WINDOW): Promise<ConversationTurn[]> {
    const { data, error } = await supabase
      .from('conversation_turns')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('[ConversationRepository] falha ao ler janela:', error?.message);
      return [];
    }

    return (data as ConversationTurn[]).reverse();
  }
}
