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

  async getDailyExpenseTotal(userId: string, dateStr?: string): Promise<number> {
    const { start, end } = dateStr
      ? dateService.getDayBoundsForLocalDate(dateStr)
      : dateService.getDayBounds();

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

    return ((data ?? []) as Array<{ amount: number | string }>).reduce(
      (accumulator, current) => accumulator + Number(current.amount),
      0
    );
  }

  async getMonthlySummary(
    userId: string,
    year: number,
    month: number
  ): Promise<{ category: string; total: number }[]> {
    const { start, end } = dateService.getMonthBounds(year, month);
    return this.getCategorySummary(userId, start, end);
  }

  async getPeriodTotals(
    userId: string,
    start: Date,
    end: Date
  ): Promise<{ inflow: number; expense: number }> {
    const { data, error } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    if (error) {
      throw new DatabaseError(error.message);
    }

    let inflow = 0;
    let expense = 0;
    for (const transaction of (data ?? []) as Array<{ amount: number | string; type: 'INFLOW' | 'EXPENSE' }>) {
      if (transaction.type === 'INFLOW') inflow += Number(transaction.amount);
      else if (transaction.type === 'EXPENSE') expense += Number(transaction.amount);
    }
    return { inflow, expense };
  }

  async getCategorySummary(
    userId: string,
    start: Date,
    end: Date
  ): Promise<{ category: string; total: number }[]> {
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
    for (const transaction of (data ?? []) as Array<{ category: string; amount: number | string }>) {
      totals.set(
        transaction.category,
        (totals.get(transaction.category) ?? 0) + Number(transaction.amount)
      );
    }

    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }

  async listByPeriod(
    userId: string,
    opts: { start: Date; end: Date; category?: string; limit?: number }
  ): Promise<Transaction[]> {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .gte('date', opts.start.toISOString())
      .lte('date', opts.end.toISOString())
      .order('date', { ascending: false });

    if (opts.category) {
      query = query.ilike('category', `%${escapeIlike(opts.category)}%`);
    }

    if (opts.limit) {
      query = query.limit(opts.limit);
    }

    const { data, error } = await query;
    if (error) {
      throw new DatabaseError(error.message);
    }

    return (data ?? []).map((t) => TransactionSchema.parse(t));
  }

  async findLastExpense(userId: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(error.message);
    }

    return data ? TransactionSchema.parse(data) : null;
  }

  async findRecentByDescription(
    userId: string,
    description: string,
    limit = 5
  ): Promise<Transaction[]> {
    const term = `%${escapeIlike(description)}%`;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .or(`category.ilike.${term},raw_text.ilike.${term}`)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseError(error.message);
    }

    return (data ?? []).map((t) => TransactionSchema.parse(t));
  }
}

function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}