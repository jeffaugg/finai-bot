import { TIMEZONE } from '../types/constants';

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timezone: string): DateParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getTimezoneOffsetMs(timezone: string, utcDate: Date): number {
  const zoned = getZonedParts(utcDate, timezone);
  const asUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return asUtc - utcDate.getTime();
}

function zonedTimeToUtc(parts: DateParts, timezone: string): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const firstGuess = new Date(naive - getTimezoneOffsetMs(timezone, new Date(naive)));
  const refinedOffset = getTimezoneOffsetMs(timezone, firstGuess);
  return new Date(naive - refinedOffset);
}

export class DateService {
  constructor(private readonly defaultTimezone: string = TIMEZONE) {}

  getDayBounds(timezone: string = this.defaultTimezone, ref: Date = new Date()): { start: Date; end: Date } {
    const local = getZonedParts(ref, timezone);
    const start = zonedTimeToUtc(
      { year: local.year, month: local.month, day: local.day, hour: 0, minute: 0, second: 0 },
      timezone
    );
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start, end };
  }

  getMonthBounds(
    year: number,
    month: number,
    timezone: string = this.defaultTimezone
  ): { start: Date; end: Date } {
    const start = zonedTimeToUtc({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, timezone);
    const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const nextStart = zonedTimeToUtc(
      { year: nextMonth.year, month: nextMonth.month, day: 1, hour: 0, minute: 0, second: 0 },
      timezone
    );
    const end = new Date(nextStart.getTime() - 1);
    return { start, end };
  }

  getCurrentLocalDateString(timezone: string = this.defaultTimezone, ref: Date = new Date()): string {
    const p = getZonedParts(ref, timezone);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }
}
