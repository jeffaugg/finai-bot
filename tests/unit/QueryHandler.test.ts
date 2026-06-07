import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryHandler } from '../../src/handlers/QueryHandler';
import { Classification, Transaction, User } from '../../src/types';

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

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: 'u1',
    amount: 40,
    category: 'mercado',
    type: 'EXPENSE',
    raw_text: 'gastei 40 no mercado',
    date: new Date('2026-05-10T15:00:00Z'),
    deleted_at: null,
    ...overrides,
  };
}

function makeCtx() {
  return {
    reply: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  };
}

const repoStub = {
  getCategorySummary: vi.fn(),
  listByPeriod: vi.fn(),
  findRecentByDescription: vi.fn(),
  getDailyExpenseTotal: vi.fn(),
  getPeriodTotals: vi.fn(),
};

const handler = new QueryHandler(repoStub as never);

beforeEach(() => {
  repoStub.getCategorySummary.mockReset();
  repoStub.listByPeriod.mockReset();
  repoStub.findRecentByDescription.mockReset();
  repoStub.getDailyExpenseTotal.mockReset();
  repoStub.getPeriodTotals.mockReset();
});

function clf(intent: Classification['intent'], slots?: Classification['slots']): Classification {
  return { intent, confidence: 0.9, slots };
}

describe('QueryHandler.summary', () => {
  it('replies with totals grouped by category', async () => {
    repoStub.getCategorySummary.mockResolvedValue([
      { category: 'mercado', total: 80 },
      { category: 'lazer', total: 40 },
    ]);
    const ctx = makeCtx();

    await handler.summary(ctx as never, makeUser(), clf('QUERY_SUMMARY', { period: 'today' }));

    expect(repoStub.getCategorySummary).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledOnce();
    const [msg] = ctx.reply.mock.calls[0];
    expect(msg).toContain('Total: R$ 120.00');
    expect(msg).toContain('mercado');
    expect(msg).toContain('lazer');
  });

  it('replies "sem gastos" when summary is empty', async () => {
    repoStub.getCategorySummary.mockResolvedValue([]);
    const ctx = makeCtx();

    await handler.summary(ctx as never, makeUser(), clf('QUERY_SUMMARY'));

    expect(ctx.reply).toHaveBeenCalledOnce();
    expect(ctx.reply.mock.calls[0][0]).toMatch(/Sem gastos/);
  });
});

describe('QueryHandler.list', () => {
  it('lists transactions with date and category', async () => {
    repoStub.listByPeriod.mockResolvedValue([
      makeTx({ id: 't1', amount: 40, category: 'mercado' }),
      makeTx({ id: 't2', amount: 20, category: 'lazer' }),
    ]);
    const ctx = makeCtx();

    await handler.list(ctx as never, makeUser(), clf('QUERY_LIST', { period: 'month' }));

    expect(repoStub.listByPeriod).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ limit: 16 })
    );
    expect(ctx.reply).toHaveBeenCalledOnce();
    const [msg] = ctx.reply.mock.calls[0];
    expect(msg).toContain('mercado');
    expect(msg).toContain('R$ 40.00');
  });

  it('forwards category filter to the repository', async () => {
    repoStub.listByPeriod.mockResolvedValue([]);
    const ctx = makeCtx();

    await handler.list(
      ctx as never,
      makeUser(),
      clf('QUERY_LIST', { period: 'month', category: 'lazer' })
    );

    expect(repoStub.listByPeriod).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ category: 'lazer' })
    );
  });

  it('shows truncation hint when over the limit', async () => {
    const txs = Array.from({ length: 16 }, (_, i) => makeTx({ id: `t${i}` }));
    repoStub.listByPeriod.mockResolvedValue(txs);
    const ctx = makeCtx();

    await handler.list(ctx as never, makeUser(), clf('QUERY_LIST', { period: 'month' }));

    expect(ctx.reply.mock.calls[0][0]).toMatch(/últimos 15/);
  });
});

describe('QueryHandler.summary sideloads', () => {
  it('inclui as transações quando incluir_transacoes', async () => {
    repoStub.getCategorySummary.mockResolvedValue([{ category: 'mercado', total: 40 }]);
    repoStub.listByPeriod.mockResolvedValue([makeTx({ category: 'mercado', amount: 40 })]);
    const ctx = makeCtx();

    await handler.summary(ctx as never, makeUser(), clf('QUERY_SUMMARY', { period: 'today' }), {
      incluirTransacoes: true,
    });

    expect(repoStub.listByPeriod).toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toContain('Transações');
  });

  it('inclui a comparação com o período anterior quando incluir_comparacao', async () => {
    repoStub.getCategorySummary
      .mockResolvedValueOnce([{ category: 'mercado', total: 120 }])
      .mockResolvedValueOnce([{ category: 'mercado', total: 100 }]);
    const ctx = makeCtx();

    await handler.summary(ctx as never, makeUser(), clf('QUERY_SUMMARY', { period: 'today' }), {
      incluirComparacao: true,
    });

    expect(repoStub.getCategorySummary).toHaveBeenCalledTimes(2);
    expect(ctx.reply.mock.calls[0][0]).toMatch(/20% a mais que ontem/);
  });
});

