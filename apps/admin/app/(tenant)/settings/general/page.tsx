'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function GeneralSettingsPage() {
  const qc = useQueryClient();
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

  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAutoAssign, setPendingAutoAssign] = useState<boolean | null>(null);
  const [payForm, setPayForm] = useState({
    default_driver_pay_type: 'PERCENTAGE',
    default_driver_pay_value: 70,
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/tenants/settings', {
        auto_assign_enabled: pendingAutoAssign,
        confirm_text: confirmText,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      setShowConfirm(false);
      setConfirmText('');
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/tenants/settings', payForm);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">General Settings</h1>

      {/* Auto Assign */}
      <div className="bg-white border rounded p-6 space-y-4">
        <h2 className="text-lg font-medium">Auto Assign</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto Assign Drivers</p>
            <p className="text-xs text-gray-500">
              When enabled, bookings are automatically dispatched to drivers.
            </p>
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
          <div className="border rounded p-4 bg-yellow-50 space-y-3">
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

      {/* Default Driver Pay */}
      <div className="bg-white border rounded p-6 space-y-4">
        <h2 className="text-lg font-medium">Default Driver Pay</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Pay Type</label>
            <select
              value={payForm.default_driver_pay_type}
              onChange={(e) => setPayForm((p) => ({ ...p, default_driver_pay_type: e.target.value }))}
              className="mt-1 border rounded px-3 py-2 text-sm w-full"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed Amount</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              {payForm.default_driver_pay_type === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount ($)'}
            </label>
            <input
              type="number"
              value={payForm.default_driver_pay_value}
              onChange={(e) => setPayForm((p) => ({ ...p, default_driver_pay_value: parseFloat(e.target.value) }))}
              className="mt-1 border rounded px-3 py-2 text-sm w-full"
            />
          </div>
        </div>
        <button
          onClick={() => payMutation.mutate()}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          Save
        </button>
      </div>
    </div>
  );
}
