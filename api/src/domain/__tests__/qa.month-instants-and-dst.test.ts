import { describe, expect, it } from 'vitest';
import {
  budgetMonthContaining,
  budgetMonthContainingDate,
  budgetMonthStartInstant,
  formatCalendarDate,
  madridCalendarDate,
  nextBudgetMonth,
} from '../budget-month.js';

// Hand-written Europe/Madrid DST change days (last Sunday of March / October).
const CHANGES: { year: number; spring: number; autumn: number }[] = [
  { year: 2025, spring: 30, autumn: 26 },
  { year: 2026, spring: 29, autumn: 25 },
  { year: 2027, spring: 28, autumn: 31 },
  { year: 2032, spring: 28, autumn: 31 },
];

const pad = (n: number) => String(n).padStart(2, '0');
const startOf = (m: { start: { year: number; month: number; day: number } }) =>
  formatCalendarDate(m.start);

describe.each(CHANGES)('DST change days in $year', ({ year, spring, autumn }) => {
  it(`spring ${year}-03-${spring}: a month starting that day begins 00:00 CET = 23:00Z the day before`, () => {
    const start = Date.UTC(year, 2, spring - 1, 23, 0, 0, 0);
    const at = budgetMonthContaining(new Date(start), spring);
    expect(startOf(at)).toBe(`${year}-03-${pad(spring)}`);
    const before = budgetMonthContaining(new Date(start - 1), spring);
    expect(startOf(before)).toBe(`${year}-02-28`);
    expect(budgetMonthStartInstant(at).toISOString()).toBe(new Date(start).toISOString());
  });

  it(`autumn ${year}-10-${autumn}: a month starting that day begins 00:00 CEST = 22:00Z the day before`, () => {
    const start = Date.UTC(year, 9, autumn - 1, 22, 0, 0, 0);
    const at = budgetMonthContaining(new Date(start), autumn);
    expect(startOf(at)).toBe(`${year}-10-${pad(autumn)}`);
    const before = budgetMonthContaining(new Date(start - 1), autumn);
    expect(startOf(before)).toBe(`${year}-09-${autumn}`.replace('-09-31', '-09-30'));
    expect(budgetMonthStartInstant(at).toISOString()).toBe(new Date(start).toISOString());
  });

  it('the day after the change day starts at the new offset', () => {
    // spring: the 28th-30th March + 1 never leaves March; CEST means 00:00 is 22:00Z the day before
    const sd = new Date(Date.UTC(year, 2, spring + 1));
    const springNext = budgetMonthContainingDate(
      { year, month: 3, day: sd.getUTCDate() },
      sd.getUTCDate(),
    );
    expect(budgetMonthStartInstant(springNext).toISOString()).toBe(
      new Date(Date.UTC(year, 2, spring, 22)).toISOString(),
    );
    // autumn: back on CET, 00:00 is 23:00Z the day before (the 31st rolls over to 1 November)
    const ad = new Date(Date.UTC(year, 9, autumn + 1));
    const autumnNext = budgetMonthContainingDate(
      { year: year, month: ad.getUTCMonth() + 1, day: ad.getUTCDate() },
      ad.getUTCDate(),
    );
    expect(budgetMonthStartInstant(autumnNext).toISOString()).toBe(
      new Date(Date.UTC(year, 9, autumn, 23)).toISOString(),
    );
  });

  it('calendar date of instants through the spring gap', () => {
    // 00:59:59.999Z = 01:59:59.999 CET; 01:00:00Z = 03:00 CEST. Same day in both.
    expect(madridCalendarDate(new Date(Date.UTC(year, 2, spring, 0, 59, 59, 999)))).toEqual({
      year,
      month: 3,
      day: spring,
    });
    expect(madridCalendarDate(new Date(Date.UTC(year, 2, spring, 1, 0, 0, 0)))).toEqual({
      year,
      month: 3,
      day: spring,
    });
    // 22:59:59.999Z is 23:59:59.999 CEST... on the change day offset is +2 after 01:00Z
    expect(madridCalendarDate(new Date(Date.UTC(year, 2, spring, 21, 59, 59, 999)))).toEqual({
      year,
      month: 3,
      day: spring,
    });
    expect(madridCalendarDate(new Date(Date.UTC(year, 2, spring, 22, 0, 0, 0)))).toEqual({
      year,
      month: 3,
      day: spring + 1,
    });
  });

  it('the ambiguous 02:30 on the autumn change day falls on the same date both times', () => {
    const first = new Date(Date.UTC(year, 9, autumn, 0, 30)); // 02:30 CEST
    const second = new Date(Date.UTC(year, 9, autumn, 1, 30)); // 02:30 CET
    const d1 = madridCalendarDate(first);
    const d2 = madridCalendarDate(second);
    expect(d1).toEqual({ year, month: 10, day: autumn });
    expect(d2).toEqual({ year, month: 10, day: autumn });
    expect(startOf(budgetMonthContaining(first, autumn))).toBe(`${year}-10-${pad(autumn)}`);
    expect(startOf(budgetMonthContaining(second, autumn))).toBe(`${year}-10-${pad(autumn)}`);
  });

  it('the last millisecond of the autumn change day (23:59:59.999 CET) is still that day', () => {
    const last = new Date(Date.UTC(year, 9, autumn, 22, 59, 59, 999));
    expect(madridCalendarDate(last)).toEqual({ year, month: 10, day: autumn });
    const nextMidnight = new Date(Date.UTC(year, 9, autumn, 23, 0, 0, 0));
    expect(madridCalendarDate(nextMidnight)).toEqual({
      year: autumn === 31 ? year : year,
      month: autumn === 31 ? 11 : 10,
      day: autumn === 31 ? 1 : autumn + 1,
    });
  });
});

