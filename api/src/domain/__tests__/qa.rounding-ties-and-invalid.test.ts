import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  assertCents,
  assertNonNegativeCents,
  resolvePercentages,
  roundHalfUpDivide,
  splitEqually,
  splitLargestRemainder,
} from '../money.js';

describe('adversarial ties', () => {
  it('equal remainders, equal sortOrder: lowest id by code unit wins', () => {
    // Ids are strings (UUID v7) compared by code unit: '10' < '100' < '9'.
    const parts = [
      { id: '9', weight: 1, sortOrder: 0 },
      { id: '100', weight: 1, sortOrder: 0 },
      { id: '10', weight: 1, sortOrder: 0 },
    ];
    // 1 cent among 3 equal parts: the extra one goes to id '10'
    const r = splitLargestRemainder(1, parts);
    expect(Object.fromEntries(r.map((x) => [x.id, x.cents]))).toEqual({
      '9': 0,
      '10': 1,
      '100': 0,
    });
  });

  it('equal remainders: sortOrder beats id even when the id is higher', () => {
    const r = splitLargestRemainder(1, [
      { id: 'a', weight: 1, sortOrder: 5 },
      { id: 'z', weight: 1, sortOrder: 1 },
    ]);
    expect(r.map((x) => x.cents)).toEqual([0, 1]);
  });

  it('negative sortOrder sorts before zero', () => {
    const r = splitLargestRemainder(1, [
      { id: 'a', weight: 1, sortOrder: 0 },
      { id: 'b', weight: 1, sortOrder: -3 },
    ]);
    expect(r.map((x) => x.cents)).toEqual([0, 1]);
  });

  it('a larger remainder beats a better sortOrder', () => {
    // 100 cents, weights 1:2 -> 33.33 and 66.67; the extra cent goes to the 66.67 part
    const r = splitLargestRemainder(100, [
      { id: 'a', weight: 1, sortOrder: 0 },
      { id: 'b', weight: 2, sortOrder: 9 },
    ]);
    expect(r.map((x) => x.cents)).toEqual([33, 67]);
  });

  it('percentages: equal remainders and sortOrder tie go to the lower id', () => {
    // 1 cent at 50 % + 50 %: exact shares 0.5 and 0.5, total 1, floors 0: a pure tie
    const r = resolvePercentages(1, [
      { id: 'b', sortOrder: 0, percentBp: 5000 },
      { id: 'a', sortOrder: 0, percentBp: 5000 },
    ]);
    expect(r.map((x) => x.cents)).toEqual([0, 1]);
    // exact 3333.3333, 3333.3333, 3334.3334; total 10001; floors sum 10000 -> 1 left, to the
    // largest remainder (.3334)
    const r2 = resolvePercentages(10001, [
      { id: 'b', sortOrder: 0, percentBp: 3333 },
      { id: 'a', sortOrder: 0, percentBp: 3333 },
      { id: 'c', sortOrder: 0, percentBp: 3334 },
    ]);
    expect(r2.map((x) => x.cents)).toEqual([3333, 3333, 3335]);
  });

  it('the result by id does not depend on input order (distinct sortOrders)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 1000 }),
        (total, weights, seed) => {
          if (weights.every((w) => w === 0)) return;
          const parts = weights.map((w, i) => ({ id: `p${i}`, weight: w, sortOrder: i % 3 }));
          const base = splitLargestRemainder(total, parts);
          const rotated = [
            ...parts.slice(seed % parts.length),
            ...parts.slice(0, seed % parts.length),
          ];
          const other = splitLargestRemainder(total, rotated);
          const toMap = (rs: { id: string; cents: number }[]) =>
            Object.fromEntries(rs.map((x) => [x.id, x.cents]));
          expect(toMap(other)).toEqual(toMap(base));
        },
      ),
    );
  });

  // Ids are UUID v7 strings compared by code unit (plain `<`), so the tie-break is a total order:
  // the winner of an equal tie never depends on the order the caller lists the parts in.
  function permutations<T>(xs: readonly T[]): T[][] {
    if (xs.length <= 1) return [xs.slice()];
    return xs.flatMap((x, i) =>
      permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]),
    );
  }

  it.each([
    ['numeric-looking ids', ['9', '10', '100'], '10'],
    [
      'UUID v7 ids (older row wins)',
      [
        '019a8f2e-7c41-7d3a-9b2e-5f1c0a7d4e21',
        '0190b5c2-1a2b-7c3d-8e4f-0a1b2c3d4e5f',
        '019a8f2e-7c40-7fff-bfff-ffffffffffff',
        '019a8f2e-7c41-7d3a-9b2e-5f1c0a7d4e20',
      ],
      '0190b5c2-1a2b-7c3d-8e4f-0a1b2c3d4e5f',
    ],
  ])('%s: every input order gives the same result per id', (_label, ids, lowest) => {
    // 1 cent among equal parts: a pure tie, so exactly one id (the lowest by code unit) wins.
    const expected = Object.fromEntries(ids.map((id) => [id, id === lowest ? 1 : 0]));
    expect([...ids].sort()[0]).toBe(lowest); // the lowest by code unit
    for (const perm of permutations(ids)) {
      const r = splitLargestRemainder(
        1,
        perm.map((id) => ({ id, weight: 1, sortOrder: 0 })),
      );
      expect(Object.fromEntries(r.map((x) => [x.id, x.cents]))).toEqual(expected);
    }
  });

  it('UUID v7 ids: with n-1 extra cents among n tied parts, only the highest id misses out', () => {
    const ids = [
      '019a8f2e-7c41-7d3a-9b2e-5f1c0a7d4e21',
      '0190b5c2-1a2b-7c3d-8e4f-0a1b2c3d4e5f',
      '019a8f2e-7c41-7d3a-9b2e-5f1c0a7d4e20',
    ];
    // 2 cents among 3 equal parts (each 0.666...): the two lowest ids get 1, the highest 0
    for (const perm of permutations(ids)) {
      const r = splitLargestRemainder(
        2,
        perm.map((id) => ({ id, weight: 1, sortOrder: 0 })),
      );
      expect(Object.fromEntries(r.map((x) => [x.id, x.cents]))).toEqual({
        '0190b5c2-1a2b-7c3d-8e4f-0a1b2c3d4e5f': 1,
        '019a8f2e-7c41-7d3a-9b2e-5f1c0a7d4e20': 1,
        '019a8f2e-7c41-7d3a-9b2e-5f1c0a7d4e21': 0,
      });
    }
  });
});

