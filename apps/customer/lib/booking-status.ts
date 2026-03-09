/**
 * Shared booking status constants — portal web single source of truth.
 *
 * Rules:
 *  - operational_status:        UPPERCASE (bookings.operational_status)
 *  - driver_execution_status:   lowercase (assignments.driver_execution_status)
 *  - Values must match backend enum/DB exactly.
 *  - Labels must match what the customer-app (src/lib/booking-status.ts) shows.
 *  - DO NOT invent new values. If backend adds one, add it here first.
 *
 * Last verified: 2026-03-09
 */

// ── Operational status ────────────────────────────────────────────────────────
export const OP_STATUS_LABELS: Record<string, string> = {
  PENDING_CUSTOMER_CONFIRMATION: 'Confirming',      // customer yet to confirm payment
  AWAITING_CONFIRMATION:         'Confirming',      // admin yet to confirm
  CONFIRMED:                     'Confirmed',
  COMPLETED:                     'Completed',
  FULFILLED:                     'Fulfilled',
  CANCELLED:                     'Cancelled',
  PAYMENT_FAILED:                'Payment Failed',
};

// ── Colour tokens for list/badge use ─────────────────────────────────────────
export const OP_STATUS_BADGE: Record<string, {
  label:  string;
  color:  string;           // badge text colour class
  bg:     string;           // badge bg class
  dot:    string;           // dot bg class
}> = {
  PENDING_CUSTOMER_CONFIRMATION: {
    label: 'Confirming',
    color: 'text-amber-400',
    bg:    'bg-amber-500/15 border border-amber-500/25',
    dot:   'bg-amber-400',
  },
  AWAITING_CONFIRMATION: {
    label: 'Confirming',
    color: 'text-amber-400',
    bg:    'bg-amber-500/15 border border-amber-500/25',
    dot:   'bg-amber-400',
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: 'text-emerald-400',
    bg:    'bg-emerald-500/15 border border-emerald-500/25',
    dot:   'bg-emerald-400',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-muted-foreground',
    bg:    'bg-muted/30 border border-border/30',
    dot:   'bg-muted-foreground',
  },
  FULFILLED: {
    label: 'Fulfilled',
    color: 'text-muted-foreground',
    bg:    'bg-muted/30 border border-border/30',
    dot:   'bg-muted-foreground',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-red-400',
    bg:    'bg-red-500/15 border border-red-500/25',
    dot:   'bg-red-400',
  },
  PAYMENT_FAILED: {
    label: 'Payment Failed',
    color: 'text-red-400',
    bg:    'bg-red-500/15 border border-red-500/25',
    dot:   'bg-red-400',
  },
};

// Helper: safe lookup with graceful fallback
export function getOpStatusBadge(status: string) {
  return OP_STATUS_BADGE[status] ?? {
    label: status.replace(/_/g, ' '),
    color: 'text-muted-foreground',
    bg:    'bg-muted/30 border border-border/30',
    dot:   'bg-muted-foreground',
  };
}

// ── Driver execution status ───────────────────────────────────────────────────
export const DRIVER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  assigned:           { label: 'Driver Assigned',    color: 'text-blue-400'    },
  accepted:           { label: 'Driver Accepted',    color: 'text-blue-400'    },
  on_the_way:         { label: 'Driver En Route',    color: 'text-blue-400'    },
  arrived:            { label: 'Driver Arrived',     color: 'text-amber-400'   },
  passenger_on_board: { label: 'Passenger On Board', color: 'text-blue-400'    },
  job_done:           { label: 'Trip Complete',      color: 'text-emerald-400' },
};

// ── Cancellable statuses (customer can cancel) ────────────────────────────────
export const CANCELLABLE_STATUSES = [
  'PENDING_CUSTOMER_CONFIRMATION',
  'AWAITING_CONFIRMATION',
  'CONFIRMED',
] as const;
