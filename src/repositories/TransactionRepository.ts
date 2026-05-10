import { supabase } from '../config/clients';
import { Transaction, TransactionSchema } from '../types';
import { DatabaseError } from '../types/errors';

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

  async softDelete(transactionId: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', transactionId)
      .is('deleted_at', null);

    if (error) {
      throw new DatabaseError(error.message);
    }
  }

  async getDailyExpenseTotal(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]; 

    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .gte('date', `${today}T00:00:00.000Z`)
      .lte('date', `${today}T23:59:59.999Z`);

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
    const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
    const end = new Date(year, month, 1).toISOString();

    const { data, error } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .is('deleted_at', null)
      .gte('date', start)
      .lt('date', end);

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