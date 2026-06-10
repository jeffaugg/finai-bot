import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDailyLimit, GamificationService } from '../../src/services/GamificationService';
import { GeminiExtraction, User } from '../../src/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    telegram_id: 1,
    monthly_income: 3000,
    fixed_expenses: 0,
    saving_percentage: 20,
    daily_limit: 80,
    success_reserve: 0,
    current_streak: 0,
    max_streak: 0,
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

const userRepo = {
  findByTelegramId: vi.fn(),
  updateUser: vi.fn(),
};

const txRepo = {
  create: vi.fn(),
  getDailyExpenseTotal: vi.fn(),
};

const eventRepo = {
  record: vi.fn(),
};

const svc = new GamificationService(userRepo as never, txRepo as never, eventRepo as never);

beforeEach(() => {
  userRepo.findByTelegramId.mockReset();
  userRepo.updateUser.mockReset();
  txRepo.create.mockReset();
  txRepo.getDailyExpenseTotal.mockReset();
  eventRepo.record.mockReset();

  userRepo.findByTelegramId.mockResolvedValue(makeUser());
  userRepo.updateUser.mockResolvedValue(makeUser());
  txRepo.create.mockResolvedValue({ id: 'tx-1' });
  txRepo.getDailyExpenseTotal.mockResolvedValue(0);
});

describe('calculateDailyLimit', () => {
  it('aplica a fórmula ((renda - fixos) * (1 - pct/100)) / 30', () => {
    expect(calculateDailyLimit(3000, 0, 20)).toBeCloseTo(80);
    expect(calculateDailyLimit(6000, 1200, 25)).toBeCloseTo(120);
    expect(calculateDailyLimit(3000, 3000, 20)).toBe(0);
  });
});

describe('GamificationService.updateFixedExpenses', () => {
  it('persiste os gastos fixos e recalcula o limite diário', async () => {
    const result = await svc.updateFixedExpenses(makeUser(), 600);

    expect(userRepo.updateUser).toHaveBeenCalledWith('u1', {
      fixed_expenses: 600,
      daily_limit: 64,
    });
    expect(eventRepo.record).toHaveBeenCalledWith(
      'u1',
      'profile_updated',
      expect.objectContaining({ field: 'fixed_expenses', value: 600 })
    );
    expect(result.message).toContain('R$ 64.00');
  });
});

describe('GamificationService.updateSavingPercentage', () => {
  it('persiste o percentual e recalcula o limite diário', async () => {
    const result = await svc.updateSavingPercentage(makeUser(), 50);

    expect(userRepo.updateUser).toHaveBeenCalledWith('u1', {
      saving_percentage: 50,
      daily_limit: 50,
    });
    expect(eventRepo.record).toHaveBeenCalledWith(
      'u1',
      'profile_updated',
      expect.objectContaining({ field: 'saving_percentage', value: 50 })
    );
    expect(result.message).toContain('50%');
  });
});

describe('GamificationService — gasto retroativo', () => {
  it('grava a data informada e não menciona o limite de hoje', async () => {
    const ontem = new Date('2026-06-08T15:00:00Z');
    const data: GeminiExtraction = {
      intent: 'EXPENSE',
      amount: 25,
      category: 'Alimentação',
      date: ontem,
    };

    const result = await svc.processFinancialEvent(1, data, 'ontem gastei 25 na padaria');

    expect(txRepo.create).toHaveBeenCalledWith(expect.objectContaining({ date: ontem }));
    expect(txRepo.getDailyExpenseTotal).not.toHaveBeenCalled();
    expect(result.message).toContain('ontem');
    expect(result.message).not.toContain('Restam');
    expect(result.transactionId).toBe('tx-1');
  });

  it('sem data usa o fluxo normal com o total de hoje', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(40);
    const data: GeminiExtraction = { intent: 'EXPENSE', amount: 40, category: 'Alimentação' };

    const result = await svc.processFinancialEvent(1, data, 'gastei 40');

    const created = txRepo.create.mock.calls[0][0];
    expect(created.date).toBeInstanceOf(Date);
    expect(result.message).toContain('Restam');
  });
});
