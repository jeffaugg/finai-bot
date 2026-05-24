import { describe, it, expect, vi, beforeEach } from 'vitest';

const single = vi.fn();
const maybeSingle = vi.fn();

const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  order: vi.fn(() => builder),
  limit: vi.fn(() => builder),
  insert: vi.fn(() => builder),
  single,
  maybeSingle,
};

const from = vi.fn(() => builder);

vi.mock('../../src/config/clients', () => ({
  supabase: { from: () => from() },
}));

import { SnapshotRepository } from '../../src/repositories/SnapshotRepository';
import { DatabaseError } from '../../src/types/errors';

const repo = new SnapshotRepository();

const validInput = {
  user_id: '11111111-1111-4111-8111-111111111111',
  snapshot_date: '2026-05-20',
  current_streak: 1,
  success_reserve: 30,
  daily_limit: 80,
  total_spent: 50,
  had_activity: true,
  close_result: 'success' as const,
};

const validRow = {
  id: '22222222-2222-4222-8222-222222222222',
  ...validInput,
  created_at: '2026-05-20T23:59:00Z',
};

beforeEach(() => {
  single.mockReset();
  maybeSingle.mockReset();
});

describe('SnapshotRepository.insert', () => {
  it('retorna o snapshot inserido em caso de sucesso', async () => {
    single.mockResolvedValue({ data: validRow, error: null });

    const result = await repo.insert(validInput);

    expect(result?.snapshot_date).toBeInstanceOf(Date);
    expect(result?.close_result).toBe('success');
  });

  it('retorna null em violação de UNIQUE (23505) — idempotência', async () => {
    single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });

    const result = await repo.insert(validInput);

    expect(result).toBeNull();
  });

  it('lança DatabaseError em outros erros', async () => {
    single.mockResolvedValue({ data: null, error: { code: '42501', message: 'boom' } });

    await expect(repo.insert(validInput)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('SnapshotRepository.existsForDate', () => {
  it('retorna true quando há snapshot do dia', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 'x' }, error: null });

    await expect(repo.existsForDate('u1', '2026-05-20')).resolves.toBe(true);
  });

  it('retorna false quando não há snapshot do dia', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(repo.existsForDate('u1', '2026-05-20')).resolves.toBe(false);
  });
});
