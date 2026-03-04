interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  if (!message) return null;
  return (
    <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-4">
      <div>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-700 underline hover:text-red-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}
