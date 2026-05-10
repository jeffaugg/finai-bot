import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentRouter } from '../../src/handlers/IntentRouter';
import { Classification, User } from '../../src/types';

const expenseHandler = { handle: vi.fn(async () => {}) };
const queryHandler = {
  summary: vi.fn(async () => {}),
  list: vi.fn(async () => {}),
  deleteByDescription: vi.fn(async () => {}),
};
const smallTalkHandler = {
  greet: vi.fn(async () => {}),
  help: vi.fn(async () => {}),
  outOfScope: vi.fn(async () => {}),
};

const router = new IntentRouter(
  expenseHandler as never,
  queryHandler as never,
  smallTalkHandler as never
);

const user = { id: 'u1', telegram_id: 1 } as User;
const ctx = {} as never;

beforeEach(() => {
  expenseHandler.handle.mockReset();
  queryHandler.summary.mockReset();
  queryHandler.list.mockReset();
  queryHandler.deleteByDescription.mockReset();
  smallTalkHandler.greet.mockReset();
  smallTalkHandler.help.mockReset();
  smallTalkHandler.outOfScope.mockReset();
});

function clf(intent: Classification['intent'], extra: Partial<Classification> = {}): Classification {
  return { intent, confidence: 0.9, ...extra };
}

describe('IntentRouter.dispatch', () => {
  it.each(['EXPENSE', 'INFLOW', 'UPDATE_SALARY'] as const)('routes %s to ExpenseHandler', async (i) => {
    await router.dispatch(ctx, user, 'text', clf(i));
    expect(expenseHandler.handle).toHaveBeenCalledOnce();
  });

  it('routes QUERY_SUMMARY to queryHandler.summary', async () => {
    await router.dispatch(ctx, user, 'quanto gastei?', clf('QUERY_SUMMARY'));
    expect(queryHandler.summary).toHaveBeenCalledOnce();
  });

  it('routes QUERY_LIST to queryHandler.list', async () => {
    await router.dispatch(ctx, user, 'me mostra os gastos', clf('QUERY_LIST'));
    expect(queryHandler.list).toHaveBeenCalledOnce();
  });

  it('routes DELETE_BY_DESCRIPTION to queryHandler.deleteByDescription', async () => {
    await router.dispatch(ctx, user, 'remove o último mercado', clf('DELETE_BY_DESCRIPTION'));
    expect(queryHandler.deleteByDescription).toHaveBeenCalledOnce();
  });

  it('routes HELP to smallTalkHandler.help', async () => {
    await router.dispatch(ctx, user, 'como funciona?', clf('HELP'));
    expect(smallTalkHandler.help).toHaveBeenCalledOnce();
  });

  it('routes GREETING to smallTalkHandler.greet', async () => {
    await router.dispatch(ctx, user, 'oi', clf('GREETING'));
    expect(smallTalkHandler.greet).toHaveBeenCalledOnce();
  });

  it('routes OUT_OF_SCOPE to smallTalkHandler.outOfScope', async () => {
    await router.dispatch(ctx, user, 'capital da França?', clf('OUT_OF_SCOPE'));
    expect(smallTalkHandler.outOfScope).toHaveBeenCalledOnce();
  });
});
