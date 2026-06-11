import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GamificationService } from '../../src/services/GamificationService';
import { DailySnapshotInput } from '../../src/repositories/SnapshotRepository';
import { User } from '../../src/types';

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

const userRepo = { updateUser: vi.fn() };
const txRepo = { getDailyExpenseTotal: vi.fn() };
const eventRepo = { record: vi.fn() };
const snapshotRepo = { existsForDate: vi.fn(), insert: vi.fn(), findLatest: vi.fn() };

const svc = new GamificationService(
  userRepo as never,
  txRepo as never,
  eventRepo as never,
  snapshotRepo as never
);

beforeEach(() => {
  userRepo.updateUser.mockReset();
  txRepo.getDailyExpenseTotal.mockReset();
  eventRepo.record.mockReset();
  snapshotRepo.existsForDate.mockReset();
  snapshotRepo.insert.mockReset();

  userRepo.updateUser.mockResolvedValue(undefined);
  eventRepo.record.mockResolvedValue(undefined);
  snapshotRepo.existsForDate.mockResolvedValue(false);
  snapshotRepo.insert.mockImplementation(async (input: DailySnapshotInput) => ({
    id: 'snap-1',
    ...input,
    snapshot_date: new Date(input.snapshot_date),
    created_at: new Date(),
  }));
});

describe('GamificationService.closeDay', () => {
  it('dia dentro do limite: streak +1 e sobra vai para a reserva (success)', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(50);

    const result = await svc.closeDay(makeUser(), '2026-05-20');

    expect(result?.state).toEqual({ success_reserve: 30, current_streak: 1, max_streak: 1 });
    expect(result?.message).toContain('Dia 20/05');
    expect(snapshotRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ close_result: 'success', total_spent: 50, had_activity: true })
    );
    expect(eventRepo.record).toHaveBeenCalledWith(
      'u1',
      'daily_closed',
      expect.objectContaining({ close_result: 'success', snapshot_date: '2026-05-20' })
    );
  });

  it('recusa fechar o dia corrente ou futuro (dia ainda em andamento)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T15:00:00Z'));
    txRepo.getDailyExpenseTotal.mockResolvedValue(50);

    expect(await svc.closeDay(makeUser(), '2026-05-20')).toBeNull();
    expect(await svc.closeDay(makeUser(), '2026-05-21')).toBeNull();

    expect(snapshotRepo.insert).not.toHaveBeenCalled();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('dia inativo (sem gastos) conta como sucesso', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(0);

    const result = await svc.closeDay(makeUser(), '2026-05-20');

    expect(result?.state.current_streak).toBe(1);
    expect(result?.state.success_reserve).toBe(80);
    expect(snapshotRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ close_result: 'success', had_activity: false })
    );
  });

  it('estouro absorvido pela reserva mantém o streak (reserve_used)', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(100);

    const result = await svc.closeDay(
      makeUser({ success_reserve: 50, current_streak: 4, max_streak: 4 }),
      '2026-05-20'
    );

    expect(result?.state).toEqual({ success_reserve: 30, current_streak: 4, max_streak: 4 });
    expect(snapshotRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ close_result: 'reserve_used' })
    );
  });

  it('estouro além da reserva zera reserva e streak (streak_reset)', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(200);

    const result = await svc.closeDay(
      makeUser({ success_reserve: 10, current_streak: 7, max_streak: 7 }),
      '2026-05-20'
    );

    expect(result?.state).toEqual({ success_reserve: 0, current_streak: 0, max_streak: 7 });
    expect(snapshotRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ close_result: 'streak_reset' })
    );
  });

  it('é idempotente: não faz nada se o snapshot do dia já existe', async () => {
    snapshotRepo.existsForDate.mockResolvedValue(true);
    txRepo.getDailyExpenseTotal.mockResolvedValue(50);

    const result = await svc.closeDay(makeUser(), '2026-05-20');

    expect(result).toBeNull();
    expect(snapshotRepo.insert).not.toHaveBeenCalled();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(eventRepo.record).not.toHaveBeenCalled();
  });

  it('aborta sem alterar estado se o insert colidir (corrida)', async () => {
    snapshotRepo.insert.mockResolvedValue(null);
    txRepo.getDailyExpenseTotal.mockResolvedValue(50);

    const result = await svc.closeDay(makeUser(), '2026-05-20');

    expect(result).toBeNull();
    expect(userRepo.updateUser).not.toHaveBeenCalled();
    expect(eventRepo.record).not.toHaveBeenCalled();
  });
});

