'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ConsoleLayout } from '@/components/patterns/Console';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function DispatchConsolePage() {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAutoAssign, setPendingAutoAssign] = useState<boolean | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const user = parseJwt(token);
  const isOwner = user?.role === 'OWNER' || user?.role === 'owner';

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const res = await api.get('/tenants/settings');
      return res.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/tenants/settings', {
        auto_assign_enabled: pendingAutoAssign,
        confirm_text: confirmText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setShowConfirm(false);
      setConfirmText('');
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['dispatch-bookings'],
    queryFn: async () => {
      const res = await api.get('/dispatch/queue');
      return res.data ?? [];
    },
  });

  const bookings = data ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post('/dispatch/offer', {
        bookingId: bookings[0]?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-bookings'] });
    },
  });

  const hasBookings = bookings.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto Assign</p>
            <p className="text-xs text-gray-500">Automatically dispatch confirmed bookings.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${settings?.auto_assign_enabled ? 'text-green-600' : 'text-gray-400'}`}>
              {settings?.auto_assign_enabled ? 'ON' : 'OFF'}
            </span>
            {isOwner && (
              <button
                onClick={() => {
                  setPendingAutoAssign(!settings?.auto_assign_enabled);
                  setShowConfirm(true);
                }}
                className="px-3 py-1 rounded border text-sm"
              >
                Toggle
              </button>
            )}
          </div>
        </div>
        {showConfirm && (
          <div className="border rounded p-4 bg-yellow-50 space-y-3 mt-3">
            <p className="text-sm font-medium">
              Type <strong>CONFIRM</strong> to {pendingAutoAssign ? 'enable' : 'disable'} Auto Assign
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CONFIRM"
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <div className="flex gap-2">
              <button
                disabled={confirmText !== 'CONFIRM'}
                onClick={() => toggleMutation.mutate()}
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmText('');
                }}
                className="px-4 py-2 rounded border text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <ConsoleLayout
        header={
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Dispatch Console</h2>
            <button
              onClick={() => mutation.mutate()}
              disabled={!hasBookings || mutation.isPending}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60"
            >
              {mutation.isPending ? 'Dispatching...' : 'Offer Booking'}
            </button>
          </div>
        }
        queue={
          error ? (
            <ErrorAlert message="Unable to load dispatch data" />
          ) : isLoading ? (
            <p className="text-sm text-gray-500">Loading dispatch queue...</p>
          ) : hasBookings ? (
            <div className="space-y-3">
              {bookings.map((b: any) => (
                <div key={b.id} className="border rounded p-4">
                  <div className="font-medium text-gray-900">{b.booking_reference}</div>
                  <div className="text-sm text-gray-500">{b.pickup_address_text} → {b.dropoff_address_text}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center">No confirmed bookings awaiting dispatch.</p>
          )
        }
        workspace={
          <div className="text-sm text-gray-600 space-y-2">
            <p>Ready to offer the next booking in queue.</p>
            <p>Auto Assign: {settings?.auto_assign_enabled ? 'ON' : 'OFF'}</p>
          </div>
        }
        resources={
          <div className="text-sm text-gray-600 space-y-2">
            <div>Queue size: {bookings.length}</div>
          </div>
        }
      />
    </div>
  );
}
