/**
 * Budget-month boundaries (envelope-rules, "Month"). Pure functions: no clock, no dependence on
 * the process time zone. Calendar dates are Europe/Madrid days; the only instants (`Date`) are
 * inputs to `budgetMonthContaining` and the output of `budgetMonthStartInstant`.
 */

/** A plain proleptic-Gregorian calendar day in Europe/Madrid. `month` is 1-12. */
export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** A budget month: `start` at 00:00 Europe/Madrid through `end` (inclusive). */
export interface BudgetMonth {
  /** The configured `month_start_day` (1-31) this month was computed with. */
  readonly startDay: number;
  readonly start: CalendarDate;
  /** The day before the next budget month's start. */
  readonly end: CalendarDate;
  /** Stable key: `YYYY-MM` of `start`. Every calendar month contains exactly one start. */
  readonly key: string;
}

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Builds a validated calendar date. @throws RangeError if it does not exist. */
export function calendarDate(year: number, month: number, day: number): CalendarDate {
  return assertCalendarDate({ year, month, day });
}

function assertCalendarDate(d: CalendarDate): CalendarDate {
  const { year, month, day } = d;
  if (
    !Number.isInteger(year) ||
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new RangeError(
      `invalid calendar date ${String(year)}-${String(month)}-${String(day)} (years ${MIN_YEAR}-${MAX_YEAR})`,
    );
  }
  return { year, month, day };
}

/** `YYYY-MM-DD`. */
export function formatCalendarDate(d: CalendarDate): string {
  return `${pad(d.year, 4)}-${pad(d.month, 2)}-${pad(d.day, 2)}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function assertStartDay(startDay: number): void {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    throw new RangeError(`month start day must be an integer in 1..31, got ${String(startDay)}`);
  }
}

/** Days since 1970-01-01 for a proleptic-Gregorian date (H. Hinnant's days_from_civil). */
function toDayNumber(d: CalendarDate): number {
  const y = d.month <= 2 ? d.year - 1 : d.year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (d.month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d.day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `toDayNumber` (H. Hinnant's civil_from_days). */
function fromDayNumber(n: number): CalendarDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

function addDays(d: CalendarDate, days: number): CalendarDate {
  return fromDayNumber(toDayNumber(d) + days);
}

function shiftCalendarMonth(year: number, month: number, delta: number): [number, number] {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

/**
 * The day the budget month that starts in calendar month `year-month` starts on: `startDay`, or
 * the month's last day when `startDay` does not exist in it.
 */
function startIn(year: number, month: number, startDay: number): CalendarDate {
  return { year, month, day: Math.min(startDay, daysInMonth(year, month)) };
}

function monthStartingIn(year: number, month: number, startDay: number): BudgetMonth {
  const start = startIn(year, month, startDay);
  const [ny, nm] = shiftCalendarMonth(year, month, 1);
  const end = addDays(startIn(ny, nm, startDay), -1);
  return { startDay, start, end, key: `${pad(year, 4)}-${pad(month, 2)}` };
}

const TIME_ZONE = 'Europe/Madrid';
const MS_PER_DAY = 86_400_000;

// Explicit calendar, numbering system and hour cycle so the output never depends on the host
// locale or process time zone.
const madridFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Madrid wall-clock time of `epochMs` (whole seconds), expressed as if it were UTC epoch ms. */
function madridWallMs(epochMs: number): number {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const p of madridFormat.formatToParts(epochMs)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const date = { year: parts.year ?? NaN, month: parts.month ?? NaN, day: parts.day ?? NaN };
  const seconds = (parts.hour ?? NaN) * 3600 + (parts.minute ?? NaN) * 60 + (parts.second ?? NaN);
  return toDayNumber(date) * MS_PER_DAY + seconds * 1000;
}

function assertInstant(instant: Date): number {
  const ms = instant instanceof Date ? instant.getTime() : Number.NaN;
  if (!Number.isFinite(ms)) {
    throw new RangeError('instant must be a valid Date');
  }
  return ms;
}

/** The Europe/Madrid calendar date of a UTC instant. */
export function madridCalendarDate(instant: Date): CalendarDate {
  const ms = assertInstant(instant);
  return assertCalendarDate(fromDayNumber(Math.floor(madridWallMs(ms) / MS_PER_DAY)));
}

/** The budget month that contains the UTC instant `instant`, months starting at 00:00 Madrid. */
export function budgetMonthContaining(instant: Date, startDay: number): BudgetMonth {
  return budgetMonthContainingDate(madridCalendarDate(instant), startDay);
}

/** The exact UTC instant of 00:00 Europe/Madrid on `month.start`. */
export function budgetMonthStartInstant(month: BudgetMonth): Date {
  const m = assertBudgetMonth(month);
  const wall = toDayNumber(m.start) * MS_PER_DAY;
  // Offset at a first guess, then refined with the offset at that guess (handles DST changes).
  const guess = wall - (madridWallMs(wall) - wall);
  const instant = wall - (madridWallMs(guess) - guess);
  if (madridWallMs(instant) !== wall) {
    // Current Madrid rules change at 02:00/03:00, never at midnight, so this cannot happen for
    // dates from 1980 on. Historic tz data has skipped midnights (e.g. 1928-04-15).
    throw new RangeError(`00:00 ${TIME_ZONE} does not exist on ${formatCalendarDate(m.start)}`);
  }
  return new Date(instant);
}

/** The budget month right after `month` (same start day). */
export function nextBudgetMonth(month: BudgetMonth): BudgetMonth {
  const m = assertBudgetMonth(month);
  return budgetMonthContainingDate(addDays(m.end, 1), m.startDay);
}

/** The budget month right before `month` (same start day). */
export function previousBudgetMonth(month: BudgetMonth): BudgetMonth {
  const m = assertBudgetMonth(month);
  return budgetMonthContainingDate(addDays(m.start, -1), m.startDay);
}

/** Rebuilds `month` from its start and start day; throws if it is not a consistent month. */
function assertBudgetMonth(month: BudgetMonth): BudgetMonth {
  const rebuilt = budgetMonthContainingDate(month.start, month.startDay);
  if (
    toDayNumber(rebuilt.start) !== toDayNumber(month.start) ||
    toDayNumber(rebuilt.end) !== toDayNumber(month.end) ||
    rebuilt.key !== month.key
  ) {
    throw new RangeError(
      `not a budget month for start day ${month.startDay}: ${formatCalendarDate(month.start)}..${formatCalendarDate(month.end)} (${month.key})`,
    );
  }
  return rebuilt;
}

/** The budget month that contains the Madrid calendar date `date`. */
export function budgetMonthContainingDate(date: CalendarDate, startDay: number): BudgetMonth {
  assertCalendarDate(date);
  assertStartDay(startDay);
  if (date.day >= startIn(date.year, date.month, startDay).day) {
    return monthStartingIn(date.year, date.month, startDay);
  }
  const [py, pm] = shiftCalendarMonth(date.year, date.month, -1);
  return monthStartingIn(py, pm, startDay);
}
