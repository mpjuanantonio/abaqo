import { describe, expect, it } from 'vitest';
import { assertCents, assertNonNegativeCents } from '../money.js';

// CLAUDE.md rule 1 / envelope-rules: "All amounts are integer cents."
describe('amounts are integer cents', () => {
  it('accepts safe integers, including negative ones and zero', () => {
    expect(assertCents(0)).toBe(0);
    expect(assertCents(-3000)).toBe(-3000);
    expect(assertCents(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(assertCents(Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
  });

  it.each([
    ['a fraction of a cent', 10.5],
    ['a float from euro arithmetic', 0.1 + 0.2],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s with a RangeError', (_label, value) => {
    expect(() => assertCents(value)).toThrow(RangeError);
  });

  it('names the offending value in the error message', () => {
    expect(() => assertCents(10.5, 'totalCents')).toThrow(/totalCents.*10\.5/);
  });

  it('rejects negative amounts where only non-negative ones are allowed', () => {
    expect(assertNonNegativeCents(0)).toBe(0);
    expect(assertNonNegativeCents(12_345)).toBe(12_345);
    expect(() => assertNonNegativeCents(-1)).toThrow(RangeError);
    expect(() => assertNonNegativeCents(1.5)).toThrow(RangeError);
  });
});
