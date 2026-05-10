import { describe, it, expect } from 'vitest';
import { DateService } from '../../src/services/DateService';

const TZ = 'America/Sao_Paulo';

describe('DateService.getWeekBounds', () => {
  it('spans 7 days ending at the end of today (BR)', () => {
    const ds = new DateService(TZ);
    const ref = new Date('2026-05-10T15:00:00Z');
    const { start, end } = ds.getWeekBounds(TZ, ref);

    expect(start.toISOString()).toBe('2026-05-04T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-11T02:59:59.999Z');
  });
});

describe('DateService.formatDate', () => {
  it('formats as dd/MM in pt-BR', () => {
    const ds = new DateService(TZ);
    const date = new Date('2026-05-10T15:00:00Z');
    expect(ds.formatDate(date, TZ)).toBe('10/05');
  });

  it('reflects the local date even when UTC is on the next day', () => {
    const ds = new DateService(TZ);
    const date = new Date('2026-05-11T02:30:00Z'); // 23:30 BR on 10
    expect(ds.formatDate(date, TZ)).toBe('10/05');
  });
});
