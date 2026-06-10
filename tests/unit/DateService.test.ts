import { describe, it, expect } from 'vitest';
import { DateService } from '../../src/services/DateService';

const TZ = 'America/Sao_Paulo';

describe('DateService.getDayBounds', () => {
  it('returns midnight São Paulo (UTC-3) as start of day in UTC', () => {
    const ds = new DateService(TZ);
    const ref = new Date('2026-05-10T15:00:00Z');
    const { start, end } = ds.getDayBounds(TZ, ref);

    expect(start.toISOString()).toBe('2026-05-10T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-11T02:59:59.999Z');
  });

  it('treats 23:59 BR and 00:30 BR (next UTC day) as the same local day', () => {
    const ds = new DateService(TZ);
    const at2359BR = new Date('2026-05-11T02:59:00Z');
    const bounds1 = ds.getDayBounds(TZ, at2359BR);

    expect(bounds1.start.toISOString()).toBe('2026-05-10T03:00:00.000Z');
    expect(bounds1.end.toISOString()).toBe('2026-05-11T02:59:59.999Z');
  });

  it('rolls to next local day after BR midnight', () => {
    const ds = new DateService(TZ);
    const justAfterMidnightBR = new Date('2026-05-11T03:30:00Z');
    const { start, end } = ds.getDayBounds(TZ, justAfterMidnightBR);

    expect(start.toISOString()).toBe('2026-05-11T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-12T02:59:59.999Z');
  });

  it('a transaction at 10am BR is included in the same-day bounds at 23h59 BR', () => {
    const ds = new DateService(TZ);
    const txAt10am = new Date('2026-05-10T13:00:00Z');
    const queryAt23h59 = new Date('2026-05-11T02:59:00Z');

    const bounds = ds.getDayBounds(TZ, queryAt23h59);
    expect(txAt10am >= bounds.start && txAt10am <= bounds.end).toBe(true);
  });
});

describe('DateService.getMonthBounds', () => {
  it('returns full month in São Paulo timezone', () => {
    const ds = new DateService(TZ);
    const { start, end } = ds.getMonthBounds(2026, 5, TZ);

    expect(start.toISOString()).toBe('2026-05-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-01T02:59:59.999Z');
  });

  it('handles December → January boundary', () => {
    const ds = new DateService(TZ);
    const { start, end } = ds.getMonthBounds(2026, 12, TZ);

    expect(start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T02:59:59.999Z');
  });
});

describe('DateService.getCurrentLocalDateString', () => {
  it('returns the local date in São Paulo even when UTC is on the next day', () => {
    const ds = new DateService(TZ);
    const at2359BR = new Date('2026-05-11T02:30:00Z');
    expect(ds.getCurrentLocalDateString(TZ, at2359BR)).toBe('2026-05-10');
  });
});

describe('DateService.getLocalNoon', () => {
  it('converte o meio-dia local de São Paulo para UTC', () => {
    const ds = new DateService(TZ);
    expect(ds.getLocalNoon('2026-06-08').toISOString()).toBe('2026-06-08T15:00:00.000Z');
  });
});

describe('DateService.getPreviousPeriodBounds', () => {
  const ds = new DateService(TZ);
  const ref = new Date('2026-05-10T15:00:00Z'); // 10/mai 12h BR

  it('today → ontem (dia anterior)', () => {
    const { start, end } = ds.getPreviousPeriodBounds('today', ref);
    expect(start.toISOString()).toBe('2026-05-09T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-10T02:59:59.999Z');
  });

  it('yesterday → anteontem', () => {
    const { start, end } = ds.getPreviousPeriodBounds('yesterday', ref);
    expect(start.toISOString()).toBe('2026-05-08T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-09T02:59:59.999Z');
  });

  it('week → os 7 dias anteriores à janela atual', () => {
    const { start, end } = ds.getPreviousPeriodBounds('week', ref);
    // janela atual = [04/mai .. 10/mai]; anterior = [27/abr .. 03/mai]
    expect(start.toISOString()).toBe('2026-04-27T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-04T02:59:59.999Z');
  });

  it('month → mês anterior', () => {
    const { start } = ds.getPreviousPeriodBounds('month', ref);
    expect(start.toISOString()).toBe('2026-04-01T03:00:00.000Z');
  });

  it('last_month → mês retrasado', () => {
    const { start } = ds.getPreviousPeriodBounds('last_month', ref);
    expect(start.toISOString()).toBe('2026-03-01T03:00:00.000Z');
  });
});
