import { describe, expect, it } from 'vitest';
import { splitLargestRemainder } from '../money.js';
import { part } from '../../../test/builders.js';

// envelope-rules, Rounding: "Splitting an amount in parts ... uses largest remainder. Ties go to
// the lower sort_order, then the lower id."
describe('largest-remainder split', () => {
  it('splits proportionally to the weights and sums exactly to the total', () => {
    const result = splitLargestRemainder(1000, [part('a', 1), part('b', 1), part('c', 1)]);
    expect(result).toEqual([
      { id: 'a', cents: 334 },
      { id: 'b', cents: 333 },
      { id: 'c', cents: 333 },
    ]);
  });

  it('gives the extra cents to the largest remainders first', () => {
    // exact shares: 1.4, 2.8, 5.8 -> floors 1, 2, 5 (sum 8); 2 extra cents to b (0.8) and c (0.8)
    const result = splitLargestRemainder(10, [part('a', 14), part('b', 28), part('c', 58)]);
    expect(result).toEqual([
      { id: 'a', cents: 1 },
      { id: 'b', cents: 3 },
      { id: 'c', cents: 6 },
    ]);
  });

  it('breaks remainder ties by the lower sortOrder before the id', () => {
    const result = splitLargestRemainder(1, [part('a', 1, 2), part('b', 1, 1)]);
    expect(result).toEqual([
      { id: 'a', cents: 0 },
      { id: 'b', cents: 1 },
    ]);
  });

  it('breaks remainder ties with equal sortOrder by the lower id', () => {
    const result = splitLargestRemainder(1, [part('z', 1, 5), part('m', 1, 5)]);
    expect(result).toEqual([
      { id: 'z', cents: 0 },
      { id: 'm', cents: 1 },
    ]);
  });

  it('compares numeric ids numerically, not as text', () => {
    const result = splitLargestRemainder(1, [
      { id: 10, weight: 1, sortOrder: 0 },
      { id: 9, weight: 1, sortOrder: 0 },
    ]);
    expect(result).toEqual([
      { id: 10, cents: 0 },
      { id: 9, cents: 1 },
    ]);
  });

  it('returns the parts in input order', () => {
    const result = splitLargestRemainder(300, [part('c', 1), part('a', 1), part('b', 1)]);
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('splits a total of 0 into zeros', () => {
    expect(splitLargestRemainder(0, [part('a', 3), part('b', 7)])).toEqual([
      { id: 'a', cents: 0 },
      { id: 'b', cents: 0 },
    ]);
  });

  it('gives the whole total to a single part', () => {
    expect(splitLargestRemainder(12_345, [part('a', 7)])).toEqual([{ id: 'a', cents: 12_345 }]);
  });

  it('gives 0 to a part with weight 0 among others, even when it would win the tie-break', () => {
    const result = splitLargestRemainder(1, [part('a', 0, 0), part('b', 1, 1), part('c', 1, 2)]);
    expect(result).toEqual([
      { id: 'a', cents: 0 },
      { id: 'b', cents: 1 },
      { id: 'c', cents: 0 },
    ]);
  });

  it('stays exact for totals near Number.MAX_SAFE_INTEGER (products beyond 2^53)', () => {
    const total = Number.MAX_SAFE_INTEGER; // 9007199254740991 = 3 * 3002399751580330 + 1
    const result = splitLargestRemainder(total, [part('a', 1), part('b', 1), part('c', 1)]);
    expect(result).toEqual([
      { id: 'a', cents: 3_002_399_751_580_331 },
      { id: 'b', cents: 3_002_399_751_580_330 },
      { id: 'c', cents: 3_002_399_751_580_330 },
    ]);
  });

  it('stays exact with large weights and a large total', () => {
    const total = Number.MAX_SAFE_INTEGER - 1; // 9007199254740990
    const w = 1_000_000_007;
    const result = splitLargestRemainder(total, [part('a', w), part('b', 2 * w)]);
    // exact shares: total/3 = 3002399751580330 and 2*total/3 = 6004799503160660
    expect(result).toEqual([
      { id: 'a', cents: 3_002_399_751_580_330 },
      { id: 'b', cents: 6_004_799_503_160_660 },
    ]);
  });

  describe('rejects', () => {
    it('a split where every weight is 0 (nothing to be proportional to)', () => {
      expect(() => splitLargestRemainder(100, [part('a', 0), part('b', 0)])).toThrow(RangeError);
    });

    it('an empty list of parts', () => {
      expect(() => splitLargestRemainder(100, [])).toThrow(RangeError);
    });

    it('a negative total', () => {
      expect(() => splitLargestRemainder(-1, [part('a', 1)])).toThrow(RangeError);
    });

    it('a non-integer total', () => {
      expect(() => splitLargestRemainder(1.5, [part('a', 1)])).toThrow(RangeError);
    });

    it('a negative or fractional weight', () => {
      expect(() => splitLargestRemainder(100, [part('a', -1), part('b', 2)])).toThrow(RangeError);
      expect(() => splitLargestRemainder(100, [part('a', 0.5), part('b', 2)])).toThrow(RangeError);
    });

    it('a sortOrder that is not a safe integer (it would corrupt the tie-break)', () => {
      expect(() => splitLargestRemainder(1, [part('a', 1, Number.NaN), part('b', 1)])).toThrow(
        RangeError,
      );
    });

    it('duplicate ids', () => {
      expect(() => splitLargestRemainder(100, [part('a', 1), part('a', 1)])).toThrow(RangeError);
    });
  });
});
