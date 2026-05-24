import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamificationService } from '../../src/services/GamificationService';
import { User } from '../../src/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    telegram_id: 1,
    monthly_income: 3000,
    fixed_expenses: 0,
    saving_percentage: 20,
    daily_limit: 80,
    success_reserve: 120,
    current_streak: 3,
    max_streak: 5,
    snooze_until: null,
    last_closed_date: null,
    created_at: new Date(),
    onboarding_step: 'completed',
    timezone: 'America/Sao_Paulo',
    reminders_enabled: true,
    onboarding_nudged_at: null,
    ...overrides,
  };
}

const userRepo = { findByTelegramId: vi.fn() };
const txRepo = { getDailyExpenseTotal: vi.fn() };

const svc = new GamificationService(userRepo as never, txRepo as never);

beforeEach(() => {
  userRepo.findByTelegramId.mockReset();
  txRepo.getDailyExpenseTotal.mockReset();
  userRepo.findByTelegramId.mockResolvedValue(makeUser());
  txRepo.getDailyExpenseTotal.mockResolvedValue(50);
});

describe('GamificationService.getStatus', () => {
  it('mostra o saldo restante quando dentro do limite', async () => {
    const msg = await svc.getStatus(1);

    expect(msg).toContain('Gasto hoje: R$ 50.00');
    expect(msg).toContain('Restam: R$ 30.00');
    expect(msg).toContain('Sequência: 3 dias');
  });

  it('indica estouro quando acima do limite', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(100);

    const msg = await svc.getStatus(1);

    expect(msg).toContain('Estourou: R$ 20.00');
  });

  it('avisa quando o cadastro não existe e não consulta gastos', async () => {
    userRepo.findByTelegramId.mockResolvedValue(null);

    const msg = await svc.getStatus(1);

    expect(msg).toContain('Cadastro não encontrado');
    expect(txRepo.getDailyExpenseTotal).not.toHaveBeenCalled();
  });
});
