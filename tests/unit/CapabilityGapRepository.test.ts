import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const from = vi.fn();

vi.mock('../../src/config/clients', () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}));

import { CapabilityGapRepository } from '../../src/repositories/CapabilityGapRepository';

const repo = new CapabilityGapRepository();

const gap = {
  inputText: 'gastei 40 ontem no mercado',
  intent: 'registrar gasto de ontem',
  reason: 'sem tool de data passada',
  suggestion: 'aceitar data no registro',
};

beforeEach(() => {
  from.mockReset();
  insert.mockReset();
  from.mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
});

describe('CapabilityGapRepository.record', () => {
  it('insere a lacuna na tabela capability_gaps com a forma correta', async () => {
    await repo.record('user-1', gap);

    expect(from).toHaveBeenCalledWith('capability_gaps');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      input_text: gap.inputText,
      intent: gap.intent,
      reason: gap.reason,
      suggestion: gap.suggestion,
    });
  });

  it('engole erro do banco sem lançar', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } });
    await expect(repo.record('user-1', gap)).resolves.toBeUndefined();
  });

  it('engole exceção inesperada sem propagar', async () => {
    insert.mockRejectedValue(new Error('network down'));
    await expect(repo.record('user-1', gap)).resolves.toBeUndefined();
  });
});
