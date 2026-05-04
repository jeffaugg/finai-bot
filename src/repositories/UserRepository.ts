import { supabase } from '../config/clients';
import { User } from '../types';

export class UserRepository {
  async findByTelegramId(telegramId: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !data) return null;
    return data as User;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar usuário: ${error.message}`);
    return data as User;
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar usuário no Supabase:', error);
      throw new Error(`Falha ao atualizar os dados do usuário: ${error.message}`);
    }

    return data as User;
  }
}