describe('Madrid midnight in the year (every start day), independent oracle', () => {
  // The oracle is the platform formatter with the sv-SE locale ("2026-03-29 00:00:00"), not the
  // implementation's own formatter.
  const oracle = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  it.each([2025, 2026, 2027, 2032, 2100])(
    'year %i: for every day, the start instant is exactly Madrid 00:00:00 and 1 ms earlier is the day before',
    (year) => {
      for (let month = 1; month <= 12; month++) {
        const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
        for (let day = 1; day <= days; day++) {
          const m = budgetMonthContainingDate({ year, month, day }, day);
          expect(startOf(m)).toBe(`${year}-${pad(month)}-${pad(day)}`);
          const at = budgetMonthStartInstant(m);
          expect(oracle.format(at)).toBe(`${year}-${pad(month)}-${pad(day)} 00:00:00`);
          const prev = new Date(at.getTime() - 1);
          expect(oracle.format(prev).slice(0, 10)).not.toBe(`${year}-${pad(month)}-${pad(day)}`);
          expect(startOf(budgetMonthContaining(at, day))).toBe(startOf(m));
          expect(startOf(budgetMonthContaining(prev, day))).not.toBe(startOf(m));
        }
      }
    },
  );

  it.each([2026, 2027, 2100])(
    'year %i: every 30 minutes the Madrid date matches the oracle',
    (year) => {
      const from = Date.UTC(year, 0, 1) - 3 * 3600_000;
      const to = Date.UTC(year + 1, 0, 1) + 3 * 3600_000;
      for (let t = from; t <= to; t += 30 * 60_000) {
        const wall = oracle.format(new Date(t)); // "YYYY-MM-DD hh:mm:ss"
        const d = madridCalendarDate(new Date(t));
        expect(formatCalendarDate(d)).toBe(wall.slice(0, 10));
      }
    },
  );

  it('year 2400: the Madrid date matches the oracle around both DST changes', () => {
    for (const [mo, from] of [
      [2, 20],
      [9, 20],
    ] as const) {
      for (let t = Date.UTC(2400, mo, from); t < Date.UTC(2400, mo, from + 14); t += 15 * 60_000) {
        const wall = oracle.format(new Date(t));
        expect(formatCalendarDate(madridCalendarDate(new Date(t)))).toBe(wall.slice(0, 10));
      }
    }
  });
});

