import { describe, expect, it } from 'vitest';
import {
  budgetMonthContainingDate,
  budgetMonthStartInstant,
  formatCalendarDate,
  nextBudgetMonth,
  previousBudgetMonth,
} from '../budget-month.js';

// Hand-written day-of-month on which the budget month starting in each calendar month (Jan..Dec)
// starts. Nothing here is computed.
const NON_LEAP_2025: Record<number, number[]> = {
  28: [28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  29: [29, 28, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29],
  30: [30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  31: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
};
const LEAP_2024: Record<number, number[]> = {
  28: [28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  29: [29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29],
  30: [30, 29, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  31: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
};
// Hand-written end dates (the day before the next start) for start day 31, 2025 and 2024.
const END_31_2025 = [
  '2025-02-27',
  '2025-03-30',
  '2025-04-29',
  '2025-05-30',
  '2025-06-29',
  '2025-07-30',
  '2025-08-30',
  '2025-09-29',
  '2025-10-30',
  '2025-11-29',
  '2025-12-30',
  '2026-01-30',
];
const END_31_2024 = [
  '2024-02-28',
  '2024-03-30',
  '2024-04-29',
  '2024-05-30',
  '2024-06-29',
  '2024-07-30',
  '2024-08-30',
  '2024-09-29',
  '2024-10-30',
  '2024-11-29',
  '2024-12-30',
  '2025-01-30',
];

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Independent previous-day computation through the platform Date (UTC, no time zone issues). */
function dayBefore(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

describe.each([
  ['non-leap 2025', 2025, NON_LEAP_2025],
  ['leap 2024', 2024, LEAP_2024],
])('start days 28-31 through %s', (_label, year, table) => {
  describe.each([28, 29, 30, 31])('start day %i', (startDay) => {
    const starts = table[startDay] as number[];

    it.each(starts.map((d, i) => [i + 1, d]))('calendar month %i starts on day %i', (month, d) => {
      const m = budgetMonthContainingDate({ year, month, day: d }, startDay);
      expect(formatCalendarDate(m.start)).toBe(iso(year, month, d));
      expect(m.key).toBe(iso(year, month, 1).slice(0, 7));
      expect(m.startDay).toBe(startDay);
    });

    it.each(starts.map((d, i) => [i + 1, d]))(
      'the day before the start in calendar month %i belongs to the previous month',
      (month, d) => {
        const before = dayBefore(year, month, d);
        const [y, mo, da] = before.split('-').map(Number) as [number, number, number];
        const m = budgetMonthContainingDate({ year: y, month: mo, day: da }, startDay);
        // it started in the previous calendar month (December of the previous year for January)
        const prevMonth = month === 1 ? 12 : month - 1;
        expect(m.key.slice(5)).toBe(String(prevMonth).padStart(2, '0'));
        expect(formatCalendarDate(m.end)).toBe(before);
      },
    );

    it('the end is the day before the next start (hand tables)', () => {
      starts.forEach((d, i) => {
        const month = i + 1;
        const nextDay =
          month === 12
            ? Math.min(startDay, 31) // January of the next year always has the day
            : (starts[i + 1] as number);
        const [ny, nm] = month === 12 ? [year + 1, 1] : [year, month + 1];
        const m = budgetMonthContainingDate({ year, month, day: d }, startDay);
        expect(formatCalendarDate(m.end)).toBe(dayBefore(ny, nm, nextDay));
      });
    });

    it('walking next twelve times visits each calendar month once, in order', () => {
      let m = budgetMonthContainingDate({ year, month: 1, day: starts[0] as number }, startDay);
      starts.forEach((d, i) => {
        expect(formatCalendarDate(m.start)).toBe(iso(year, i + 1, d));
        m = nextBudgetMonth(m);
      });
      expect(m.key).toBe(`${year + 1}-01`);
    });

    it('walking previous from the next January goes back through the table', () => {
      let m = budgetMonthContainingDate({ year: year + 1, month: 1, day: startDay }, startDay);
      for (let i = 11; i >= 0; i--) {
        m = previousBudgetMonth(m);
        expect(formatCalendarDate(m.start)).toBe(iso(year, i + 1, starts[i] as number));
      }
    });
  });
});

describe('start day 31, hand-written end dates', () => {
  it.each(NON_LEAP_2025[31]!.map((d, i) => [i + 1, d, END_31_2025[i]]))(
    '2025 month %i starts on %i and ends on %s',
    (month, d, end) => {
      const m = budgetMonthContainingDate(
        { year: 2025, month: month as number, day: d as number },
        31,
      );
      expect(formatCalendarDate(m.end)).toBe(end);
    },
  );
  it.each(LEAP_2024[31]!.map((d, i) => [i + 1, d, END_31_2024[i]]))(
    '2024 month %i starts on %i and ends on %s',
    (month, d, end) => {
      const m = budgetMonthContainingDate(
        { year: 2024, month: month as number, day: d as number },
        31,
      );
      expect(formatCalendarDate(m.end)).toBe(end);
    },
  );
});

describe('the whole calendar is covered exactly once', () => {
  it.each([
    [2024, 366],
    [2025, 365],
    [2100, 365],
    [2400, 366],
  ])('year %i: every day belongs to exactly one month; lengths sum to %i', (year, days) => {
    for (const startDay of [1, 28, 29, 30, 31]) {
      let m = budgetMonthContainingDate({ year, month: 1, day: startDay }, startDay);
      // first start in the year
      const first = m.start;
      let total = 0;
      for (let i = 0; i < 12; i++) {
        const len =
          (Date.UTC(m.end.year, m.end.month - 1, m.end.day) -
            Date.UTC(m.start.year, m.start.month - 1, m.start.day)) /
            86_400_000 +
          1;
        total += len;
        m = nextBudgetMonth(m);
      }
      // twelve consecutive months span exactly one year from the first start
      const span =
        (Date.UTC(m.start.year, m.start.month - 1, m.start.day) -
          Date.UTC(first.year, first.month - 1, first.day)) /
        86_400_000;
      expect(total).toBe(span);
      expect([365, 366]).toContain(total);
      if (startDay === 1) expect(total).toBe(days);
    }
  });
});

describe('leap-year rules in far years', () => {
  it.each([
    [2100, 2, 28],
    [2200, 2, 28],
    [2300, 2, 28],
    [2400, 2, 29],
    [2000, 2, 29],
    [1900, 2, 28],
    [2096, 2, 29],
  ])('start day 31 in February %i starts on %i-02-%i', (year, month, day) => {
    const m = budgetMonthContainingDate({ year, month, day }, 31);
    expect(formatCalendarDate(m.start)).toBe(iso(year, month, day));
  });

  it('29 Feb 2100 does not exist', () => {
    expect(() => budgetMonthContainingDate({ year: 2100, month: 2, day: 29 }, 1)).toThrow(
      RangeError,
    );
    expect(() => budgetMonthContainingDate({ year: 2400, month: 2, day: 30 }, 1)).toThrow(
      RangeError,
    );
  });

  it('start day 29 in 2099-2100-2101: February starts on 28 in 2100, 28 in 2099, 28 in 2101', () => {
    for (const y of [2099, 2100, 2101]) {
      const m = budgetMonthContainingDate({ year: y, month: 2, day: 28 }, 29);
      expect(formatCalendarDate(m.start)).toBe(`${y}-02-28`);
      expect(formatCalendarDate(m.end)).toBe(`${y}-03-28`);
    }
  });

  it('start instant in 2100 and 2400 is 23:00Z / 22:00Z the day before', () => {
    const jan = budgetMonthContainingDate({ year: 2100, month: 1, day: 1 }, 1);
    expect(budgetMonthStartInstant(jan).toISOString()).toBe('2099-12-31T23:00:00.000Z');
    const jul = budgetMonthContainingDate({ year: 2400, month: 7, day: 1 }, 1);
    expect(budgetMonthStartInstant(jul).toISOString()).toBe('2400-06-30T22:00:00.000Z');
  });
});

describe('edges of the supported range', () => {
  it('the last supported month cannot silently overflow to year 10000', () => {
    const dec = budgetMonthContainingDate({ year: 9999, month: 12, day: 31 }, 1);
    expect(() => nextBudgetMonth(dec)).toThrow(RangeError);
  });
  it('the first supported month has no previous one', () => {
    const jan = budgetMonthContainingDate({ year: 1, month: 1, day: 1 }, 1);
    expect(() => previousBudgetMonth(jan)).toThrow(RangeError);
  });
});

describe('invalid start days', () => {
  it.each(['5', null, undefined, 1.5, 0, -1, 32, Number.NaN, Number.POSITIVE_INFINITY, [1], {}])(
    'rejects %s',
    (startDay) => {
      expect(() =>
        budgetMonthContainingDate({ year: 2026, month: 1, day: 10 }, startDay as never),
      ).toThrow(RangeError);
    },
  );
});
