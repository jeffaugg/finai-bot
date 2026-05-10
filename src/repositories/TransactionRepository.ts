import { supabase } from '../config/clients';
import { Transaction, TransactionSchema } from '../types';
import { DatabaseError, OwnershipError } from '../types/errors';
import { DateService } from '../services/DateService';

const dateService = new DateService();

export class TransactionRepository {
  async create(transactionData: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error || !data) {
      throw new DatabaseError(error?.message ?? 'Falha ao inserir transação');
    }

    return TransactionSchema.parse(data);
  }

  async softDelete(transactionId: string, userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      throw new DatabaseError(error.message);
    }

    if (!data || data.length === 0) {
      throw new OwnershipError(`transaction ${transactionId}`);
    }
  }

  async getDailyExpenseTotal(userId: string): Promise<number> {
    const { start, end } = dateService.getDayBounds();

    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    if (error) {
      throw new DatabaseError(error.message);
    }

    return (data ?? []).reduce((acc, curr) => acc + Number(curr.amount), 0);
  }

  async getMonthlySummary(
    userId: string,
    year: number,
    month: number
  ): Promise<{ category: string; total: number }[]> {
    const { start, end } = dateService.getMonthBounds(year, month);

    const { data, error } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    if (error) {
      throw new DatabaseError(error.message);
    }

    const totals = new Map<string, number>();
    for (const t of data ?? []) {
      totals.set(t.category, (totals.get(t.category) ?? 0) + Number(t.amount));
    }

    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }
}