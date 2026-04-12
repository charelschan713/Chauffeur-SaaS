'use client';

export type DriverStatus =
  | 'assigned'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'passenger_on_board'
  | 'job_done'
  | 'cancelled'
  | 'no_show';

const FLOW: DriverStatus[] = [
  'assigned',
  'accepted',
  'on_the_way',
  'arrived',
  'passenger_on_board',
  'job_done',
];

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusTimeline({ status }: { status: DriverStatus }) {
  const idx = FLOW.indexOf(status as DriverStatus);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Timeline</p>
      <div className="space-y-2">
        {FLOW.map((s, i) => {
          const done = idx >= i;
          const active = status === s;
          return (
            <div key={s} className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'}`} />
              <span className={`text-[12px] ${active ? 'text-white font-semibold' : done ? 'text-white/80' : 'text-[hsl(var(--muted-foreground))]'}`}>
                {statusLabel(s)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
