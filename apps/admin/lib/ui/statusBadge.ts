export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function getBookingStatusBadge(status: string): BadgeVariant {
  switch (status) {
    case 'DRAFT':
    case 'PENDING':
    case 'PENDING_CUSTOMER_CONFIRMATION':
    case 'PENDING_ADMIN_CONFIRMATION':
      return 'neutral';
    case 'CONFIRMED':
    case 'ASSIGNED':
    case 'assigned':
    case 'accepted':
    case 'ACCEPTED':
      return 'info';
    case 'ON_THE_WAY':
    case 'on_the_way':
    case 'arrived':
    case 'ARRIVED':
    case 'IN_PROGRESS':
    case 'passenger_on_board':
    case 'JOB_STARTED':
      return 'warning';
    case 'COMPLETED':
    case 'JOB_COMPLETED':
    case 'job_done':
      return 'success';
    case 'FULFILLED':
    case 'fulfilled':
      return 'success';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
    default:
      return 'neutral';
  }
}
