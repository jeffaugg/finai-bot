import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamificationService } from '../../src/services/GamificationService';
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
  findLastExpense: vi.fn(),
  softDelete: vi.fn(),
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
  txRepo.findLastExpense.mockReset();
  txRepo.softDelete.mockReset();
  eventRepo.record.mockReset();

  userRepo.findByTelegramId.mockResolvedValue(makeUser());
  userRepo.updateUser.mockResolvedValue(makeUser());
  txRepo.create.mockResolvedValue({ id: 'tx-1' });
  txRepo.getDailyExpenseTotal.mockResolvedValue(40);
  txRepo.softDelete.mockResolvedValue(undefined);
});

describe('GamificationService emite eventos', () => {
  it('emite transaction_recorded (EXPENSE) ao registrar um gasto', async () => {
    const data: GeminiExtraction = { intent: 'EXPENSE', amount: 40, category: 'Alimentação' };

    await svc.processFinancialEvent(1, data, 'gastei 40 no mercado');

    expect(eventRepo.record).toHaveBeenCalledWith(
      'u1',
      'transaction_recorded',
      expect.objectContaining({ transaction_id: 'tx-1', amount: 40, category: 'Alimentação', type: 'EXPENSE' })
    );
  });

  it('emite transaction_recorded (INFLOW) ao registrar uma entrada', async () => {
    const data: GeminiExtraction = { intent: 'INFLOW', amount: 200, category: 'Bônus' };

    await svc.processFinancialEvent(1, data, 'recebi 200 de bônus');

    expect(eventRepo.record).toHaveBeenCalledWith(
      'u1',
      'transaction_recorded',
      expect.objectContaining({ type: 'INFLOW', amount: 200, category: 'Bônus' })
    );
  });

  it('emite salary_updated ao atualizar o salário', async () => {
    const data: GeminiExtraction = { intent: 'UPDATE_SALARY', amount: 5000, category: 'Salário' };

    await svc.processFinancialEvent(1, data, 'meu salário agora é 5000');

    expect(eventRepo.record).toHaveBeenCalledWith(
      'u1',
      'salary_updated',
      expect.objectContaining({ monthly_income: 5000 })
    );
  });

  it('não emite evento quando o usuário não existe', async () => {
    userRepo.findByTelegramId.mockResolvedValue(null);
    const data: GeminiExtraction = { intent: 'EXPENSE', amount: 40, category: 'Alimentação' };

    const result = await svc.processFinancialEvent(1, data, 'gastei 40');

    expect(eventRepo.record).not.toHaveBeenCalled();
    expect(result.message).toContain('Não encontrei seu cadastro');
  });
});

describe('GamificationService.correctLastExpense', () => {
  it('desfaz o último gasto e recria com o novo valor, emitindo transaction_corrected', async () => {
    txRepo.findLastExpense.mockResolvedValue({
      id: 'old',
      amount: 100,
      category: 'Alimentação',
      raw_text: 'gastei 100',
      date: new Date('2026-05-20T12:00:00Z'),
    });

    const result = await svc.correctLastExpense(makeUser(), 80);

    expect(txRepo.softDelete).toHaveBeenCalledWith('old', 'u1');
    expect(txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 80, category: 'Alimentação', type: 'EXPENSE' })
    );
    expect(eventRepo.record).toHaveBeenCalledWith(
      'u1',
      'transaction_corrected',
      expect.objectContaining({ old_amount: 100, new_amount: 80 })
    );
    expect(result.transactionId).toBe('tx-1');
  });

  it('usa a nova categoria quando informada', async () => {
    txRepo.findLastExpense.mockResolvedValue({
      id: 'old',
      amount: 100,
      category: 'Alimentação',
      raw_text: 'x',
      date: new Date('2026-05-20T12:00:00Z'),
    });

    await svc.correctLastExpense(makeUser(), 80, 'Lazer');

    expect(txRepo.create).toHaveBeenCalledWith(expect.objectContaining({ category: 'Lazer' }));
  });

  it('avisa quando não há gasto recente para corrigir', async () => {
    txRepo.findLastExpense.mockResolvedValue(null);

    const result = await svc.correctLastExpense(makeUser(), 80);

    expect(result.message).toContain('Não encontrei');
    expect(txRepo.softDelete).not.toHaveBeenCalled();
    expect(txRepo.create).not.toHaveBeenCalled();
  });
});
