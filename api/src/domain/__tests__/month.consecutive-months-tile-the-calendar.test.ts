import { describe, expect, it } from 'vitest';
import {
  budgetMonthContainingDate,
  nextBudgetMonth,
  previousBudgetMonth,
} from '../budget-month.js';
import { day } from '../../../test/builders.js';

// envelope-rules, Month: a month "ends the day before the next start", so consecutive budget
// months follow each other without gap or overlap.
describe('consecutive budget months', () => {
  it('next month starts the day after this one ends', () => {
    const jan = budgetMonthContainingDate(day('2026-01-31'), 31);
    const feb = nextBudgetMonth(jan);
    expect(feb).toEqual({
      startDay: 31,
      start: day('2026-02-28'),
      end: day('2026-03-30'),
      key: '2026-02',
    });
    expect(nextBudgetMonth(feb).start).toEqual(day('2026-03-31'));
  });

  it('previous month ends the day before this one starts', () => {
    const jan = budgetMonthContainingDate(day('2027-01-20'), 1);
    expect(previousBudgetMonth(jan)).toEqual({
      startDay: 1,
      start: day('2026-12-01'),
      end: day('2026-12-31'),
      key: '2026-12',
    });
  });

  it.each([1, 15, 28, 29, 30, 31])(
    'next(previous(m)) and previous(next(m)) are m (start %i)',
    (sd) => {
      for (const iso of ['2026-01-15', '2026-03-01', '2028-02-29', '2026-12-31']) {
        const m = budgetMonthContainingDate(day(iso), sd);
        expect(nextBudgetMonth(previousBudgetMonth(m))).toEqual(m);
        expect(previousBudgetMonth(nextBudgetMonth(m))).toEqual(m);
      }
    },
  );
});
