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

    return ((data ?? []) as unknown[]).map((user) => UserSchema.parse(user));
  }

  async findUsersWithoutTodayExpenses(): Promise<User[]> {
    const { start, end } = dateService.getDayBounds();
    const now = new Date().toISOString();

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('reminders_enabled', true)
      .eq('onboarding_step', 'completed')
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

    const usersWithExpenses = new Set(
      ((todayExpenses ?? []) as Array<{ user_id: string }>).map((transaction) => transaction.user_id)
    );

    return (users ?? [])
      .filter((user) => !usersWithExpenses.has(user.id))
      .map((user) => UserSchema.parse(user));
  }

  async findStaleOnboardingForNudge(hoursAgo: number): Promise<User[]> {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .neq('onboarding_step', 'completed')
      .lt('created_at', cutoff)
      .is('onboarding_nudged_at', null);

    if (error) {
      throw new DatabaseError(error.message);
    }

    return ((data ?? []) as unknown[]).map((user) => UserSchema.parse(user));
  }

  async markOnboardingNudged(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ onboarding_nudged_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      throw new DatabaseError(error.message);
    }
  }
}