/**
 * Test builders for domain tests. Amounts are integer cents. Keep it tiny: add builders only when
 * a test needs them.
 */
import type { SplitPart } from '../src/domain/money.js';
import type { CalendarDate } from '../src/domain/budget-month.js';

/** A weighted part for a split. `sortOrder` defaults to 0 so ties fall back to the id. */
export function part(id: string, weight: number, sortOrder = 0): SplitPart {
  return { id, weight, sortOrder };
}

/** A percentage envelope for `resolvePercentages`. */
export function pctEnvelope(
  id: string,
  percentBp: number,
  sortOrder = 0,
): { id: string; percentBp: number; sortOrder: number } {
  return { id, percentBp, sortOrder };
}

/** A Madrid calendar date from `YYYY-MM-DD` (test convenience; no validation beyond the format). */
export function day(iso: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`bad test date ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Euros to cents for readable test data: `eur(66.67)` -> 6667. Only for literals in tests. */
export function eur(amount: number): number {
  return Math.round(amount * 100);
}
