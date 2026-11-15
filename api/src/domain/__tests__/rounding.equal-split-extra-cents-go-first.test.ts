import { describe, expect, it } from 'vitest';
import { splitEqually } from '../money.js';
import { eur } from '../../../test/builders.js';

// envelope-rules, Rounding: "for installments, [ties go] to the earlier one".
// envelope-rules, Shared expenses: "equal split, largest-remainder with the user's share taking
// the extra cents". splitEqually gives the extra cents to the lowest indices first, so callers
// put the earliest instalment (or the user's share) at index 0.
describe('equal split: extra cents go to the first positions', () => {
  it('instalments: 400.00 over 6 months is four of 66.67 then two of 66.66', () => {
    expect(splitEqually(eur(400), 6)).toEqual([
      eur(66.67),
      eur(66.67),
      eur(66.67),
      eur(66.67),
      eur(66.66),
      eur(66.66),
    ]);
  });

  it('instalments: 400.00 over 4 months is four of 100.00', () => {
    expect(splitEqually(eur(400), 4)).toEqual([10_000, 10_000, 10_000, 10_000]);
  });

  it("shared expense: 10.00 among 3 with the user first gives the user's share the extra cent", () => {
    const [user, ...others] = splitEqually(eur(10), 3);
    expect(user).toBe(334);
    expect(others).toEqual([333, 333]);
  });

  it('splits 0 into zeros and a single part into the whole amount', () => {
    expect(splitEqually(0, 3)).toEqual([0, 0, 0]);
    expect(splitEqually(777, 1)).toEqual([777]);
  });

  it('rejects a count that is not a positive integer', () => {
    expect(() => splitEqually(100, 0)).toThrow(RangeError);
    expect(() => splitEqually(100, 2.5)).toThrow(RangeError);
  });

  it('rejects a negative total', () => {
    expect(() => splitEqually(-100, 2)).toThrow(RangeError);
  });
});
