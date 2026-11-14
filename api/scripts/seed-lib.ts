// Pure helpers for scripts/seed-dev.ts. No I/O here so they can be unit tested.

/** Integer cents to the decimal string Firefly expects ("1234" -> "12.34"). The only place money becomes text. String-only: no division, no floats. */
export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`amountCents must be a non-negative safe integer, got ${cents}`);
  }
  const s = String(cents).padStart(3, '0');
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** The only Firefly user the seed may write to. Created by deploy/dev/bootstrap.sh. */
export const DEV_EMAIL = 'dev@abaqo.invalid';

/**
 * Safety guard, part 1: the seed only runs against a loopback Firefly.
 * Returns an error message, or null when the URL is acceptable.
 */
export function checkTargetUrl(raw: string): string | null {
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return `DEV_FIREFLY_URL is not a valid URL: ${raw}`;
  }
  if (host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1') {
    return null;
  }
  return `Refusing to seed ${raw}: host "${host}" is not loopback (127.0.0.1, localhost, ::1).`;
}

/** Safety guard, part 2: the token must belong to the dev user. Returns an error message or null. */
export function checkDevUser(email: unknown): string | null {
  if (email === DEV_EMAIL) return null;
  return `Refusing to seed: the token belongs to "${String(email)}", expected "${DEV_EMAIL}".`;
}

/** Validates the optional SEED_TODAY override (YYYY-MM-DD, a real calendar date). */
export function parseSeedToday(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`SEED_TODAY must be YYYY-MM-DD, got "${value}"`);
  }
  const roundTrip = new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10);
  if (roundTrip !== value) throw new Error(`SEED_TODAY is not a real date: "${value}"`);
  return value;
}

/** Today's calendar date in Europe/Madrid as YYYY-MM-DD. */
export function madridToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Resolve a fixture date. `monthOffset` 0 is the current month, -1 the previous one.
 * The day is clamped to the month length, and the current month never goes past `today`.
 */
export function resolveDate(today: string, monthOffset: number, day: number): string {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + monthOffset;
  const year = Math.floor(index / 12);
  const month1 = (index % 12) + 1;
  let resolved = Math.min(day, daysInMonth(year, month1));
  if (monthOffset === 0) resolved = Math.min(resolved, d);
  return `${year}-${String(month1).padStart(2, '0')}-${String(resolved).padStart(2, '0')}`;
}

/** First day of the month before the earliest fixture month, minus one day: used as opening balance date. */
export function openingBalanceDate(today: string): string {
  const first = resolveDate(today, -1, 1);
  const date = new Date(`${first}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
