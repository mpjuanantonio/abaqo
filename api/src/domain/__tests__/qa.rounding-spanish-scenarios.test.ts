import { describe, expect, it } from 'vitest';
import { resolvePercentages, roundHalfUpDivide, splitEqually } from '../money.js';

// Every cent figure below was worked out by hand from the envelope-rules skill, "Rounding".

describe('skill examples, reproduced exactly', () => {
  it('budget 1.00 at 60 % and 39.99 % gives 0.60 and 0.39', () => {
    const r = resolvePercentages(100, [
      { id: 'a', sortOrder: 0, percentBp: 6000 },
      { id: 'b', sortOrder: 1, percentBp: 3999 },
    ]);
    expect(r.map((x) => x.cents)).toEqual([60, 39]);
  });

  it('0.05 among 3 gives 0.02, 0.02, 0.01', () => {
    expect(splitEqually(5, 3)).toEqual([2, 2, 1]);
  });

  it('400.00 over 6 gives four of 66.67 then two of 66.66', () => {
    expect(splitEqually(40000, 6)).toEqual([6667, 6667, 6667, 6667, 6666, 6666]);
  });

  it('mean -500.5 cents gives -500 and 500.5 gives 501', () => {
    expect(roundHalfUpDivide(-1001, 2)).toBe(-500);
    expect(roundHalfUpDivide(1001, 2)).toBe(501);
  });

  it('financing example: 400 over 4 months is 100 each', () => {
    expect(splitEqually(40000, 4)).toEqual([10000, 10000, 10000, 10000]);
  });
});

describe('realistic Spanish budget scenarios', () => {
  it('salary 1,847.33 split 50/30/20 gives 923.66 / 554.20 / 369.47', () => {
    // exact: 92366.5, 55419.9, 36946.6 -> floors 92366, 55419, 36946 (sum 184731), 2 left to .9 and .6
    const r = resolvePercentages(184733, [
      { id: 'needs', sortOrder: 0, percentBp: 5000 },
      { id: 'wants', sortOrder: 1, percentBp: 3000 },
      { id: 'savings', sortOrder: 2, percentBp: 2000 },
    ]);
    expect(r.map((x) => x.cents)).toEqual([92366, 55420, 36947]);
  });

  it('salary 1,847.33 at 33.33 % x 3 distributes floor(184714.52) = 184714, extra cent to the first', () => {
    const envs = ['a', 'b', 'c'].map((id, i) => ({ id, sortOrder: i, percentBp: 3333 }));
    expect(resolvePercentages(184733, envs).map((x) => x.cents)).toEqual([61572, 61571, 61571]);
  });

  it('33.33 % x 3: the extra cent follows sortOrder, not input position', () => {
    const envs = [
      { id: 'a', sortOrder: 2, percentBp: 3333 },
      { id: 'b', sortOrder: 0, percentBp: 3333 },
      { id: 'c', sortOrder: 1, percentBp: 3333 },
    ];
    expect(resolvePercentages(184733, envs).map((x) => x.cents)).toEqual([61571, 61572, 61571]);
  });

  it('twelve instalments of 1,000.00 total: four of 83.34 then eight of 83.33', () => {
    const r = splitEqually(10000, 12);
    expect(r).toEqual([...Array(4).fill(834), ...Array(8).fill(833)]);
  });

  it('twelve instalments of a 1,000.00 principal paid monthly (100000 cents)', () => {
    const r = splitEqually(100000, 12);
    expect(r).toEqual([...Array(4).fill(8334), ...Array(8).fill(8333)]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100000);
  });

  it('80.00 dinner among 4 is 20.00 each', () => {
    expect(splitEqually(8000, 4)).toEqual([2000, 2000, 2000, 2000]);
  });

  it('100.00 dinner among 3: the user (first) pays 33.34', () => {
    expect(splitEqually(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it('100.00 dinner among 7: four of 14.29 then three of 14.28', () => {
    expect(splitEqually(10000, 7)).toEqual([1429, 1429, 1429, 1429, 1428, 1428, 1428]);
  });

  it('a split with hundreds of parts: 1,000.00 over 333 gives 100 parts of 3.01 and 233 of 3.00', () => {
    const r = splitEqually(100000, 333);
    expect(r).toHaveLength(333);
    expect(r.slice(0, 100).every((c) => c === 301)).toBe(true);
    expect(r.slice(100).every((c) => c === 300)).toBe(true);
  });

  it('700 parts sum exactly and differ by at most one cent', () => {
    const r = splitEqually(123456789, 700);
    expect(r.reduce((a, b) => a + b, 0)).toBe(123456789);
    expect(Math.max(...r) - Math.min(...r)).toBeLessThanOrEqual(1);
  });

  it('a mean of three months of spend, 412.35 + 398.10 + 405.00, rounds half up', () => {
    // 41235 + 39810 + 40500 = 121545; / 3 = 40515 exactly
    expect(roundHalfUpDivide(121545, 3)).toBe(40515);
    // 41235 + 39810 + 40501 = 121546 / 3 = 40515.33 -> 40515; 121547 / 3 = 40515.67 -> 40516
    expect(roundHalfUpDivide(121546, 3)).toBe(40515);
    expect(roundHalfUpDivide(121547, 3)).toBe(40516);
  });
});

describe('roundHalfUpDivide at exact halves', () => {
  it.each([
    [1, 2, 1],
    [-1, 2, 0],
    [3, 2, 2],
    [-3, 2, -1],
    [5, 10, 1],
    [-5, 10, 0],
    [15, 10, 2],
    [-15, 10, -1],
    [-25, 10, -2],
    [1, 4, 0],
    [2, 4, 1],
    [-2, 4, 0],
    [-6, 4, -1],
    [0, 7, 0],
    [7, 1, 7],
    [-7, 1, -7],
  ])('%i / %i = %i', (n, d, expected) => {
    expect(roundHalfUpDivide(n, d)).toBe(expected);
  });

  it('never returns -0', () => {
    expect(Object.is(roundHalfUpDivide(-1, 2), 0)).toBe(true);
    expect(Object.is(roundHalfUpDivide(-1, 3), 0)).toBe(true);
    expect(Object.is(roundHalfUpDivide(-0, 3), 0)).toBe(true);
  });

  it('exact halves at large values, both signs', () => {
    const big = 2 ** 52 + 1; // odd
    expect(roundHalfUpDivide(big, 2)).toBe((big + 1) / 2);
    expect(roundHalfUpDivide(-big, 2)).toBe((-big + 1) / 2);
    expect(roundHalfUpDivide(Number.MAX_SAFE_INTEGER, 2)).toBe(2 ** 52);
    expect(roundHalfUpDivide(-Number.MAX_SAFE_INTEGER, 2)).toBe(-(2 ** 52) + 1);
  });

  it('large divisor', () => {
    expect(roundHalfUpDivide(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(1);
    expect(roundHalfUpDivide(1, Number.MAX_SAFE_INTEGER)).toBe(0);
    expect(roundHalfUpDivide(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER)).toBe(1);
  });
});
