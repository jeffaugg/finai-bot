import { supabase } from '../config/clients';
import { User, UserSchema } from '../types';
import { DatabaseError } from '../types/errors';
import { DateService } from '../services/DateService';

const dateService = new DateService();

export class UserRepository {
  async findByTelegramId(telegramId: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error || !data) return null;
    return UserSchema.parse(data);
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error || !data) {
      throw new DatabaseError(error?.message ?? 'Falha ao criar usuário');
    }
    return UserSchema.parse(data);
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new DatabaseError(error?.message ?? 'Falha ao atualizar usuário');
    }
    return UserSchema.parse(data);
  }

  async findAllActiveUsers(): Promise<User[]> {
    const todayLocal = dateService.getCurrentLocalDateString();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`last_closed_date.is.null,last_closed_date.lt.${todayLocal}`);

    if (error) {
      throw new DatabaseError(error.message);
    }

    return (data ?? []).map((u) => UserSchema.parse(u));
  }

  async findUsersWithoutTodayExpenses(): Promise<User[]> {
    const { start, end } = dateService.getDayBounds();
    const now = new Date().toISOString();

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .or(`snooze_until.is.null,snooze_until.lt.${now}`);

    if (usersError) {
      throw new DatabaseError(usersError.message);
    }

    const { data: todayExpenses } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    const usersWithExpenses = new Set((todayExpenses ?? []).map((t) => t.user_id));

    return (users ?? [])
      .filter((u) => !usersWithExpenses.has(u.id))
      .map((u) => UserSchema.parse(u));
  }
}