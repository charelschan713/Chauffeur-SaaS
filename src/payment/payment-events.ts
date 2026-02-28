export const PAYMENT_EVENTS = {
  PAYMENT_AUTHORIZED: 'PaymentAuthorized',
  PAYMENT_CAPTURED: 'PaymentCaptured',
  PAYMENT_REFUNDED: 'PaymentRefunded',
  PAYMENT_FAILED: 'PaymentFailed',
} as const;

export type PaymentEventType =
  (typeof PAYMENT_EVENTS)[keyof typeof PAYMENT_EVENTS];
