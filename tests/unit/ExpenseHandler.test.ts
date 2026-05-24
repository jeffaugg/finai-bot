import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpenseHandler } from '../../src/handlers/ExpenseHandler';
import { GeminiExtraction, User } from '../../src/types';

function makeUser(): User {
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
  };
}

function makeCtx() {
  return {
    sendChatAction: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
    reply: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  };
}

const gami = { processFinancialEvent: vi.fn() };
const handler = new ExpenseHandler(gami as never);

beforeEach(() => {
  gami.processFinancialEvent.mockReset();
  gami.processFinancialEvent.mockResolvedValue({ message: 'ok', transactionId: 'tx-1' });
});

describe('ExpenseHandler.handle', () => {
  it('grava direto um gasto abaixo do limite de confirmação', async () => {
    const ctx = makeCtx();
    const extraction: GeminiExtraction = { intent: 'EXPENSE', amount: 40, category: 'Alimentação' };

    await handler.handle(ctx as never, makeUser(), extraction, 'gastei 40');

    expect(gami.processFinancialEvent).toHaveBeenCalledOnce();
  });

  it('pede confirmação (sem gravar) para gasto alto', async () => {
    const ctx = makeCtx();
    const extraction: GeminiExtraction = {
      intent: 'EXPENSE',
      amount: 1200,
      category: 'Alimentação',
    };

    await handler.handle(ctx as never, makeUser(), extraction, 'gastei 1200');

    expect(gami.processFinancialEvent).not.toHaveBeenCalled();
    const [, markup] = ctx.reply.mock.calls[0];
    expect(JSON.stringify(markup)).toContain('confirm_expense:1200:Alimentação');
    expect(JSON.stringify(markup)).toContain('cancel_expense');
  });

  it('não pede confirmação para entrada de valor alto (threshold só para gasto)', async () => {
    const ctx = makeCtx();
    const extraction: GeminiExtraction = { intent: 'INFLOW', amount: 5000, category: 'Bônus' };

    await handler.handle(ctx as never, makeUser(), extraction, 'recebi 5000');

    expect(gami.processFinancialEvent).toHaveBeenCalledOnce();
  });
});
