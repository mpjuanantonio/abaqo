import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  budgetMonthContaining,
  budgetMonthContainingDate,
  budgetMonthStartInstant,
  calendarDate,
  formatCalendarDate,
  madridCalendarDate,
  nextBudgetMonth,
  previousBudgetMonth,
  type CalendarDate,
} from '../budget-month.js';

const startDay = fc.integer({ min: 1, max: 31 });
// 1970-01-01T00:00Z .. 2200-01-01T00:00Z
const instant = fc.integer({ min: 0, max: Date.UTC(2200, 0, 1) - 1 }).map((ms) => new Date(ms));
const date = fc
  .record({
    year: fc.integer({ min: 1970, max: 2199 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 31 }),
  })
  .filter(({ year, month, day }) => {
    try {
      calendarDate(year, month, day);
      return true;
    } catch {
      return false;
    }
  });

/** Whole days from a to b, via ISO strings parsed as UTC midnight (test-only arithmetic). */
function daysBetween(a: CalendarDate, b: CalendarDate): number {
  const ms = (d: CalendarDate) => Date.parse(`${formatCalendarDate(d)}T00:00:00Z`);
  return (ms(b) - ms(a)) / 86_400_000;
}

describe('budget month invariants (property tests)', () => {
  it('the month returned for an instant contains it, between its start and the next start', () => {
    fc.assert(
      fc.property(instant, startDay, (t, sd) => {
        const m = budgetMonthContaining(t, sd);
        expect(budgetMonthStartInstant(m).getTime()).toBeLessThanOrEqual(t.getTime());
        expect(budgetMonthStartInstant(nextBudgetMonth(m)).getTime()).toBeGreaterThan(t.getTime());
      }),
    );
  });

  it('the month returned for a date contains it', () => {
    fc.assert(
      fc.property(date, startDay, (d, sd) => {
        const m = budgetMonthContainingDate(d, sd);
        expect(daysBetween(m.start, d)).toBeGreaterThanOrEqual(0);
        expect(daysBetween(d, m.end)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('months tile the calendar: next starts the day after end, 28-31 days long', () => {
    fc.assert(
      fc.property(date, startDay, (d, sd) => {
        const m = budgetMonthContainingDate(d, sd);
        const n = nextBudgetMonth(m);
        expect(daysBetween(m.end, n.start)).toBe(1);
        const length = daysBetween(m.start, m.end) + 1;
        expect(length).toBeGreaterThanOrEqual(28);
        expect(length).toBeLessThanOrEqual(31);
        expect(n.key > m.key).toBe(true);
      }),
    );
  });

  it('next(previous(m)) equals m', () => {
    fc.assert(
      fc.property(date, startDay, (d, sd) => {
        const m = budgetMonthContainingDate(d, sd);
        expect(nextBudgetMonth(previousBudgetMonth(m))).toEqual(m);
      }),
    );
  });

  it('the start instant is 00:00 Madrid: on the start date, and 1 ms earlier the day before', () => {
    fc.assert(
      fc.property(date, startDay, (d, sd) => {
        const m = budgetMonthContainingDate(d, sd);
        const start = budgetMonthStartInstant(m).getTime();
        expect(madridCalendarDate(new Date(start))).toEqual(m.start);
        expect(daysBetween(madridCalendarDate(new Date(start - 1)), m.start)).toBe(1);
      }),
    );
  });
});
