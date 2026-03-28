/**
 * Format a booking datetime for display to customers, admin, and passengers.
 * Output: "5 Mar 2026 12:45 PM (Sydney)"
 */
export function formatBookingTime(
  utcIso: string,
  timezone?: string | null,
  cityName?: string | null,
): string {
  if (!utcIso) return '—';
  try {
    const isNaive = !/Z$|[+-]\d{2}:?\d{2}$/.test(utcIso);
    const date = isNaive ? toDatePreserveLocal(utcIso) : new Date(utcIso);
    const tz = isNaive ? 'UTC' : (timezone || 'Australia/Sydney');
    const day = date.toLocaleString('en-AU', {
      timeZone: tz,
      day: 'numeric',
    });
    const month = date.toLocaleString('en-AU', {
      timeZone: tz,
      month: 'short',
    });
    const year = date.toLocaleString('en-AU', {
      timeZone: tz,
      year: 'numeric',
    });
    const time = date.toLocaleString('en-AU', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase(); // "12:45 PM"

    const city = cityName?.trim()
      ? ` (${cityName})`
      : timezone
        ? ` (${timezone.split('/').pop()?.replace(/_/g, ' ')})`
        : '';

    return `${day} ${month} ${year} ${time}${city}`;
  } catch {
    return utcIso;
  }
}

/**
 * Short date only: "5 Mar 2026"
 */
export function formatDate(iso: string, timezone?: string | null): string {
  if (!iso) return '—';
  try {
    const isNaive = !/Z$|[+-]\d{2}:?\d{2}$/.test(iso);
    const date = isNaive ? toDatePreserveLocal(iso) : new Date(iso);
    return date.toLocaleDateString('en-AU', {
      timeZone: isNaive ? 'UTC' : (timezone || 'Australia/Sydney'),
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Time only: "12:45 PM"
 */
export function formatTime(iso: string, timezone?: string | null): string {
  if (!iso) return '—';
  try {
    const isNaive = !/Z$|[+-]\d{2}:?\d{2}$/.test(iso);
    const date = isNaive ? toDatePreserveLocal(iso) : new Date(iso);
    return date.toLocaleTimeString('en-AU', {
      timeZone: isNaive ? 'UTC' : (timezone || 'Australia/Sydney'),
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
  } catch {
    return iso;
  }
}

function toDatePreserveLocal(iso: string): Date {
  const [datePart, timePartRaw] = iso.split('T');
  const timePart = (timePartRaw ?? '00:00:00').slice(0, 8);
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(Date.UTC(y || 0, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0));
}
