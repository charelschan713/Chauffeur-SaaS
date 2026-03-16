'use client';

type Props = {
  status: string;
  disabled?: boolean;
  onActivate: () => void;
  onSuspend: () => void;
  onInactive: () => void;
  compact?: boolean;
};

export default function TenantStatusActions({
  status,
  disabled,
  onActivate,
  onSuspend,
  onInactive,
  compact,
}: Props) {
  const cls = compact ? 'text-sm hover:underline' : 'rounded text-white text-sm px-3 py-2';
  return (
    <>
      {status !== 'active' && (
        <button
          className={compact ? `text-green-700 ${cls}` : `bg-green-600 ${cls}`}
          onClick={onActivate}
          disabled={disabled}
        >
          Activate
        </button>
      )}
      {status === 'active' && (
        <button
          className={compact ? `text-amber-700 ${cls}` : `bg-amber-600 ${cls}`}
          onClick={onSuspend}
          disabled={disabled}
        >
          Suspend
        </button>
      )}
      {status !== 'inactive' && (
        <button
          className={compact ? `text-gray-700 ${cls}` : `bg-gray-700 ${cls}`}
          onClick={onInactive}
          disabled={disabled}
        >
          Mark Inactive
        </button>
      )}
    </>
  );
}
