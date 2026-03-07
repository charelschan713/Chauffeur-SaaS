'use client';

import React from 'react';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Created',
  PENDING: 'Created',
  PENDING_CUSTOMER_CONFIRMATION: 'Pending Confirmation',
  AWAITING_CONFIRMATION: 'Awaiting Confirmation',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Driver Assigned',
  ACCEPTED: 'Driver Accepted',
  JOB_STARTED: 'In Progress',
  IN_PROGRESS: 'In Progress',
  FULFILLED: 'Fulfilled',
  COMPLETED: 'Completed',
  JOB_COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_ORDER = [
  'PENDING_CUSTOMER_CONFIRMATION',
  'AWAITING_CONFIRMATION',
  'PENDING',
  'DRAFT',
  'CONFIRMED',
  'ASSIGNED',
  'ACCEPTED',
  'JOB_STARTED',
  'IN_PROGRESS',
  'FULFILLED',
  'COMPLETED',
  'JOB_COMPLETED',
  'CANCELLED',
];

function actorLabel(triggeredBy: string | null | undefined): string {
  if (!triggeredBy) return '';
  const t = triggeredBy.toUpperCase();
  if (t === 'ADMIN' || t === 'SYSTEM') return triggeredBy;
  if (t === 'CUSTOMER') return 'Customer';
  if (t === 'DRIVER') return 'Driver';
  if (t === 'WIDGET') return 'Widget';
  // Looks like a UUID — admin user
  if (/^[0-9a-f-]{36}$/i.test(triggeredBy)) return 'Admin';
  return triggeredBy;
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

interface HistoryRow {
  new_status: string;
  previous_status?: string;
  triggered_by?: string;
  reason?: string;
  created_at: string;
}

interface BookingStatusTimelineProps {
  status: string;
  statusHistory?: HistoryRow[];
}

export function BookingStatusTimeline({ status, statusHistory }: BookingStatusTimelineProps) {
  // If we have real history, render it
  if (statusHistory && statusHistory.length > 0) {
    return (
      <div className="space-y-0">
        {statusHistory.map((row, idx) => {
          const isCancelled = row.new_status === 'CANCELLED';
          const isLast = idx === statusHistory.length - 1;
          return (
            <div key={idx} className="flex items-start gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center pt-0.5">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isCancelled ? 'bg-red-500' : isLast ? 'bg-blue-600' : 'bg-green-500'
                  }`}
                />
                {!isLast && <div className="w-px h-8 bg-gray-200 mt-1" />}
              </div>
              {/* Content */}
              <div className="pb-5">
                <div className={`text-sm font-medium ${isCancelled ? 'text-red-600' : 'text-gray-900'}`}>
                  {STATUS_LABEL[row.new_status] ?? row.new_status}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                  <span>{formatDt(row.created_at)}</span>
                  {row.triggered_by && (
                    <span className="text-gray-400">·</span>
                  )}
                  {row.triggered_by && (
                    <span className="font-medium text-gray-600">by {actorLabel(row.triggered_by)}</span>
                  )}
                </div>
                {row.reason && (
                  <div className="text-xs text-gray-400 italic mt-0.5">{row.reason}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: static progress bar based on current status
  const ORDER = ['Created', 'Confirmed', 'Assigned', 'Accepted', 'In Progress', 'Completed'];
  const STATIC_MAP: Record<string, string> = {
    DRAFT: 'Created', PENDING: 'Created', CONFIRMED: 'Confirmed',
    ASSIGNED: 'Assigned', ACCEPTED: 'Accepted',
    JOB_STARTED: 'In Progress', IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed', JOB_COMPLETED: 'Completed',
  };
  const current = STATIC_MAP[status] ?? 'Created';
  const currentIndex = ORDER.indexOf(current);
  return (
    <div className="space-y-4">
      {ORDER.map((step, index) => {
        const isActive = index <= currentIndex;
        return (
          <div key={step} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`} />
              {index < ORDER.length - 1 && (
                <div className={`w-px flex-1 ${isActive ? 'bg-blue-200' : 'bg-gray-200'}`} />
              )}
            </div>
            <div className="text-sm text-gray-700">{step}</div>
          </div>
        );
      })}
    </div>
  );
}
