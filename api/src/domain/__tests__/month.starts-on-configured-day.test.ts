import { describe, expect, it } from 'vitest';
import { budgetMonthContainingDate, calendarDate, formatCalendarDate } from '../budget-month.js';
import { day } from '../../../test/builders.js';

// envelope-rules, Month: "A budget month starts on the user's configured day
// (settings.month_start_day, default 1) at 00:00 Europe/Madrid and ends the day before the next
// start."
describe('a budget month starts on the configured day and ends the day before the next start', () => {
  it('default start day 1 is the calendar month', () => {
    const m = budgetMonthContainingDate(day('2026-03-17'), 1);
    expect(m).toEqual({
      startDay: 1,
      start: day('2026-03-01'),
      end: day('2026-03-31'),
      key: '2026-03',
    });
  });

  it('start day 1: the first and last days belong to that calendar month', () => {
    expect(budgetMonthContainingDate(day('2026-02-01'), 1).end).toEqual(day('2026-02-28'));
    expect(budgetMonthContainingDate(day('2026-02-28'), 1).start).toEqual(day('2026-02-01'));
  });

  it('start day 25: a date on or after the 25th starts a month that ends on the 24th', () => {
    const m = budgetMonthContainingDate(day('2026-03-25'), 25);
    expect(m.start).toEqual(day('2026-03-25'));
    expect(m.end).toEqual(day('2026-04-24'));
    expect(m.key).toBe('2026-03');
  });

  it('start day 25: a date before the 25th belongs to the month that started last month', () => {
    const m = budgetMonthContainingDate(day('2026-03-24'), 25);
    expect(m.start).toEqual(day('2026-02-25'));
    expect(m.end).toEqual(day('2026-03-24'));
    expect(m.key).toBe('2026-02');
  });

  it('crosses the year boundary', () => {
    const m = budgetMonthContainingDate(day('2027-01-10'), 15);
    expect(m.start).toEqual(day('2026-12-15'));
    expect(m.end).toEqual(day('2027-01-14'));
    expect(m.key).toBe('2026-12');
  });

  it.each([0, 32, 1.5, Number.NaN])('rejects start day %s', (startDay) => {
    expect(() => budgetMonthContainingDate(day('2026-03-17'), startDay)).toThrow(RangeError);
  });
});

describe('calendar dates', () => {
  it('validates and formats as ISO YYYY-MM-DD', () => {
    expect(formatCalendarDate(calendarDate(2024, 2, 29))).toBe('2024-02-29');
    expect(formatCalendarDate(calendarDate(987, 1, 5))).toBe('0987-01-05');
  });

  it.each([
    [2025, 2, 29],
    [2026, 4, 31],
    [2026, 13, 1],
    [2026, 0, 1],
    [2026, 1, 0],
    [0, 1, 1],
    [2026, 1, 1.5],
  ])('rejects %i-%i-%s', (y, m, d) => {
    expect(() => calendarDate(y, m, d)).toThrow(RangeError);
  });

  it('rejects an invalid date passed to the month functions', () => {
    expect(() => budgetMonthContainingDate({ year: 2026, month: 2, day: 30 }, 1)).toThrow(
      RangeError,
    );
  });
});
