export function formatBookingTime(
  utcIso: string,
  timezone: string,
  cityName: string,
): string {
  const date = new Date(utcIso);
  const formatted = date.toLocaleString('en-AU', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${formatted} (${cityName})`;
}
