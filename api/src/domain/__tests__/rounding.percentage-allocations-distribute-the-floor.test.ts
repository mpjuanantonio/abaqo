import { describe, expect, it } from 'vitest';
import { resolvePercentages } from '../money.js';
import { pctEnvelope } from '../../../test/builders.js';

// envelope-rules, Rounding: "Percentage allocations: the total to distribute is
// floor(budget x sum of bp / 10000)", split by largest remainder (ties: lower sort_order, then
// lower id). Allocation: "Percentages apply to the base budget only".
describe('percentage allocations distribute floor(budget x sum of bp / 10000)', () => {
  it('drops the fraction of a cent of the total', () => {
    // exact shares 250.25 + 250.25 = 500.5 -> total 500
    const result = resolvePercentages(1001, [pctEnvelope('a', 2500), pctEnvelope('b', 2500)]);
    expect(result).toEqual([
      { id: 'a', cents: 250 },
      { id: 'b', cents: 250 },
    ]);
  });

  it('gives the cents left over by the floors to the lower sortOrder on equal remainders', () => {
    // exact shares 300.9 x 3 = 902.7 -> total 902; floors 900; 2 extra cents
    const result = resolvePercentages(1003, [
      pctEnvelope('c', 3000, 3),
      pctEnvelope('a', 3000, 1),
      pctEnvelope('b', 3000, 2),
    ]);
    expect(result).toEqual([
      { id: 'c', cents: 300 },
      { id: 'a', cents: 301 },
      { id: 'b', cents: 301 },
    ]);
  });

  it('gives the extra cent to the largest remainder of the exact share of the budget', () => {
    // budget 1.00: 60 % is exactly 60 cents, 39.99 % is 39.99 cents -> total 99.
    // Remainders of budget x bp / 10000 are 0 and 0.99, so the 60 % envelope keeps exactly 60.
    const result = resolvePercentages(100, [pctEnvelope('a', 6000), pctEnvelope('b', 3999)]);
    expect(result).toEqual([
      { id: 'a', cents: 60 },
      { id: 'b', cents: 39 },
    ]);
  });

  it('allocates the whole budget when the percentages sum to 100 %', () => {
    const result = resolvePercentages(200_000, [pctEnvelope('a', 7000), pctEnvelope('b', 3000)]);
    expect(result).toEqual([
      { id: 'a', cents: 140_000 },
      { id: 'b', cents: 60_000 },
    ]);
  });

  it('gives 0 to a 0 bp envelope and accepts an all-zero or empty list', () => {
    expect(resolvePercentages(1001, [pctEnvelope('a', 0), pctEnvelope('b', 5000)])).toEqual([
      { id: 'a', cents: 0 },
      { id: 'b', cents: 500 },
    ]);
    expect(resolvePercentages(1001, [pctEnvelope('a', 0)])).toEqual([{ id: 'a', cents: 0 }]);
    expect(resolvePercentages(1001, [])).toEqual([]);
  });

  it('stays exact for a budget near Number.MAX_SAFE_INTEGER', () => {
    const budget = Number.MAX_SAFE_INTEGER;
    const result = resolvePercentages(budget, [pctEnvelope('a', 10_000)]);
    expect(result).toEqual([{ id: 'a', cents: budget }]);
  });

  describe('rejects', () => {
    it.each([
      ['a fractional bp', 12.5],
      ['a negative bp', -1],
      ['a bp above 10000', 10_001],
    ])('%s', (_label, bp) => {
      expect(() => resolvePercentages(1000, [pctEnvelope('a', bp)])).toThrow(RangeError);
    });

    it('percentages that sum to more than 100 %', () => {
      expect(() =>
        resolvePercentages(1000, [pctEnvelope('a', 6000), pctEnvelope('b', 4001)]),
      ).toThrow(/10001/);
    });

    it('a negative or fractional budget', () => {
      expect(() => resolvePercentages(-1, [pctEnvelope('a', 100)])).toThrow(RangeError);
      expect(() => resolvePercentages(10.5, [pctEnvelope('a', 100)])).toThrow(RangeError);
    });

    it('duplicate envelope ids', () => {
      expect(() =>
        resolvePercentages(1000, [pctEnvelope('a', 100), pctEnvelope('a', 100)]),
      ).toThrow(RangeError);
    });
  });
});
