const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  ASSIGNED: 'bg-purple-100 text-purple-800',
  OFFERED: 'bg-purple-100 text-purple-800',
  ACCEPTED: 'bg-indigo-100 text-indigo-800',
  DECLINED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
  EXPIRED: 'bg-gray-100 text-gray-700',
  JOB_STARTED: 'bg-orange-100 text-orange-800',
  JOB_COMPLETED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
};

export function StatusBadge({ status, type }: { status: string; type?: 'operational' | 'payment' }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}
