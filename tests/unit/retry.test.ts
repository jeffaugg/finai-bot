import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry';

describe('withRetry', () => {
  it('retorna no primeiro sucesso sem repetir', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withRetry(fn, { baseDelayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('repete em falha transitória e então tem sucesso', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('transitória')).mockResolvedValue('ok');

    await expect(withRetry(fn, { retries: 2, baseDelayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('desiste após esgotar as tentativas e propaga o erro', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withRetry(fn, { retries: 2, baseDelayMs: 0 })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
