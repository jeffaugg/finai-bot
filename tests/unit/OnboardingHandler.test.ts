import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingHandler } from '../../src/handlers/OnboardingHandler';
import { User } from '../../src/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    telegram_id: 1,
    monthly_income: 0,
    fixed_expenses: 0,
    saving_percentage: 20,
    daily_limit: 0,
    success_reserve: 0,
    current_streak: 0,
    max_streak: 0,
    snooze_until: null,
    last_closed_date: null,
    created_at: new Date(),
    onboarding_step: 'awaiting_salary',
    timezone: 'America/Sao_Paulo',
    reminders_enabled: true,
    ...overrides,
  };
}

function makeRepo(initial: User) {
  let current = { ...initial };
  return {
    state: () => current,
    updateUser: vi.fn(async (_id: string, patch: Partial<User>) => {
      current = { ...current, ...patch } as User;
      return current;
    }),
  };
}

function makeCtx() {
  return {
    from: { first_name: 'Test', id: 1 },
    reply: vi.fn(async () => {}),
    editMessageText: vi.fn(async () => {}),
    answerCbQuery: vi.fn(async () => {}),
  };
}

describe('OnboardingHandler.continue (state transitions)', () => {
  let user: User;
  let repo: ReturnType<typeof makeRepo>;
  let handler: OnboardingHandler;

  beforeEach(() => {
    user = makeUser();
    repo = makeRepo(user);
    handler = new OnboardingHandler(repo as never);
  });

  it('moves from awaiting_salary → awaiting_fixed_expenses on valid input', async () => {
    const ctx = makeCtx();
    await handler.continue(ctx as never, user, 'R$ 3.000,00');

    expect(repo.updateUser).toHaveBeenCalledWith('user-1', {
      monthly_income: 3000,
      onboarding_step: 'awaiting_fixed_expenses',
    });
    expect(repo.state().onboarding_step).toBe('awaiting_fixed_expenses');
  });

  it('re-asks salary when input is invalid', async () => {
    const ctx = makeCtx();
    await handler.continue(ctx as never, user, 'sem dinheiro');

    expect(repo.updateUser).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalled();
  });

  it('rejects 0 as salary', async () => {
    const ctx = makeCtx();
    await handler.continue(ctx as never, user, '0');
    expect(repo.updateUser).not.toHaveBeenCalled();
  });

  it('moves from awaiting_fixed_expenses → awaiting_saving_pct accepting 0', async () => {
    user = makeUser({ onboarding_step: 'awaiting_fixed_expenses', monthly_income: 3000 });
    repo = makeRepo(user);
    handler = new OnboardingHandler(repo as never);
    const ctx = makeCtx();

    await handler.continue(ctx as never, user, '0');

    expect(repo.updateUser).toHaveBeenCalledWith('user-1', {
      fixed_expenses: 0,
      onboarding_step: 'awaiting_saving_pct',
    });
  });

  it('moves from awaiting_saving_pct → awaiting_reminder_pref on 20%', async () => {
    user = makeUser({
      onboarding_step: 'awaiting_saving_pct',
      monthly_income: 3000,
      fixed_expenses: 1000,
    });
    repo = makeRepo(user);
    handler = new OnboardingHandler(repo as never);
    const ctx = makeCtx();

    await handler.continue(ctx as never, user, '20%');

    expect(repo.updateUser).toHaveBeenCalledWith('user-1', {
      saving_percentage: 20,
      onboarding_step: 'awaiting_reminder_pref',
    });
  });

  it('rejects saving percentage out of range', async () => {
    user = makeUser({ onboarding_step: 'awaiting_saving_pct' });
    repo = makeRepo(user);
    handler = new OnboardingHandler(repo as never);
    const ctx = makeCtx();

    await handler.continue(ctx as never, user, '150');

    expect(repo.updateUser).not.toHaveBeenCalled();
  });

  it('asks user to use buttons when typing during awaiting_reminder_pref', async () => {
    user = makeUser({ onboarding_step: 'awaiting_reminder_pref' });
    repo = makeRepo(user);
    handler = new OnboardingHandler(repo as never);
    const ctx = makeCtx();

    await handler.continue(ctx as never, user, 'sim');
    expect(repo.updateUser).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(2); // hint + re-ask with buttons
  });
});

describe('OnboardingHandler.handleReminderChoice', () => {
  it('completes onboarding and computes daily_limit', async () => {
    const user = makeUser({
      onboarding_step: 'awaiting_reminder_pref',
      monthly_income: 3000,
      fixed_expenses: 1000,
      saving_percentage: 20,
    });
    const repo = makeRepo(user);
    const handler = new OnboardingHandler(repo as never);
    const ctx = makeCtx();

    await handler.handleReminderChoice(ctx as never, user, true);

    // (3000 - 1000) * (1 - 0.20) / 30 = 53.33
    const expected = ((3000 - 1000) * 0.8) / 30;
    expect(repo.updateUser).toHaveBeenCalledWith('user-1', {
      reminders_enabled: true,
      daily_limit: expected,
      onboarding_step: 'completed',
    });
  });

  it('saves reminders_enabled=false on "no"', async () => {
    const user = makeUser({
      onboarding_step: 'awaiting_reminder_pref',
      monthly_income: 3000,
      fixed_expenses: 0,
      saving_percentage: 0,
    });
    const repo = makeRepo(user);
    const handler = new OnboardingHandler(repo as never);
    const ctx = makeCtx();

    await handler.handleReminderChoice(ctx as never, user, false);

    expect(repo.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ reminders_enabled: false, onboarding_step: 'completed' })
    );
  });

  it('ignores callback when not in awaiting_reminder_pref', async () => {
    const user = makeUser({ onboarding_step: 'completed' });
    const repo = makeRepo(user);
    const handler = new OnboardingHandler(repo as never);
    const ctx = makeCtx();

    await handler.handleReminderChoice(ctx as never, user, true);

    expect(repo.updateUser).not.toHaveBeenCalled();
  });
});
