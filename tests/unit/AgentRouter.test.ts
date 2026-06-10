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

const expenseHandler = {
  handle: vi.fn(),
  correctLast: vi.fn(),
  updateFixedExpenses: vi.fn(),
  updateSavingPercentage: vi.fn(),
};
const queryHandler = {
  summary: vi.fn(),
  list: vi.fn(),
  deleteByDescription: vi.fn(),
  dailyBudget: vi.fn(),
  progress: vi.fn(),
  monthlyBalance: vi.fn(),
};
const smallTalkHandler = { help: vi.fn() };
const capabilityGapRepo = { record: vi.fn() };
const userRepo = { updateUser: vi.fn() };
const eventRepo = { record: vi.fn() };

const router = new AgentRouter(
  expenseHandler as never,
  queryHandler as never,
  smallTalkHandler as never,
  capabilityGapRepo as never,
  userRepo as never,
  eventRepo as never
);

const reply = vi.fn();
const ctx = { reply } as never;

beforeEach(() => {
  expenseHandler.handle.mockReset();
  expenseHandler.correctLast.mockReset();
  expenseHandler.updateFixedExpenses.mockReset();
  expenseHandler.updateSavingPercentage.mockReset();
  userRepo.updateUser.mockReset();
  eventRepo.record.mockReset();
  queryHandler.summary.mockReset();
  queryHandler.list.mockReset();
  queryHandler.deleteByDescription.mockReset();
  queryHandler.dailyBudget.mockReset();
  queryHandler.progress.mockReset();
  queryHandler.monthlyBalance.mockReset();
  smallTalkHandler.help.mockReset();
  capabilityGapRepo.record.mockReset();
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

  it('registrar_gasto com dia "ontem" → extraction com data de ontem', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'registrar_gasto', amount: 25, category: 'Alimentação', dia: 'ontem' },
      'ontem gastei 25 na padaria'
    );

    const extraction = expenseHandler.handle.mock.calls[0][2];
    expect(extraction.date).toBeInstanceOf(Date);
    expect(extraction.date.getTime()).toBeLessThan(Date.now());
  });

  it('atualizar_gastos_fixos → ExpenseHandler.updateFixedExpenses', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'atualizar_gastos_fixos', amount: 1200 },
      'minhas contas fixas são 1200'
    );

    expect(expenseHandler.updateFixedExpenses).toHaveBeenCalledWith(ctx, expect.anything(), 1200);
  });

  it('atualizar_percentual_poupanca → ExpenseHandler.updateSavingPercentage', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'atualizar_percentual_poupanca', percent: 30 },
      'quero poupar 30%'
    );

    expect(expenseHandler.updateSavingPercentage).toHaveBeenCalledWith(ctx, expect.anything(), 30);
  });

  it('configurar_lembretes → atualiza reminders_enabled e responde', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'configurar_lembretes', ativar: false },
      'para de me lembrar'
    );

    expect(userRepo.updateUser).toHaveBeenCalledWith('u1', { reminders_enabled: false });
    expect(eventRepo.record).toHaveBeenCalledWith('u1', 'reminders_toggled', { enabled: false });
    expect(reply).toHaveBeenCalledOnce();
    expect(reply.mock.calls[0][0]).toMatch(/desativados/i);
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
      expect.objectContaining({ intent: 'QUERY_SUMMARY', slots: { period: 'week' } }),
      expect.objectContaining({ incluirTransacoes: undefined, incluirComparacao: undefined })
    );
  });

  it('consultar_resumo repassa os sideloads para o summary', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'consultar_resumo', period: 'month', incluirTransacoes: true, incluirComparacao: true },
      'resumo do mês com transações comparado'
    );

    expect(queryHandler.summary).toHaveBeenCalledWith(
      ctx,
      expect.anything(),
      expect.anything(),
      { incluirTransacoes: true, incluirComparacao: true }
    );
  });

  it('consultar_limite_diario → QueryHandler.dailyBudget', async () => {
    await router.dispatch(ctx, makeUser(), { tool: 'consultar_limite_diario' }, 'quanto posso gastar hoje?');

    expect(queryHandler.dailyBudget).toHaveBeenCalledWith(ctx, expect.anything());
  });

  it('consultar_progresso → QueryHandler.progress com sideload', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'consultar_progresso', incluirLimiteHoje: true },
      'como tá minha sequência e quanto posso gastar?'
    );

    expect(queryHandler.progress).toHaveBeenCalledWith(ctx, expect.anything(), true);
  });

  it('consultar_saldo_mensal → QueryHandler.monthlyBalance', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'consultar_saldo_mensal', incluirBreakdown: true },
      'quanto sobrou esse mês por categoria?'
    );

    expect(queryHandler.monthlyBalance).toHaveBeenCalledWith(ctx, expect.anything(), true);
  });

  it('reportar_lacuna → grava o gap e responde', async () => {
    await router.dispatch(
      ctx,
      makeUser(),
      { tool: 'reportar_lacuna', intencao: 'registrar gasto de ontem', motivo: 'sem tool de data passada', sugestao: 'aceitar data no registro' },
      'gastei 40 ontem no mercado'
    );

    expect(capabilityGapRepo.record).toHaveBeenCalledWith('u1', {
      inputText: 'gastei 40 ontem no mercado',
      intent: 'registrar gasto de ontem',
      reason: 'sem tool de data passada',
      suggestion: 'aceitar data no registro',
    });
    expect(reply).toHaveBeenCalledOnce();
    expect(reply.mock.calls[0][0]).toMatch(/registrei seu pedido/i);
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
