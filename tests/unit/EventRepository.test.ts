import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const from = vi.fn();

vi.mock('../../src/config/clients', () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}));

import { EventRepository } from '../../src/repositories/EventRepository';

const repo = new EventRepository();

beforeEach(() => {
  from.mockReset();
  insert.mockReset();
  from.mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
});

describe('EventRepository.record', () => {
  it('insere o evento na tabela user_events com a forma correta', async () => {
    await repo.record('user-1', 'transaction_recorded', { amount: 40, category: 'Alimentação' });

    expect(from).toHaveBeenCalledWith('user_events');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: 'transaction_recorded',
      payload: { amount: 40, category: 'Alimentação' },
    });
  });

  it('usa payload vazio por padrão', async () => {
    await repo.record('user-1', 'reminder_sent');

    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: 'reminder_sent',
      payload: {},
    });
  });

  it('engole erro retornado pelo banco sem lançar', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } });

    await expect(repo.record('user-1', 'daily_closed')).resolves.toBeUndefined();
  });

  it('engole exceção inesperada sem propagar', async () => {
    insert.mockRejectedValue(new Error('network down'));

    await expect(repo.record('user-1', 'salary_updated')).resolves.toBeUndefined();
  });
});
