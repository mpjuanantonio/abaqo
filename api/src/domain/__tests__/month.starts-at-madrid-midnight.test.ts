import { describe, expect, it } from 'vitest';
import {
  budgetMonthContaining,
  budgetMonthContainingDate,
  budgetMonthStartInstant,
  madridCalendarDate,
  nextBudgetMonth,
} from '../budget-month.js';
import { day } from '../../../test/builders.js';

// envelope-rules, Month: a budget month starts "at 00:00 Europe/Madrid". CLAUDE.md: "store UTC,
// compute months in Europe/Madrid". Madrid is UTC+1 in winter (CET) and UTC+2 in summer (CEST);
// in 2026 summer time starts on Sunday 29 March and ends on Sunday 25 October.
const at = (iso: string) => new Date(iso);

describe('a budget month starts at 00:00 Europe/Madrid', () => {
  it('winter: 00:00 Madrid is 23:00Z the previous day', () => {
    const feb = budgetMonthContainingDate(day('2026-02-10'), 1);
    expect(budgetMonthStartInstant(feb).toISOString()).toBe('2026-01-31T23:00:00.000Z');
  });

  it('summer: 00:00 Madrid is 22:00Z the previous day', () => {
    const jul = budgetMonthContainingDate(day('2026-07-10'), 1);
    expect(budgetMonthStartInstant(jul).toISOString()).toBe('2026-06-30T22:00:00.000Z');
  });

  it('winter: an instant just before Madrid midnight belongs to the previous month', () => {
    expect(budgetMonthContaining(at('2026-01-31T22:59:59.999Z'), 1).key).toBe('2026-01');
    expect(budgetMonthContaining(at('2026-01-31T23:00:00.000Z'), 1).key).toBe('2026-02');
  });

  it('summer: an instant just before Madrid midnight belongs to the previous month', () => {
    expect(budgetMonthContaining(at('2026-06-30T21:59:59.999Z'), 1).key).toBe('2026-06');
    expect(budgetMonthContaining(at('2026-06-30T22:00:00.000Z'), 1).key).toBe('2026-07');
  });

  it('a non-default start day uses Madrid midnight on that day too', () => {
    // start day 25: 25 Aug 2026 00:00 CEST = 24 Aug 22:00Z
    expect(budgetMonthContaining(at('2026-08-24T21:59:59.999Z'), 25).start).toEqual(
      day('2026-07-25'),
    );
    expect(budgetMonthContaining(at('2026-08-24T22:00:00.000Z'), 25).start).toEqual(
      day('2026-08-25'),
    );
  });

  it('converts an instant to its Madrid calendar date', () => {
    expect(madridCalendarDate(at('2026-12-31T23:30:00Z'))).toEqual(day('2027-01-01'));
    expect(madridCalendarDate(at('2026-07-15T21:59:59Z'))).toEqual(day('2026-07-15'));
    expect(madridCalendarDate(at('2026-07-15T22:00:00Z'))).toEqual(day('2026-07-16'));
  });

  it('rejects an invalid Date', () => {
    expect(() => budgetMonthContaining(new Date(Number.NaN), 1)).toThrow(RangeError);
  });
});

describe('budget months across the DST change days', () => {
  it('last Sunday of March: a month starting that day starts at 00:00 CET', () => {
    const m = budgetMonthContaining(at('2026-03-29T01:30:00Z'), 29); // 03:30 CEST, after the jump
    expect(m.start).toEqual(day('2026-03-29'));
    expect(m.end).toEqual(day('2026-04-28'));
    expect(budgetMonthStartInstant(m).toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(budgetMonthStartInstant(nextBudgetMonth(m)).toISOString()).toBe(
      '2026-04-28T22:00:00.000Z',
    );
  });

  it('last Sunday of October: a month starting that day starts at 00:00 CEST', () => {
    const m = budgetMonthContaining(at('2026-10-25T01:30:00Z'), 25); // 02:30 CET, after the fall-back
    expect(m.start).toEqual(day('2026-10-25'));
    expect(m.end).toEqual(day('2026-11-24'));
    expect(budgetMonthStartInstant(m).toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(budgetMonthStartInstant(nextBudgetMonth(m)).toISOString()).toBe(
      '2026-11-24T23:00:00.000Z',
    );
  });

  it.each([
    ['2026-03-29T00:59:59Z', 1, '2026-03'], // 01:59:59 CET, just before the jump
    ['2026-03-29T01:00:00Z', 1, '2026-03'], // 03:00 CEST, right after
    ['2026-10-25T00:30:00Z', 1, '2026-10'], // 02:30 CEST, first pass
    ['2026-10-25T01:30:00Z', 1, '2026-10'], // 02:30 CET, second pass
  ])('an instant on a DST change day (%s) is in the month containing that day', (iso, sd, key) => {
    expect(budgetMonthContaining(at(iso), sd).key).toBe(key);
  });

  it.each([
    ['March', '2026-03-15', 1],
    ['October', '2026-10-15', 1],
    ['March, start day 29', '2026-03-29', 29],
    ['October, start day 25', '2026-10-25', 25],
  ])('%s: the month and its neighbours meet exactly at their start instants', (_l, iso, sd) => {
    const m = budgetMonthContainingDate(day(iso), sd);
    const startMs = budgetMonthStartInstant(m).getTime();
    const nextStartMs = budgetMonthStartInstant(nextBudgetMonth(m)).getTime();
    expect(budgetMonthContaining(new Date(startMs - 1), sd).key).not.toBe(m.key);
    expect(budgetMonthContaining(new Date(startMs), sd)).toEqual(m);
    expect(budgetMonthContaining(new Date(nextStartMs - 1), sd)).toEqual(m);
    expect(budgetMonthContaining(new Date(nextStartMs), sd)).toEqual(nextBudgetMonth(m));
  });
});
