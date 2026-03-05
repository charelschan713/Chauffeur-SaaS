/**
 * Converts UPPER_SNAKE_CASE status strings to human-readable labels.
 * e.g. JOB_STARTED → "In Progress", NO_SHOW → "No Show"
 */
const STATUS_LABELS: Record<string, string> = {
  // Booking operational statuses
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PENDING_CUSTOMER_CONFIRMATION: 'Pending Confirmation',
  PENDING_ADMIN_CONFIRMATION: 'Pending Admin',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Driver Accepted',
  ON_THE_WAY: 'Driver On the Way',
  IN_PROGRESS: 'Passenger On Board',
  JOB_STARTED: 'In Progress',
  JOB_COMPLETED: 'Completed',
  COMPLETED: 'Completed',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  // Driver execution statuses (shown as secondary badge)
  assigned: 'Assigned',
  accepted: 'Driver Accepted',
  on_the_way: 'In Progress',
  arrived: 'In Progress',
  passenger_on_board: 'In Progress',
  job_done: 'Job Done',
  fulfilled: 'Fulfilled',
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
