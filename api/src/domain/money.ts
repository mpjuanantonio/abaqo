/**
 * Integer-cent money helpers. Pure functions: no I/O, no clock.
 *
 * All amounts are integer cents (`number`, always a safe integer). Intermediate products that can
 * exceed 2^53 are computed with `BigInt`; results are returned as numbers.
 */

/** Returns `value` if it is a safe integer number of cents (negative allowed); throws otherwise. */
export function assertCents(value: number, label = 'amount'): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer number of cents, got ${String(value)}`);
  }
  return value;
}

/** Ids are envelope / participant / instalment identifiers. Numbers compare numerically. */
export type PartId = string | number;

/** One part of a largest-remainder split. */
export interface SplitPart<Id extends PartId = PartId> {
  readonly id: Id;
  /** Non-negative safe integer. Shares are proportional to it. */
  readonly weight: number;
  /** First tie-break for equal remainders: lower wins. Then the lower `id`. */
  readonly sortOrder: number;
}

export interface SplitResult<Id extends PartId = PartId> {
  readonly id: Id;
  readonly cents: number;
}

/**
 * Splits a non-negative total among weighted parts with largest-remainder rounding
 * (envelope-rules, "Rounding"): every part gets the floor of its exact share
 * `total * weight / sum(weights)`, and the cents left over go one each to the largest remainders.
 * Remainder ties go to the lower `sortOrder`, then the lower `id`.
 *
 * Results are returned in input order, sum exactly to `totalCents`, and each is within one cent
 * of its exact share. A part with weight 0 always gets 0.
 *
 * @throws RangeError if the total is not a non-negative safe integer, there are no parts, a
 *   weight is not a non-negative safe integer, every weight is 0, or ids repeat.
 */
export function splitLargestRemainder<Id extends PartId>(
  totalCents: number,
  parts: readonly SplitPart<Id>[],
): SplitResult<Id>[] {
  assertNonNegativeCents(totalCents, 'totalCents');
  if (parts.length === 0) {
    throw new RangeError('cannot split an amount among zero parts');
  }
  assertValidKeys(parts);
  let weightSum = 0n;
  for (const p of parts) {
    if (!Number.isSafeInteger(p.weight) || p.weight < 0) {
      throw new RangeError(
        `weight of part ${String(p.id)} must be a non-negative safe integer, got ${String(p.weight)}`,
      );
    }
    weightSum += BigInt(p.weight);
  }
  if (weightSum === 0n) {
    throw new RangeError('cannot split an amount when every weight is 0');
  }
  const total = BigInt(totalCents);
  return apportion(
    totalCents,
    parts.map((p) => ({ id: p.id, sortOrder: p.sortOrder, numerator: total * BigInt(p.weight) })),
    weightSum,
  );
}

/**
 * Splits a non-negative total into `count` equal parts by largest remainder. The extra cents go
 * to the lowest indices first: put the earliest instalment, or the user's share of a shared
 * expense, at index 0 (envelope-rules, "Rounding" and "Shared expenses").
 * Example: `splitEqually(40000, 6)` -> `[6667, 6667, 6667, 6667, 6666, 6666]`.
 *
 * @throws RangeError if the total is not a non-negative safe integer or `count` is not a
 *   positive safe integer.
 */
export function splitEqually(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer, got ${String(count)}`);
  }
  const parts = Array.from({ length: count }, (_, i) => ({ id: i, weight: 1, sortOrder: i }));
  return splitLargestRemainder(totalCents, parts).map((r) => r.cents);
}

/** 100 % in basis points. */
export const FULL_BP = 10_000;

export interface PercentEnvelope<Id extends PartId = PartId> {
  readonly id: Id;
  readonly sortOrder: number;
  /** Integer basis points, 0..10000 (1 % = 100 bp). */
  readonly percentBp: number;
}

/**
 * Resolves percentage allocations of the base budget (envelope-rules, "Rounding" and
 * "Allocation"). The total distributed is `floor(budget x sum(bp) / 10000)`. Each envelope gets
 * the floor of its exact share `budget x bp / 10000`; the cents left over go one each to the
 * largest remainders of those exact shares, ties to the lower `sortOrder`, then the lower `id`.
 * Every result is therefore the floor or the ceiling of its exact share, and they sum exactly to
 * the total. Results are in input order.
 *
 * Only percentages: fixed amounts, the remainder to savings and budget validation are not here.
 *
 * @throws RangeError if the budget is not a non-negative safe integer, a bp is not an integer in
 *   0..10000, the bp sum exceeds 10000, or ids repeat.
 */
