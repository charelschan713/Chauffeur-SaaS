export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function getBookingStatusBadge(status: string): BadgeVariant {
  switch (status) {
    case 'DRAFT':
    case 'PENDING':
      return 'neutral';
    case 'CONFIRMED':
    case 'ASSIGNED':
      return 'info';
    case 'IN_PROGRESS':
    case 'JOB_STARTED':
    case 'ON_THE_WAY':
    case 'ARRIVED':
      return 'warning';
    case 'COMPLETED':
    case 'JOB_COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
    default:
      return 'neutral';
  }
}
