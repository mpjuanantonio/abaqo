import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { resolvePercentages, splitEqually, splitLargestRemainder } from '../money.js';

const total = fc.oneof(
  fc.integer({ min: 0, max: 1_000_000 }),
  fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
);

const weightedParts = fc
  .array(
    fc.record({
      weight: fc.oneof(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 2 ** 40 })),
      sortOrder: fc.integer({ min: -5, max: 5 }),
    }),
    { minLength: 1, maxLength: 12 },
  )
  .filter((ps) => ps.some((p) => p.weight > 0))
  .map((ps) => ps.map((p, i) => ({ id: `e${i}`, ...p })));

/** |cents - exact share| < 1 cent, with the exact share `numerator / denominator`. */
function withinOneCent(cents: number, numerator: bigint, denominator: bigint): boolean {
  const diff = BigInt(cents) * denominator - numerator;
  return (diff < 0n ? -diff : diff) < denominator;
}

describe('rounding invariants (property tests)', () => {
  it('a largest-remainder split sums exactly to the total, each part within 1 cent', () => {
    fc.assert(
      fc.property(total, weightedParts, (t, parts) => {
        const result = splitLargestRemainder(t, parts);
        const weightSum = parts.reduce((s, p) => s + BigInt(p.weight), 0n);
        expect(result.reduce((s, r) => s + BigInt(r.cents), 0n)).toBe(BigInt(t));
        result.forEach((r, i) => {
          const p = parts[i];
          expect(p?.id).toBe(r.id);
          expect(Number.isSafeInteger(r.cents) && r.cents >= 0).toBe(true);
          expect(withinOneCent(r.cents, BigInt(t) * BigInt(p?.weight ?? 0), weightSum)).toBe(true);
          if (p?.weight === 0) expect(r.cents).toBe(0);
        });
      }),
    );
  });

  it('an equal split sums to the total, non-increasing, max - min <= 1', () => {
    fc.assert(
      fc.property(total, fc.integer({ min: 1, max: 50 }), (t, n) => {
        const result = splitEqually(t, n);
        expect(result).toHaveLength(n);
        expect(result.reduce((s, c) => s + BigInt(c), 0n)).toBe(BigInt(t));
        for (let i = 1; i < n; i++) expect(result[i]).toBeLessThanOrEqual(result[i - 1] ?? 0);
        expect(Math.max(...result) - Math.min(...result)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('resolvePercentages sums to floor(budget x sum bp / 10000), each within 1 cent', () => {
    const envelopes = fc
      .array(fc.integer({ min: 0, max: 10_000 }), { minLength: 0, maxLength: 12 })
      .filter((bps) => bps.reduce((s, b) => s + b, 0) <= 10_000)
      .map((bps) => bps.map((percentBp, i) => ({ id: i, sortOrder: i % 3, percentBp })));
    fc.assert(
      fc.property(total, envelopes, (budget, envs) => {
        const result = resolvePercentages(budget, envs);
        const bpSum = envs.reduce((s, e) => s + e.percentBp, 0);
        const expectedTotal = (BigInt(budget) * BigInt(bpSum)) / 10_000n;
        expect(result.reduce((s, r) => s + BigInt(r.cents), 0n)).toBe(expectedTotal);
        result.forEach((r, i) => {
          const bp = envs[i]?.percentBp ?? 0;
          expect(withinOneCent(r.cents, BigInt(budget) * BigInt(bp), 10_000n)).toBe(true);
        });
      }),
    );
  });
});