describe('GamificationService.closeDay — bordas', () => {
  it('gasto exatamente no limite conta como sucesso (sobra zero)', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(80);

    const result = await svc.closeDay(makeUser(), '2026-05-20');

    expect(result?.state).toEqual({ success_reserve: 0, current_streak: 1, max_streak: 1 });
    expect(snapshotRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ close_result: 'success', total_spent: 80 })
    );
  });

  it('reserva que cobre exatamente o excesso mantém o streak', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(100);

    const result = await svc.closeDay(
      makeUser({ success_reserve: 20, current_streak: 3, max_streak: 3 }),
      '2026-05-20'
    );

    expect(result?.state).toEqual({ success_reserve: 0, current_streak: 3, max_streak: 3 });
    expect(snapshotRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ close_result: 'reserve_used' })
    );
  });

  it('atualiza max_streak ao bater novo recorde', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(10);

    const result = await svc.closeDay(
      makeUser({ current_streak: 5, max_streak: 5 }),
      '2026-05-20'
    );

    expect(result?.state.current_streak).toBe(6);
    expect(result?.state.max_streak).toBe(6);
    expect(userRepo.updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ max_streak: 6 })
    );
  });

  it('grava last_closed_date com a data do dia fechado', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(10);

    await svc.closeDay(makeUser(), '2026-05-20');

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ last_closed_date: new Date('2026-05-20') })
    );
  });
});

describe('GamificationService.closePendingDays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fecha apenas dias completos, até ontem (nunca o dia corrente)', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(0);

    const message = await svc.closePendingDays(
      makeUser({ last_closed_date: new Date('2026-05-21') })
    );

    const dias = snapshotRepo.insert.mock.calls.map((c) => (c[0] as DailySnapshotInput).snapshot_date);
    expect(dias).toEqual(['2026-05-22', '2026-05-23']);

    const streaks = snapshotRepo.insert.mock.calls.map((c) => (c[0] as DailySnapshotInput).current_streak);
    expect(streaks).toEqual([1, 2]);

    expect(message).toContain('Dia 23/05 fechado com sucesso');
  });

  it('não fecha nada quando o último fechamento já é ontem', async () => {
    const message = await svc.closePendingDays(
      makeUser({ last_closed_date: new Date('2026-05-23') })
    );

    expect(message).toBeNull();
    expect(snapshotRepo.insert).not.toHaveBeenCalled();
  });

  it('regressão: cron disparado logo após a meia-noite fecha ontem, não o dia novo', async () => {
    vi.setSystemTime(new Date('2026-05-25T03:05:00Z'));
    txRepo.getDailyExpenseTotal.mockResolvedValue(9);

    await svc.closePendingDays(makeUser({ last_closed_date: new Date('2026-05-23') }));

    const dias = snapshotRepo.insert.mock.calls.map(
      (c) => (c[0] as DailySnapshotInput).snapshot_date
    );
    expect(dias).toEqual(['2026-05-24']);
    expect(snapshotRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ total_spent: 9 })
    );
  });

  it('acumula a reserva ao longo dos dias recuperados', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(0);

    await svc.closePendingDays(makeUser({ last_closed_date: new Date('2026-05-21') }));

    const reservas = snapshotRepo.insert.mock.calls.map(
      (c) => (c[0] as DailySnapshotInput).success_reserve
    );
    expect(reservas).toEqual([80, 160]);
  });

  it('usuário sem last_closed_date fecha do dia de criação até ontem', async () => {
    txRepo.getDailyExpenseTotal.mockResolvedValue(0);

    const message = await svc.closePendingDays(
      makeUser({ last_closed_date: null, created_at: new Date('2026-05-22T18:00:00Z') })
    );

    const dias = snapshotRepo.insert.mock.calls.map(
      (c) => (c[0] as DailySnapshotInput).snapshot_date
    );
    expect(dias).toEqual(['2026-05-22', '2026-05-23']);
    expect(message).toContain('fechado com sucesso');
  });

  it('usuário criado hoje não fecha nada', async () => {
    const message = await svc.closePendingDays(
      makeUser({ last_closed_date: null, created_at: new Date('2026-05-24T11:00:00Z') })
    );

    expect(message).toBeNull();
    expect(snapshotRepo.insert).not.toHaveBeenCalled();
  });
});