export function resolvePercentages<Id extends PartId>(
  budgetCents: number,
  envelopes: readonly PercentEnvelope<Id>[],
): SplitResult<Id>[] {
  assertNonNegativeCents(budgetCents, 'budgetCents');
  assertValidKeys(envelopes);
  let bpSum = 0;
  for (const e of envelopes) {
    if (!Number.isInteger(e.percentBp) || e.percentBp < 0 || e.percentBp > FULL_BP) {
      throw new RangeError(
        `percentBp of envelope ${String(e.id)} must be an integer in 0..${FULL_BP}, got ${String(e.percentBp)}`,
      );
    }
    bpSum += e.percentBp;
  }
  if (bpSum > FULL_BP) {
    throw new RangeError(`percentages sum to ${bpSum} bp, more than ${FULL_BP} bp (100 %)`);
  }
  const budget = BigInt(budgetCents);
  const denominator = BigInt(FULL_BP);
  const total = Number((budget * BigInt(bpSum)) / denominator);
  return apportion(
    total,
    envelopes.map((e) => ({
      id: e.id,
      sortOrder: e.sortOrder,
      numerator: budget * BigInt(e.percentBp),
    })),
    denominator,
  );
}

/**
 * Divides an amount of cents by a positive integer and rounds to the nearest cent, exact halves
 * toward +infinity (mathematical round-half-up): `floor(numerator / divisor + 1/2)`.
 * Used for means of money (envelope-rules, "Rounding"). Examples: 1001/2 -> 501, -1001/2 -> -500.
 *
 * @throws RangeError if the numerator is not integer cents or the divisor is not a positive
 *   safe integer.
 */
export function roundHalfUpDivide(numeratorCents: number, divisor: number): number {
  assertCents(numeratorCents, 'numeratorCents');
  if (!Number.isSafeInteger(divisor) || divisor < 1) {
    throw new RangeError(`divisor must be a positive integer, got ${String(divisor)}`);
  }
  const d = BigInt(divisor);
  const result = floorDiv(2n * BigInt(numeratorCents) + d, 2n * d);
  // Number(0n) is +0, so a result of zero is never -0.
  return Number(result);
}

/** Floor division for a positive divisor (BigInt `/` truncates toward zero). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b < 0n ? q - 1n : q;
}

interface Quota<Id extends PartId> {
  readonly id: Id;
  readonly sortOrder: number;
  /** Exact share of the part is `numerator / denominator` cents. */
  readonly numerator: bigint;
}

/**
 * Largest-remainder apportionment of `totalCents` among exact shares `numerator / denominator`.
 * Requires `sum(floor(share)) <= totalCents <= sum(floor(share)) + count(share has a fraction)`,
 * which both callers guarantee.
 */
function apportion<Id extends PartId>(
  totalCents: number,
  quotas: readonly Quota<Id>[],
  denominator: bigint,
): SplitResult<Id>[] {
  const floors = quotas.map((q) => q.numerator / denominator);
  const remainders = quotas.map((q) => q.numerator % denominator);
  let left = BigInt(totalCents) - floors.reduce((a, b) => a + b, 0n);

  const order = quotas.map((_, i) => i);
  order.sort((i, j) => {
    const ri = remainders[i] ?? 0n;
    const rj = remainders[j] ?? 0n;
    if (ri !== rj) return ri > rj ? -1 : 1;
    const qi = quotas[i] as Quota<Id>;
    const qj = quotas[j] as Quota<Id>;
    if (qi.sortOrder !== qj.sortOrder) return qi.sortOrder - qj.sortOrder;
    return compareIds(qi.id, qj.id);
  });

  const cents = floors.slice();
  for (const i of order) {
    if (left === 0n) break;
    cents[i] = (cents[i] ?? 0n) + 1n;
    left -= 1n;
  }
  if (left !== 0n) {
    // Unreachable when the precondition holds; guards against a future misuse.
    throw new Error('largest-remainder apportionment could not distribute the total');
  }
  return quotas.map((q, i) => ({ id: q.id, cents: Number(cents[i] ?? 0n) }));
}

function compareIds(a: PartId, b: PartId): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function assertValidKeys(
  parts: readonly { readonly id: PartId; readonly sortOrder: number }[],
): void {
  const seen = new Set<PartId>();
  for (const p of parts) {
    if (!Number.isSafeInteger(p.sortOrder)) {
      throw new RangeError(
        `sortOrder of part ${String(p.id)} must be a safe integer, got ${String(p.sortOrder)}`,
      );
    }
    if (seen.has(p.id)) throw new RangeError(`duplicate part id ${String(p.id)}`);
    seen.add(p.id);
  }
}

/** Returns `value` if it is a non-negative safe integer number of cents; throws otherwise. */
export function assertNonNegativeCents(value: number, label = 'amount'): number {
  assertCents(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be >= 0 cents, got ${String(value)}`);
  }
  return value;
}
