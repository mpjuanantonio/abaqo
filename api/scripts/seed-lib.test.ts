import { describe, expect, it } from 'vitest';
import {
  centsToDecimal,
  checkDevUser,
  checkTargetUrl,
  madridToday,
  openingBalanceDate,
  parseSeedToday,
  resolveDate,
} from './seed-lib.js';

describe('centsToDecimal', () => {
  it('formats integer cents as a decimal string', () => {
    expect(centsToDecimal(0)).toBe('0.00');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(100)).toBe('1.00');
    expect(centsToDecimal(Number.MAX_SAFE_INTEGER)).toBe('90071992547409.91');
    expect(centsToDecimal(1399)).toBe('13.99');
    expect(centsToDecimal(245000)).toBe('2450.00');
  });
  it('rejects floats and negatives', () => {
    expect(() => centsToDecimal(10.5)).toThrow();
    expect(() => centsToDecimal(-1)).toThrow();
    expect(() => centsToDecimal(Number.NaN)).toThrow();
    expect(() => centsToDecimal(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => centsToDecimal(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});

describe('resolveDate', () => {
  it('uses the previous month for offset -1, across a year boundary', () => {
    expect(resolveDate('2026-01-20', -1, 5)).toBe('2025-12-05');
  });
  it('clamps to month length', () => {
    expect(resolveDate('2026-03-31', -1, 31)).toBe('2026-02-28');
  });
  it('clamps 31 to a 30-day month and handles leap years', () => {
    expect(resolveDate('2026-05-15', -1, 31)).toBe('2026-04-30');
    expect(resolveDate('2028-03-10', -1, 30)).toBe('2028-02-29');
  });
  it('never goes past today in the current month', () => {
    expect(resolveDate('2026-11-03', 0, 20)).toBe('2026-11-03');
    expect(resolveDate('2026-11-25', 0, 20)).toBe('2026-11-20');
  });
});

describe('openingBalanceDate', () => {
  it('is the day before the previous month starts', () => {
    expect(openingBalanceDate('2026-11-14')).toBe('2026-09-30');
  });
});

describe('madridToday', () => {
  it('uses the Europe/Madrid calendar date, not UTC', () => {
    expect(madridToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('checkTargetUrl', () => {
  it('accepts loopback hosts', () => {
    for (const u of ['http://127.0.0.1:18080', 'http://localhost:18080/', 'http://[::1]:18080'])
      expect(checkTargetUrl(u)).toBeNull();
  });
  it('rejects everything else, including look-alikes', () => {
    for (const u of [
      'https://firefly.example.com',
      'http://192.168.1.10:8080',
      'http://127.0.0.1.evil.com',
      'http://localhost.evil.com',
      'http://100.64.0.1',
      'not a url',
    ])
      expect(checkTargetUrl(u)).not.toBeNull();
  });
});

describe('checkDevUser', () => {
  it('only accepts the dev email', () => {
    expect(checkDevUser('dev@abaqo.invalid')).toBeNull();
    expect(checkDevUser('someone@example.com')).not.toBeNull();
    expect(checkDevUser(undefined)).not.toBeNull();
  });
});

describe('parseSeedToday', () => {
  it('accepts real dates only', () => {
    expect(parseSeedToday('2026-11-14')).toBe('2026-11-14');
    expect(() => parseSeedToday('2026-13-01')).toThrow();
    expect(() => parseSeedToday('2026-02-30')).toThrow();
    expect(() => parseSeedToday('14/11/2026')).toThrow();
  });
});
