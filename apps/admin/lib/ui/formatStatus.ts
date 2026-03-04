/**
 * Converts UPPER_SNAKE_CASE status strings to human-readable labels.
 * e.g. JOB_STARTED → "In Progress", NO_SHOW → "No Show"
 */
const STATUS_LABELS: Record<string, string> = {
  // Booking operational
  DRAFT: 'Draft',
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  ON_THE_WAY: 'On the Way',
  ARRIVED: 'Arrived',
  IN_PROGRESS: 'In Progress',
  JOB_STARTED: 'In Progress',
  JOB_COMPLETED: 'Completed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  // Payment
  UNPAID: 'Unpaid',
  AUTHORIZED: 'Authorized',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Part. Refunded',
  FAILED: 'Failed',
  // Driver / membership
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  // Vehicle
  DEACTIVATED: 'Deactivated',
};

export function formatStatus(status: string | null | undefined): string {
  if (!status) return '—';
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  // Fallback: Title Case from snake
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