describe('QueryHandler.dailyBudget', () => {
  it('mostra quanto resta do limite', async () => {
    repoStub.getDailyExpenseTotal.mockResolvedValue(30);
    const ctx = makeCtx();

    await handler.dailyBudget(ctx as never, makeUser());

    expect(ctx.reply.mock.calls[0][0]).toContain('R$ 50.00');
  });

  it('avisa quando estourou o limite', async () => {
    repoStub.getDailyExpenseTotal.mockResolvedValue(100);
    const ctx = makeCtx();

    await handler.dailyBudget(ctx as never, makeUser());

    expect(ctx.reply.mock.calls[0][0]).toMatch(/passou do limite/);
  });
});

describe('QueryHandler.progress', () => {
  it('mostra streak e reserva sem tocar no banco por padrão', async () => {
    const ctx = makeCtx();

    await handler.progress(ctx as never, makeUser());

    expect(repoStub.getDailyExpenseTotal).not.toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toMatch(/Sequência/);
  });

  it('anexa o limite de hoje quando incluirLimiteHoje', async () => {
    repoStub.getDailyExpenseTotal.mockResolvedValue(30);
    const ctx = makeCtx();

    await handler.progress(ctx as never, makeUser(), true);

    expect(repoStub.getDailyExpenseTotal).toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toContain('Restam: R$ 50.00');
  });
});

describe('QueryHandler.monthlyBalance', () => {
  it('calcula renda menos gastos', async () => {
    repoStub.getPeriodTotals.mockResolvedValue({ inflow: 0, expense: 1000 });
    const ctx = makeCtx();

    await handler.monthlyBalance(ctx as never, makeUser());

    expect(ctx.reply.mock.calls[0][0]).toContain('Sobrou: R$ 2000.00');
  });

  it('inclui breakdown por categoria quando pedido', async () => {
    repoStub.getPeriodTotals.mockResolvedValue({ inflow: 0, expense: 1000 });
    repoStub.getCategorySummary.mockResolvedValue([{ category: 'mercado', total: 1000 }]);
    const ctx = makeCtx();

    await handler.monthlyBalance(ctx as never, makeUser(), true);

    expect(repoStub.getCategorySummary).toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toContain('Gastos por categoria');
  });
});

describe('QueryHandler.deleteByDescription', () => {
  it('asks for confirmation when there is a single match', async () => {
    repoStub.findRecentByDescription.mockResolvedValue([makeTx({ id: 'tx-1' })]);
    const ctx = makeCtx();

    await handler.deleteByDescription(
      ctx as never,
      makeUser(),
      clf('DELETE_BY_DESCRIPTION', { description: 'mercado' })
    );

    expect(ctx.reply).toHaveBeenCalledOnce();
    const [, markup] = ctx.reply.mock.calls[0];
    expect(JSON.stringify(markup)).toContain('confirm_delete:tx-1');
    expect(JSON.stringify(markup)).toContain('cancel_delete');
  });

  it('shows multiple buttons when there are several matches', async () => {
    repoStub.findRecentByDescription.mockResolvedValue([
      makeTx({ id: 'a' }),
      makeTx({ id: 'b' }),
      makeTx({ id: 'c' }),
    ]);
    const ctx = makeCtx();

    await handler.deleteByDescription(
      ctx as never,
      makeUser(),
      clf('DELETE_BY_DESCRIPTION', { description: 'mercado' })
    );

    const [, markup] = ctx.reply.mock.calls[0];
    const json = JSON.stringify(markup);
    expect(json).toContain('confirm_delete:a');
    expect(json).toContain('confirm_delete:b');
    expect(json).toContain('confirm_delete:c');
  });

  it('replies "não encontrei" when there are no matches', async () => {
    repoStub.findRecentByDescription.mockResolvedValue([]);
    const ctx = makeCtx();

    await handler.deleteByDescription(
      ctx as never,
      makeUser(),
      clf('DELETE_BY_DESCRIPTION', { description: 'inexistente' })
    );

    expect(ctx.reply.mock.calls[0][0]).toMatch(/Não encontrei/);
  });

  it('asks for clarification when description is missing', async () => {
    const ctx = makeCtx();

    await handler.deleteByDescription(
      ctx as never,
      makeUser(),
      clf('DELETE_BY_DESCRIPTION', {})
    );

    expect(repoStub.findRecentByDescription).not.toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toMatch(/mais específico/);
  });
});