describe('instants across month boundaries', () => {
  it('New Year in Madrid: 2025-12-31T23:00:00.000Z is 1 January 2026', () => {
    expect(startOf(budgetMonthContaining(new Date('2025-12-31T23:00:00.000Z'), 1))).toBe(
      '2026-01-01',
    );
    expect(startOf(budgetMonthContaining(new Date('2025-12-31T22:59:59.999Z'), 1))).toBe(
      '2025-12-01',
    );
  });

  it('Madrid midnight in summer: 2026-06-30T22:00:00.000Z starts July', () => {
    expect(startOf(budgetMonthContaining(new Date('2026-06-30T22:00:00.000Z'), 1))).toBe(
      '2026-07-01',
    );
    expect(startOf(budgetMonthContaining(new Date('2026-06-30T21:59:59.999Z'), 1))).toBe(
      '2026-06-01',
    );
  });

  it('start day 31 and the 30 April midnight: 2026-04-29T22:00Z starts the April month', () => {
    expect(startOf(budgetMonthContaining(new Date('2026-04-29T22:00:00.000Z'), 31))).toBe(
      '2026-04-30',
    );
    expect(startOf(budgetMonthContaining(new Date('2026-04-29T21:59:59.999Z'), 31))).toBe(
      '2026-03-31',
    );
  });

  it('is independent of the instant being a Date of another realm-agnostic subclass', () => {
    class D extends Date {}
    expect(startOf(budgetMonthContaining(new D('2026-02-15T12:00:00Z'), 1))).toBe('2026-02-01');
  });

  it('every month of a run of 40 years is contiguous in instants', () => {
    let m = budgetMonthContainingDate({ year: 2026, month: 1, day: 31 }, 31);
    let prevEnd = Number.NaN;
    for (let i = 0; i < 480; i++) {
      const startMs = budgetMonthStartInstant(m).getTime();
      const next = nextBudgetMonth(m);
      const nextMs = budgetMonthStartInstant(next).getTime();
      // between 28 and 31 days, +- 1 h for DST
      const days = (nextMs - startMs) / 86_400_000;
      expect(days).toBeGreaterThan(27.9);
      expect(days).toBeLessThan(31.1);
      if (!Number.isNaN(prevEnd)) expect(startMs).toBe(prevEnd);
      prevEnd = nextMs;
      m = next;
    }
  });
});

describe('invalid instants', () => {
  it.each([
    new Date(Number.NaN),
    new Date('garbage'),
    '2026-01-01' as never,
    1767225600000 as never,
    null as never,
    undefined as never,
    {} as never,
    new Date(8.64e15),
    new Date(-8.64e15),
  ])('budgetMonthContaining rejects %s', (instant) => {
    expect(() => budgetMonthContaining(instant, 1)).toThrow(RangeError);
  });

  it('start day as a string or a float is rejected for instants too', () => {
    expect(() => budgetMonthContaining(new Date('2026-05-05T10:00:00Z'), '5' as never)).toThrow(
      RangeError,
    );
    expect(() => budgetMonthContaining(new Date('2026-05-05T10:00:00Z'), 5.5 as never)).toThrow(
      RangeError,
    );
    expect(() => budgetMonthContaining(new Date('2026-05-05T10:00:00Z'), 0)).toThrow(RangeError);
  });

  it('budgetMonthStartInstant and next/previous reject a forged month', () => {
    const real = budgetMonthContainingDate({ year: 2026, month: 3, day: 10 }, 5);
    const forged = { ...real, end: { year: 2026, month: 4, day: 30 } };
    expect(() => budgetMonthStartInstant(forged)).toThrow(RangeError);
    expect(() => nextBudgetMonth(forged)).toThrow(RangeError);
    expect(() => budgetMonthStartInstant({ ...real, startDay: '5' as never })).toThrow(RangeError);
  });
});
