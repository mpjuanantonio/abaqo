import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

const NBSP = '\u00a0';

describe('formatMoney', () => {
  it('formats positive cents with thousands separator for 4-digit amounts', () => {
    expect(formatMoney(123456)).toBe(`1.234,56${NBSP}€`);
  });
  it('formats small amounts', () => {
    expect(formatMoney(5)).toBe(`0,05${NBSP}€`);
  });
  it('formats zero', () => {
    expect(formatMoney(0)).toBe(`0,00${NBSP}€`);
  });
  it('uses a real minus sign for negatives', () => {
    expect(formatMoney(-123456)).toBe(`−1.234,56${NBSP}€`);
  });
  it('supports other locales', () => {
    expect(formatMoney(123456, 'en-GB')).toBe('€1,234.56');
  });
  it('never shows a minus sign for negative zero', () => {
    expect(formatMoney(-0)).toBe(`0,00${NBSP}€`);
  });
  it('reads as 1.234,56 € whatever space character the locale data uses', () => {
    expect(formatMoney(123456).replace(/\s/gu, ' ')).toBe('1.234,56 €');
  });
  it('rejects integers that are not safe', () => {
    expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
  it('rejects non-integer input', () => {
    expect(() => formatMoney(10.5)).toThrow(RangeError);
    expect(() => formatMoney(Number.NaN)).toThrow(RangeError);
  });
});
