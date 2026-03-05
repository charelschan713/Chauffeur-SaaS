'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

interface AssignPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  leg: 'A' | 'B';
  fareMinor: number;
  tollMinor?: number;
  parkingMinor?: number;
  tollParkingMinor?: number;
  totalPriceMinor: number;
  currency: string;
  onAssigned: () => void;
}

function formatMinor(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function AssignPartnerModal({
  isOpen,
  onClose,
  bookingId,
  leg,
  fareMinor,
  tollMinor = 0,
  parkingMinor = 0,
  tollParkingMinor,
  totalPriceMinor,
  currency,
  onAssigned,
}: AssignPartnerModalProps) {
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [payType, setPayType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [payValue, setPayValue] = useState(70);
  const combinedTP = tollMinor + parkingMinor || tollParkingMinor || 0;
  const [tollEditable, setTollEditable] = useState(tollMinor / 100);
  const [parkingEditable, setParkingEditable] = useState(parkingMinor / 100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPartners, setLoadingPartners] = useState(false);

  // Auto-calculate partner pay
  const partnerPayMinor = useMemo(() => {
    const fareOnly = fareMinor; // toll handled separately
    if (payType === 'PERCENTAGE') {
      return Math.round(fareOnly * payValue / 100);
    }
    return Math.round(payValue * 100);
  }, [payType, payValue, fareMinor]);

  const tollMinorCalc = Math.round(tollEditable * 100);
  const partnerGetsMinor = partnerPayMinor + tollMinorCalc;
  const platformFeeMinor = totalPriceMinor - partnerGetsMinor;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPartner('');
    setError(null);
    setTollEditable(tollMinor / 100);
    setParkingEditable(parkingMinor / 100);
    setLoadingPartners(true);
    api.get('/assignments/connections/approved')
      .then((res) => setPartners(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPartners([]))
      .finally(() => setLoadingPartners(false));
    // Load tenant default pay settings
    api.get('/tenants/settings').then((res) => {
      if (res.data?.default_driver_pay_type) setPayType(res.data.default_driver_pay_type);
      if (res.data?.default_driver_pay_value != null) setPayValue(res.data.default_driver_pay_value);
    });
  }, [isOpen, tollMinor, parkingMinor]);

  async function handleAssign() {
    if (!selectedPartner) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/assignments/bookings/${bookingId}/assign-partner`, {
        partner_tenant_id: selectedPartner,
        partner_pay_type: payType,
        partner_pay_value: payValue,
        toll_minor: Math.round(tollEditable * 100),
        parking_minor: Math.round(parkingEditable * 100),
        leg,
      });
      onAssigned();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to assign partner. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const selectedPartnerName = partners.find((p) => p.partner_tenant_id === selectedPartner)?.partner_name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {leg === 'B' ? 'Assign to Partner — Return' : 'Assign to Partner'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Transfer this booking to a connected partner tenant</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6">

          {/* Left — Customer Payment Summary (read-only) */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Customer Payment
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Base Fare</span>
                <span className="font-medium">{formatMinor(fareMinor, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Toll</span>
                <span className="font-medium">{formatMinor(tollMinor, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Parking</span>
                <span className="font-medium">{formatMinor(parkingMinor, currency)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Price</span>
                <span>{formatMinor(totalPriceMinor, currency)}</span>
              </div>
            </div>
          </div>

          {/* Right — Partner Pay */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Partner Pay
            </h4>
            <div className="space-y-3">
              {/* Pay type + value */}
              <div className="flex gap-2">
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                  className="border rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PERCENTAGE">% of Fare</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
                <input
                  type="number"
                  value={payValue}
                  min={0}
                  step={payType === 'PERCENTAGE' ? 1 : 0.01}
                  onChange={(e) => setPayValue(parseFloat(e.target.value) || 0)}
                  className="border rounded px-3 py-2 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={payType === 'PERCENTAGE' ? '70' : '0.00'}
                />
              </div>

              {/* Editable toll */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Toll</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">{currency}</span>
                  <input type="number" value={tollEditable} min={0} step={0.01}
                    onChange={(e) => setTollEditable(parseFloat(e.target.value) || 0)}
                    className="border rounded px-2 py-1 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {/* Editable parking */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Parking</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">{currency}</span>
                  <input type="number" value={parkingEditable} min={0} step={0.01}
                    onChange={(e) => setParkingEditable(parseFloat(e.target.value) || 0)}
                    className="border rounded px-2 py-1 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Partner Gets */}
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex justify-between font-semibold text-sm">
                <span className="text-gray-700">Partner Gets</span>
                <span className="text-purple-700">{formatMinor(partnerGetsMinor, currency)}</span>
              </div>

              {/* Platform fee */}
              <div className="flex justify-between text-sm text-gray-500">
                <span>Platform Fee</span>
                <span className={platformFeeMinor < 0 ? 'text-red-600 font-medium' : ''}>
                  {formatMinor(platformFeeMinor, currency)}
                </span>
              </div>
              {platformFeeMinor < 0 && (
                <p className="text-xs text-red-500">⚠️ Partner pay exceeds total price</p>
              )}

              {/* Breakdown hint */}
              <p className="text-xs text-gray-400">
                {payType === 'PERCENTAGE'
                  ? `${payValue}% of ${formatMinor(fareMinor, currency)} fare + toll passthrough`
                  : `Fixed ${formatMinor(Math.round(payValue * 100), currency)} + toll passthrough`}
              </p>
            </div>
          </div>
        </div>

        {/* Partner Selection */}
        <div className="px-6 pb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Select Partner Tenant
          </label>
          {loadingPartners ? (
            <div className="text-sm text-gray-400 py-2">Loading connections...</div>
          ) : partners.length === 0 ? (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              No approved partner connections found. Go to{' '}
              <strong>Settings → Network</strong> to request a connection.
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {partners.map((p) => (
                <button
                  key={p.partner_tenant_id}
                  type="button"
                  onClick={() => setSelectedPartner(p.partner_tenant_id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    selectedPartner === p.partner_tenant_id
                      ? 'border-purple-500 bg-purple-50 text-purple-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{p.partner_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Connected partner
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {selectedPartnerName
              ? `Transferring to: ${selectedPartnerName}`
              : 'No partner selected'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedPartner || saving || platformFeeMinor < 0}
              className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Sending...' : 'Assign to Partner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
