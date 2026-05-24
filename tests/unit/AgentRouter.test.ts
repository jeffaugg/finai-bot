import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRouter } from '../../src/handlers/AgentRouter';
import { User } from '../../src/types';

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

const expenseHandler = { handle: vi.fn(), correctLast: vi.fn() };
const queryHandler = { summary: vi.fn(), list: vi.fn(), deleteByDescription: vi.fn() };
const smallTalkHandler = { help: vi.fn() };

const router = new AgentRouter(
  expenseHandler as never,
  queryHandler as never,
  smallTalkHandler as never
);

const reply = vi.fn();
const ctx = { reply } as never;

beforeEach(() => {
  expenseHandler.handle.mockReset();
  expenseHandler.correctLast.mockReset();
  queryHandler.summary.mockReset();
  queryHandler.list.mockReset();
  queryHandler.deleteByDescription.mockReset();
  smallTalkHandler.help.mockReset();
  reply.mockReset();
});

describe('AgentRouter.dispatch', () => {
  it('registrar_gasto → ExpenseHandler com intent EXPENSE', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'registrar_gasto', amount: 40, category: 'Alimentação' },
      'gastei 40'
    );

    expect(expenseHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      { intent: 'EXPENSE', amount: 40, category: 'Alimentação' },
      'gastei 40'
    );
  });

  it('registrar_entrada → ExpenseHandler com intent INFLOW', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'registrar_entrada', amount: 200, category: 'Bônus' },
      'recebi 200'
    );

    expect(expenseHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      { intent: 'INFLOW', amount: 200, category: 'Bônus' },
      'recebi 200'
    );
  });

  it('atualizar_salario → ExpenseHandler com intent UPDATE_SALARY', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'atualizar_salario', amount: 5000 },
      'salário 5000'
    );

    expect(expenseHandler.handle).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      { intent: 'UPDATE_SALARY', amount: 5000, category: 'Salário' },
      'salário 5000'
    );
  });

  it('consultar_resumo → QueryHandler.summary com período', async () => {
    await router.dispatch(ctx, makeUser(), { tool: 'consultar_resumo', period: 'week' }, 'resumo');

    expect(queryHandler.summary).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      expect.objectContaining({ intent: 'QUERY_SUMMARY', slots: { period: 'week' } })
    );
  });

  it('listar_transacoes → QueryHandler.list com período e categoria', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'listar_transacoes', period: 'month', category: 'Lazer' },
      'lista'
    );

    expect(queryHandler.list).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      expect.objectContaining({ intent: 'QUERY_LIST', slots: { period: 'month', category: 'Lazer' } })
    );
  });

  it('remover_transacao → QueryHandler.deleteByDescription', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'remover_transacao', description: 'mercado' },
      'remove mercado'
    );

    expect(queryHandler.deleteByDescription).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      expect.objectContaining({ intent: 'DELETE_BY_DESCRIPTION', slots: { description: 'mercado' } })
    );
  });

  it('corrigir_ultimo_gasto → ExpenseHandler.correctLast', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'corrigir_ultimo_gasto', amount: 50, category: 'Lazer' },
      'corrige pra 50'
    );

    expect(expenseHandler.correctLast).toHaveBeenCalledWith(ctx, expect.anything(), 50, 'Lazer');
  });

  it('none sem texto → SmallTalkHandler.help', async () => {
    await router.dispatch(ctx, makeUser(), { tool: 'none' }, 'oi tudo bem?');

    expect(smallTalkHandler.help).toHaveBeenCalledWith(ctx);
    expect(reply).not.toHaveBeenCalled();
  });

  it('none com texto → responde o texto do modelo (follow-up)', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'none', text: 'Quanto você gastou?' },
      'gastei no mercado'
    );

    expect(reply).toHaveBeenCalledWith('Quanto você gastou?');
    expect(smallTalkHandler.help).not.toHaveBeenCalled();
  });
});
