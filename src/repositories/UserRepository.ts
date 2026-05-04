import { supabase } from '../config/clients';
import { User } from '../types';

export class UserRepository {
  /**
   * Busca um usuário pelo seu ID do Telegram
   * @param telegramId - O ID do Telegram do usuário
   * @returns O usuário encontrado ou null se não existir
   */
  async findByTelegramId(telegramId: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !data) return null;
    return data as User;
  }
  
  /**
   * Cria um novo usuário no banco de dados
   * @param userData - Dados parciais do usuário a ser criado
   * @returns O usuário criado com todos os campos preenchidos
   */
  async createUser(userData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar usuário: ${error.message}`);
    return data as User;
  }

  /**
   * Atualiza um usuário existente no banco de dados
   * @param userId - O ID do usuário a ser atualizado
   * @param updateData - Dados parciais do usuário a serem atualizados
   * @returns O usuário atualizado com todos os campos preenchidos
   */
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