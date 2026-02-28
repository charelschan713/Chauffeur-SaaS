export const BOOKING_EVENTS = {
  BOOKING_CREATED: 'BookingCreated',
  BOOKING_CONFIRMED: 'BookingConfirmed',
  DRIVER_ASSIGNED: 'DriverAssigned',
  JOB_COMPLETED: 'JobCompleted',
  BOOKING_CANCELLED: 'BookingCancelled',
  BOOKING_NO_SHOW: 'BookingNoShow',
} as const;

export type BookingEventType =
  (typeof BOOKING_EVENTS)[keyof typeof BOOKING_EVENTS];
