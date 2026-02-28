export const DISPATCH_EVENTS = {
  DRIVER_INVITATION_SENT: 'DriverInvitationSent',
  DRIVER_ACCEPTED_ASSIGNMENT: 'DriverAcceptedAssignment',
  DRIVER_DECLINED_ASSIGNMENT: 'DriverDeclinedAssignment',
  ASSIGNMENT_EXPIRED: 'AssignmentExpired',
  DRIVER_STARTED_TRIP: 'DriverStartedTrip',
  DRIVER_COMPLETED_TRIP: 'DriverCompletedTrip',
} as const;

export type DispatchEventType =
  (typeof DISPATCH_EVENTS)[keyof typeof DISPATCH_EVENTS];
