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
    const date = new Date(utcIso);
    const day = date.toLocaleString('en-AU', {
      timeZone: timezone || 'Australia/Sydney',
      day: 'numeric',
    });
    const month = date.toLocaleString('en-AU', {
      timeZone: timezone || 'Australia/Sydney',
      month: 'short',
    });
    const year = date.toLocaleString('en-AU', {
      timeZone: timezone || 'Australia/Sydney',
      year: 'numeric',
    });
    const time = date.toLocaleString('en-AU', {
      timeZone: timezone || 'Australia/Sydney',
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
    const date = new Date(iso);
    return date.toLocaleDateString('en-AU', {
      timeZone: timezone || 'Australia/Sydney',
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
    const date = new Date(iso);
    return date.toLocaleTimeString('en-AU', {
      timeZone: timezone || 'Australia/Sydney',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
  } catch {
    return iso;
  }
}
