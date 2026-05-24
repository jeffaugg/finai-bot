import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const from = vi.fn();

vi.mock('../../src/config/clients', () => ({
  supabase: { from: () => from() },
}));

import { FeedbackRepository } from '../../src/repositories/FeedbackRepository';
import { DatabaseError } from '../../src/types/errors';

const repo = new FeedbackRepository();

beforeEach(() => {
  from.mockReset();
  insert.mockReset();
  from.mockReturnValue({ insert });
});

describe('FeedbackRepository.create', () => {
  it('insere o feedback com user_id e content', async () => {
    insert.mockResolvedValue({ error: null });

    await repo.create('u1', 'gostei muito do bot');

    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', content: 'gostei muito do bot' });
  });

  it('lança DatabaseError em erro do banco', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } });

    await expect(repo.create('u1', 'x')).rejects.toBeInstanceOf(DatabaseError);
  });
});
