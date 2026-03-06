/**
 * Format a minor-unit amount (cents) as a currency string with 2 decimal places.
 * e.g. fmtMoney(15000, 'AUD') → '$150.00'
 */
export function fmtMoney(minor: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Format minor amount as plain decimal string (no currency symbol). */
export function fmtMinorToDecimal(minor: number): string {
  return (minor / 100).toFixed(2);
}
