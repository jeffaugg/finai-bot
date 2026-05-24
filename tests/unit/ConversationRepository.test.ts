import { describe, it, expect, vi, beforeEach } from 'vitest';

const limit = vi.fn();
const insert = vi.fn();

const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  order: vi.fn(() => builder),
  limit,
  insert,
};

const from = vi.fn(() => builder);

vi.mock('../../src/config/clients', () => ({
  supabase: { from: () => from() },
}));

import { ConversationRepository } from '../../src/repositories/ConversationRepository';

const repo = new ConversationRepository();

beforeEach(() => {
  limit.mockReset();
  insert.mockReset();
});

describe('ConversationRepository.recentWindow', () => {
  it('retorna os turnos em ordem cronológica (inverte o desc do banco)', async () => {
    limit.mockResolvedValue({
      data: [
        { role: 'model', content: 'Quanto você gastou?' },
        { role: 'user', content: 'gastei no mercado' },
      ],
      error: null,
    });

    const result = await repo.recentWindow('u1');

    expect(result).toEqual([
      { role: 'user', content: 'gastei no mercado' },
      { role: 'model', content: 'Quanto você gastou?' },
    ]);
  });

  it('respeita o limite informado', async () => {
    limit.mockResolvedValue({ data: [], error: null });

    await repo.recentWindow('u1', 4);

    expect(limit).toHaveBeenCalledWith(4);
  });

  it('retorna lista vazia em erro de leitura', async () => {
    limit.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(repo.recentWindow('u1')).resolves.toEqual([]);
  });
});

describe('ConversationRepository.append', () => {
  it('insere o turno com a forma correta', async () => {
    insert.mockResolvedValue({ error: null });

    await repo.append('u1', 'user', 'oi');

    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', role: 'user', content: 'oi' });
  });

  it('engole erro sem propagar (best-effort)', async () => {
    insert.mockResolvedValue({ error: { message: 'falhou' } });

    await expect(repo.append('u1', 'model', 'ok')).resolves.toBeUndefined();
  });
});