describe('invalid inputs', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5, 2 ** 53, '5', null, undefined])(
    'assertCents rejects %s',
    (v) => {
      expect(() => assertCents(v as never)).toThrow(RangeError);
    },
  );

  it('assertNonNegativeCents rejects -1 and accepts 0 and -0', () => {
    expect(() => assertNonNegativeCents(-1)).toThrow(RangeError);
    expect(assertNonNegativeCents(0)).toBe(0);
    expect(assertNonNegativeCents(-0)).toBe(-0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 2.5, '3'])(
    'splitEqually rejects count %s',
    (c) => {
      expect(() => splitEqually(100, c as never)).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, '100'])(
    'splitEqually rejects total %s',
    (t) => {
      expect(() => splitEqually(t as never, 3)).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0.5, '1'])('split rejects weight %s', (w) => {
    expect(() =>
      splitLargestRemainder(100, [{ id: 'a', weight: w as never, sortOrder: 0 }]),
    ).toThrow(RangeError);
  });

  it.each([Number.NaN, 1.5, Number.POSITIVE_INFINITY])('split rejects sortOrder %s', (s) => {
    expect(() => splitLargestRemainder(1, [{ id: 'a', weight: 1, sortOrder: s }])).toThrow(
      RangeError,
    );
  });

  it.each([Number.NaN, 0.5, -1, 10001, Number.POSITIVE_INFINITY, '5000'])(
    'resolvePercentages rejects bp %s',
    (bp) => {
      expect(() =>
        resolvePercentages(1000, [{ id: 'a', sortOrder: 0, percentBp: bp as never }]),
      ).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -100, 12.5])(
    'resolvePercentages rejects budget %s',
    (b) => {
      expect(() => resolvePercentages(b, [{ id: 'a', sortOrder: 0, percentBp: 100 }])).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2'])(
    'roundHalfUpDivide rejects divisor %s',
    (d) => {
      expect(() => roundHalfUpDivide(10, d as never)).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0.5, 2 ** 53])(
    'roundHalfUpDivide rejects numerator %s',
    (n) => {
      expect(() => roundHalfUpDivide(n, 2)).toThrow(RangeError);
    },
  );

  it('percentages exactly 100 % are accepted and 100.01 % rejected', () => {
    const ok = resolvePercentages(100000, [
      { id: 'a', sortOrder: 0, percentBp: 6000 },
      { id: 'b', sortOrder: 1, percentBp: 4000 },
    ]);
    expect(ok.map((x) => x.cents)).toEqual([60000, 40000]);
    expect(() =>
      resolvePercentages(100000, [
        { id: 'a', sortOrder: 0, percentBp: 6000 },
        { id: 'b', sortOrder: 1, percentBp: 4001 },
      ]),
    ).toThrow(RangeError);
  });

  it('percentage results are never negative zero and never negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.array(fc.integer({ min: 0, max: 2000 }), { minLength: 1, maxLength: 5 }),
        (budget, bps) => {
          const r = resolvePercentages(
            budget,
            bps.map((b, i) => ({ id: `e${i}`, sortOrder: i, percentBp: b })),
          );
          for (const x of r) {
            expect(x.cents).toBeGreaterThanOrEqual(0);
            expect(Object.is(x.cents, -0)).toBe(false);
          }
        },
      ),
    );
  });

  it('each percentage result is the floor or ceiling of its exact share (hand-checked oracle)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.array(fc.integer({ min: 0, max: 2500 }), { minLength: 1, maxLength: 4 }),
        (budget, bps) => {
          const r = resolvePercentages(
            budget,
            bps.map((b, i) => ({ id: `e${i}`, sortOrder: i, percentBp: b })),
          );
          r.forEach((x, i) => {
            const exact = (budget * (bps[i] as number)) / 10000;
            expect(x.cents).toBeGreaterThanOrEqual(Math.floor(exact));
            expect(x.cents).toBeLessThanOrEqual(Math.ceil(exact));
          });
        },
      ),
    );
  });
});
