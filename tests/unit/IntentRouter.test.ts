import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentRouter } from '../../src/handlers/IntentRouter';
import { Classification, User } from '../../src/types';

const expenseHandler = { handle: vi.fn(async () => {}) };
const queryHandler = { handle: vi.fn(async () => {}) };
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
  queryHandler.handle.mockReset();
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

  it.each(['QUERY_SUMMARY', 'QUERY_LIST', 'DELETE_BY_DESCRIPTION'] as const)(
    'routes %s to QueryHandler',
    async (i) => {
      await router.dispatch(ctx, user, 'text', clf(i));
      expect(queryHandler.handle).toHaveBeenCalledOnce();
    }
  );

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
