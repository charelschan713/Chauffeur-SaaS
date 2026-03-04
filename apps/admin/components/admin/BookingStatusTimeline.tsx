'use client';

import React from 'react';

const ORDER = ['Created', 'Confirmed', 'Assigned', 'Accepted', 'In Progress', 'Completed'];

const STATUS_MAP: Record<string, string> = {
  DRAFT: 'Created',
  PENDING: 'Created',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  JOB_STARTED: 'In Progress',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  JOB_COMPLETED: 'Completed',
};

interface BookingStatusTimelineProps {
  status: string;
}

export function BookingStatusTimeline({ status }: BookingStatusTimelineProps) {
  const current = STATUS_MAP[status] ?? 'Created';
  const currentIndex = ORDER.indexOf(current);

  return (
    <div className="space-y-4">
      {ORDER.map((step, index) => {
        const isActive = index <= currentIndex;
        return (
          <div key={step} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  isActive ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
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
