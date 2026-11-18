import { describe, expect, it } from 'vitest';
import { roundHalfUpDivide } from '../money.js';

// envelope-rules, Rounding: "Means of money (floor in months mode, promotion and chained-loan
// suggestions) divide with round-half-up to the cent."
// For negative numerators (a mean net spend can be negative after refunds) the skill does not say
// which "half up" applies; this implements the mathematical one, ties toward +infinity.
describe('means of money round half up to the cent', () => {
  it('returns exact quotients unchanged', () => {
    expect(roundHalfUpDivide(900, 3)).toBe(300);
  });

  it('rounds below half down and above half up', () => {
    expect(roundHalfUpDivide(1000, 3)).toBe(333); // 333.33
    expect(roundHalfUpDivide(2000, 3)).toBe(667); // 666.67
  });

  it('rounds an exact half up', () => {
    expect(roundHalfUpDivide(1001, 2)).toBe(501); // 500.5
    expect(roundHalfUpDivide(5, 2)).toBe(3);
  });

  it('rounds negative numerators to the nearest cent, exact halves toward +infinity', () => {
    expect(roundHalfUpDivide(-1000, 3)).toBe(-333); // -333.33
    expect(roundHalfUpDivide(-2000, 3)).toBe(-667); // -666.67
    expect(roundHalfUpDivide(-1001, 2)).toBe(-500); // -500.5
    expect(roundHalfUpDivide(-1, 2)).toBe(0); // -0.5 -> 0, and never -0
    expect(Object.is(roundHalfUpDivide(-1, 2), 0)).toBe(true);
  });

  it('stays exact when twice the numerator exceeds 2^53', () => {
    expect(roundHalfUpDivide(Number.MAX_SAFE_INTEGER, 2)).toBe(4_503_599_627_370_496); // .5 up
    expect(roundHalfUpDivide(Number.MIN_SAFE_INTEGER, 2)).toBe(-4_503_599_627_370_495); // .5 up
  });

  it('rejects a divisor that is not a positive integer', () => {
    expect(() => roundHalfUpDivide(100, 0)).toThrow(RangeError);
    expect(() => roundHalfUpDivide(100, -3)).toThrow(RangeError);
    expect(() => roundHalfUpDivide(100, 1.5)).toThrow(RangeError);
  });

  it('rejects a numerator that is not integer cents', () => {
    expect(() => roundHalfUpDivide(100.5, 2)).toThrow(RangeError);
  });
});
