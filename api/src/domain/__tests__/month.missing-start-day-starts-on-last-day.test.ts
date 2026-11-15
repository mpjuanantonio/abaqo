import { describe, expect, it } from 'vitest';
import { budgetMonthContainingDate } from '../budget-month.js';
import { day } from '../../../test/builders.js';

// envelope-rules, Month: "If the day does not exist in a month (29-31), the month starts on that
// month's last day."
describe("a start day missing from a month starts that month's budget month on its last day", () => {
  it('start day 31 across a 30-day month: April starts on the 30th', () => {
    const march = budgetMonthContainingDate(day('2026-04-15'), 31);
    expect(march.start).toEqual(day('2026-03-31'));
    expect(march.end).toEqual(day('2026-04-29'));
    const april = budgetMonthContainingDate(day('2026-04-30'), 31);
    expect(april.start).toEqual(day('2026-04-30'));
    expect(april.end).toEqual(day('2026-05-30'));
    expect(april.key).toBe('2026-04');
  });

  it('start day 31, non-leap February starts on the 28th', () => {
    const jan = budgetMonthContainingDate(day('2026-02-27'), 31);
    expect(jan.start).toEqual(day('2026-01-31'));
    expect(jan.end).toEqual(day('2026-02-27'));
    const feb = budgetMonthContainingDate(day('2026-02-28'), 31);
    expect(feb.start).toEqual(day('2026-02-28'));
    expect(feb.end).toEqual(day('2026-03-30'));
  });

  it('start day 31, leap February starts on the 29th', () => {
    const jan = budgetMonthContainingDate(day('2028-02-28'), 31);
    expect(jan.start).toEqual(day('2028-01-31'));
    expect(jan.end).toEqual(day('2028-02-28'));
    const feb = budgetMonthContainingDate(day('2028-02-29'), 31);
    expect(feb.start).toEqual(day('2028-02-29'));
    expect(feb.end).toEqual(day('2028-03-30'));
  });

  it('start day 31 across the year boundary', () => {
    const dec = budgetMonthContainingDate(day('2027-01-30'), 31);
    expect(dec.start).toEqual(day('2026-12-31'));
    expect(dec.end).toEqual(day('2027-01-30'));
    expect(dec.key).toBe('2026-12');
    const jan = budgetMonthContainingDate(day('2027-01-31'), 31);
    expect(jan.start).toEqual(day('2027-01-31'));
    expect(jan.key).toBe('2027-01');
  });

  it('start day 30: non-leap February starts on the 28th, March on the 30th', () => {
    const feb = budgetMonthContainingDate(day('2026-03-01'), 30);
    expect(feb.start).toEqual(day('2026-02-28'));
    expect(feb.end).toEqual(day('2026-03-29'));
    expect(budgetMonthContainingDate(day('2026-02-27'), 30).start).toEqual(day('2026-01-30'));
  });

  it('start day 29: leap February starts on the 29th, non-leap on the 28th', () => {
    expect(budgetMonthContainingDate(day('2028-02-29'), 29)).toMatchObject({
      start: day('2028-02-29'),
      end: day('2028-03-28'),
    });
    expect(budgetMonthContainingDate(day('2028-02-28'), 29)).toMatchObject({
      start: day('2028-01-29'),
      end: day('2028-02-28'),
    });
    expect(budgetMonthContainingDate(day('2026-02-28'), 29)).toMatchObject({
      start: day('2026-02-28'),
      end: day('2026-03-28'),
    });
    expect(budgetMonthContainingDate(day('2026-02-27'), 29)).toMatchObject({
      start: day('2026-01-29'),
      end: day('2026-02-27'),
    });
  });
});
