/**
 * Phone utility — canonical E.164 format
 * Storage: phone_country_code (+61) + phone_number (412345678)
 * E.164:   +61412345678
 * Display: +61 412345678
 */

export function toE164(
  countryCode: string | null | undefined,
  number: string | null | undefined,
): string | null {
  if (!countryCode || !number) return null;
  const code = countryCode.trim();
  const num = number.trim().replace(/^\s+/, '');
  if (!code || !num) return null;
  return `${code}${num}`;
}

export function displayPhone(
  countryCode: string | null | undefined,
  number: string | null | undefined,
): string {
  if (!countryCode || !number) return '—';
  return `${countryCode.trim()} ${number.trim()}`;
}
