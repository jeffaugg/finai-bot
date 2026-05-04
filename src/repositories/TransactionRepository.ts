import { supabase } from '../config/clients';
import { Transaction } from '../types';

export class TransactionRepository {
  async create(transactionData: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error('Falha no Supabase:', error);
      throw new Error('Não foi possível registrar a transação no banco de dados.');
    }

    return data as Transaction;
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
      console.error('Erro ao buscar total diário:', error);
      throw new Error('Falha ao calcular o limite restante do dia.');
    }

    const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
    return total;
  }
}