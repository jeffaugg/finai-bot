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
