/**
 * Formats integer cents as EUR. UI edge only: the single division by 100 happens here.
 * es-ES default: 123456 -> "1.234,56 €". Negatives use a real minus sign (U+2212).
 */
export function formatMoney(cents: number, locale = 'es-ES'): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatMoney expects safe integer cents, got ${cents}`);
  }
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
    signDisplay: 'never',
  });
  const formatted = formatter.format(Math.abs(cents) / 100);
  return cents < 0 ? `−${formatted}` : formatted;
}
