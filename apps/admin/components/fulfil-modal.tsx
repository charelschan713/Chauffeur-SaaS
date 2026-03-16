'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

interface FulfilModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingRef: string;
  originalMinor: number;
  currency: string;
  leg1Minor?: number | null;
  leg2Minor?: number | null;
  combinedBeforeMultiplier?: number | null;
  multiplierMode?: string | null;
  multiplierValue?: number | null;
  bookingSnapshot?: {
    booking_reference?: string | null;
    pickup_address_text?: string | null;
    dropoff_address_text?: string | null;
    customer_first_name?: string | null;
    customer_last_name?: string | null;
    service_type_name?: string | null;
    service_class_name?: string | null;
    waypoints?: string[] | null;
    waiting_time_minutes?: number | null;
    distance_km?: number | string | null;
    return_distance_km?: number | string | null;
    duration_minutes?: number | string | null;
    return_duration_minutes?: number | string | null;
    pricing_snapshot?: {
      original_minor?: number | null;
      final_fare_minor?: number | null;
      grand_total_minor?: number | null;
      extras_minor?: number | null;
      pre_discount_fare_minor?: number | null;
      toll_minor?: number | null;
      parking_minor?: number | null;
      toll_parking_minor?: number | null;
      waypoints_minor?: number | null;
      baby_seats_minor?: number | null;
      discount_amount_minor?: number | null;
      leg1_minor?: number | null;
      leg1_surcharge_minor?: number | null;
      leg2_minor?: number | null;
      leg2_surcharge_minor?: number | null;
      multiplier_mode?: string | null;
      multiplier_value?: number | null;
    };
  };
  driverReport?: {
    extra_waypoints?: string[];
    waiting_minutes?: number;
    extra_toll?: number;
    extra_parking?: number;
    notes?: string;
  } | null;
  onFulfilled: () => void;
}

interface FulfilPreview {
  originalMinor: number;
  recalculatedMinor: number;
  finalMinor: number;
  deltaMinor: number;
  waypoints: string[];
  waitingMinutes: number;
  distanceKm: number;
  durationMinutes: number;
  actualTollMinor: number;
  actualParkingMinor: number;
  waitChargeMinor: number;
  manualAdjustmentMinor: number;
  extraWaitingMinutes: number;
  leg1Minor?: number | null;
  leg2Minor?: number | null;
  combinedBeforeMultiplier?: number | null;
  multiplierMode?: string | null;
  multiplierValue?: number | null;
}

function fmt(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function toMinor(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function returnRuleLabel(mode?: string | null, value?: number | null) {
  if (!mode || !value) return null;
  if (mode === 'PERCENTAGE') {
    return `${value}% return rule`;
  }
  return `${value} ${mode.toLowerCase().replace('_', ' ')} return rule`;
}

function toDistanceStr(v: unknown): string {
  return v == null || v === '' ? '' : String(v);
}

export function FulfilModal({
  isOpen,
  onClose,
  bookingId,
  bookingRef,
  originalMinor,
  currency,
  leg1Minor,
  leg2Minor,
  combinedBeforeMultiplier,
  multiplierMode,
  multiplierValue,
  bookingSnapshot,
  driverReport,
  onFulfilled,
}: FulfilModalProps) {
  const [saving, setSaving] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [note, setNote] = useState('');
  const [manualAdjustment, setManualAdjustment] = useState('0.00');
  const [waypointLines, setWaypointLines] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [waitingMinutes, setWaitingMinutes] = useState('');
  const [actualToll, setActualToll] = useState('');
  const [actualParking, setActualParking] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FulfilPreview | null>(null);

  if (!isOpen) return null;

  const customerName = useMemo(() => {
    const first = bookingSnapshot?.customer_first_name?.trim() ?? '';
    const last = bookingSnapshot?.customer_last_name?.trim() ?? '';
    return [first, last].filter(Boolean).join(' ') || '—';
  }, [bookingSnapshot?.customer_first_name, bookingSnapshot?.customer_last_name]);

  const defaultLines = useMemo(() => {
    const arr = Array.isArray(bookingSnapshot?.waypoints) ? bookingSnapshot.waypoints : [];
    return arr.join('\n');
  }, [bookingSnapshot?.waypoints]);

  const defaultDistance = toDistanceStr(bookingSnapshot?.distance_km);
  const defaultDuration = toDistanceStr(bookingSnapshot?.duration_minutes);
  const defaultWaiting = String(bookingSnapshot?.waiting_time_minutes ?? 0);
  const defaultToll = useMemo(
    () => toDistanceStr((bookingSnapshot?.pricing_snapshot as any)?.toll_minor ?? driverReport?.extra_toll ?? 0),
    [bookingSnapshot?.pricing_snapshot, driverReport?.extra_toll],
  );
  const defaultParking = useMemo(
    () => toDistanceStr((bookingSnapshot?.pricing_snapshot as any)?.parking_minor ?? driverReport?.extra_parking ?? 0),
    [bookingSnapshot?.pricing_snapshot, driverReport?.extra_parking],
  );

  useEffect(() => {
    setWaypointLines(defaultLines);
    setDistanceKm(defaultDistance);
    setDurationMinutes(defaultDuration);
    setWaitingMinutes(defaultWaiting);
    setActualToll(defaultToll);
    setActualParking(defaultParking);
  }, [defaultLines, defaultDistance, defaultDuration, defaultWaiting, defaultToll, defaultParking]);

  const payload = useMemo(() => {
    const parseMaybe = (v: string) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      actual_waypoints: waypointLines
        .split('\n')
        .map((w) => w.trim())
        .filter(Boolean),
      actual_distance_km: parseMaybe(distanceKm),
      actual_duration_minutes: parseMaybe(durationMinutes),
      actual_waiting_minutes: parseMaybe(waitingMinutes),
      actual_toll: parseMaybe(actualToll),
      actual_parking: parseMaybe(actualParking),
      manual_adjustment_minor: toMinor(manualAdjustment),
      note: note.trim() || null,
    };
  }, [distanceKm, durationMinutes, manualAdjustment, note, actualParking, actualToll, waitingMinutes, waypointLines]);

  useEffect(() => {
    let aborted = false;
    const id = window.setTimeout(() => {
      (async () => {
        if (aborted) return;
        try {
          const res = await api.post(`/bookings/${bookingId}/fulfil-preview`, payload);
          if (!aborted) {
            setPreview(res.data?.breakdown ?? null);
          }
        } catch {
          if (!aborted) {
            setPreview({
              originalMinor,
              recalculatedMinor: originalMinor,
              finalMinor: originalMinor,
              deltaMinor: 0,
              waypoints: payload.actual_waypoints,
              waitingMinutes: payload.actual_waiting_minutes ?? 0,
              distanceKm: payload.actual_distance_km ?? Number(defaultDistance || 0),
              durationMinutes: payload.actual_duration_minutes ?? Number(defaultDuration || 0),
              actualTollMinor: toMinor(String(payload.actual_toll ?? 0)),
              actualParkingMinor: toMinor(String(payload.actual_parking ?? 0)),
              waitChargeMinor: 0,
              manualAdjustmentMinor: toMinor(manualAdjustment),
              extraWaitingMinutes: 0,
              leg1Minor,
              leg2Minor,
              combinedBeforeMultiplier,
              multiplierMode,
              multiplierValue,
            } as FulfilPreview);
          }
        }
      })();
    }, 250);
    return () => {
      aborted = true;
      window.clearTimeout(id);
    };
  }, [bookingId, payload, manualAdjustment, leg1Minor, leg2Minor, combinedBeforeMultiplier, multiplierMode, multiplierValue, originalMinor, defaultDistance, defaultDuration]);

  const effective = preview ?? {
    originalMinor,
    recalculatedMinor: originalMinor,
    finalMinor: originalMinor,
    deltaMinor: 0,
    waypoints: payload.actual_waypoints,
    waitingMinutes: payload.actual_waiting_minutes ?? 0,
    distanceKm: payload.actual_distance_km ?? 0,
    durationMinutes: payload.actual_duration_minutes ?? 0,
    actualTollMinor: 0,
    actualParkingMinor: 0,
    waitChargeMinor: 0,
    manualAdjustmentMinor: toMinor(manualAdjustment),
    extraWaitingMinutes: 0,
  };

  const isRouteImpacting = (leg1Minor != null && leg2Minor != null) || payload.actual_waypoints.length > 0 || (payload.actual_distance_km ?? 0) > 0;

  async function submit({ draft = false }: { draft?: boolean }) {
    setError(null);
    if (draft) setDraftSaving(true); else setSaving(true);

    const body = {
      ...payload,
      manual_adjustment_minor: effective.manualAdjustmentMinor,
    };

    try {
      if (draft) {
        await api.post(`/bookings/${bookingId}/fulfil`, {
          ...body,
          draft: true,
        });
        setDraftSaving(false);
        setSaving(false);
        onFulfilled();
        return;
      }

      const chargeBody = {
        ...body,
        extra_amount_minor: Math.max(0, effective.deltaMinor),
      };

      await api.post(`/bookings/${bookingId}/fulfil`, chargeBody);
      onFulfilled();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to fulfil booking');
    } finally {
      setSaving(false);
      setDraftSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Review & Fulfil</h3>
            <p className="text-xs text-gray-500 mt-0.5">{bookingRef}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 space-y-1.5 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase">Original Booking Snapshot (read-only)</p>
              <div className="text-sm text-gray-700">
                <p><span className="text-gray-500">Reference:</span> {bookingSnapshot?.booking_reference ?? bookingRef}</p>
                <p><span className="text-gray-500">Customer:</span> {customerName}</p>
                <p><span className="text-gray-500">Service:</span> {bookingSnapshot?.service_type_name ?? '—'} · {bookingSnapshot?.service_class_name ?? '—'}</p>
                <p><span className="text-gray-500">Pickup:</span> {bookingSnapshot?.pickup_address_text ?? '—'}</p>
                <p><span className="text-gray-500">Dropoff:</span> {bookingSnapshot?.dropoff_address_text ?? '—'}</p>
              </div>
              <div className="text-sm text-gray-700 border-t pt-2 mt-2 space-y-1">
                <p><span className="text-gray-500">Original waypoints:</span> {Array.isArray(bookingSnapshot?.waypoints) && bookingSnapshot.waypoints.length ? bookingSnapshot.waypoints.join(' → ') : '—'}</p>
                <p><span className="text-gray-500">Original waiting allowance:</span> {bookingSnapshot?.waiting_time_minutes ?? 0} min</p>
                <p className="font-medium"><span className="text-gray-500">Original total:</span> {fmt(bookingSnapshot?.pricing_snapshot?.final_fare_minor ?? originalMinor, currency)}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-700 uppercase">Actuals for review (editable)</p>
              <label className="text-xs text-gray-500">Actual waypoints (one per line)</label>
              <textarea
                rows={3}
                value={waypointLines}
                onChange={(e) => setWaypointLines(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">Distance (km)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </label>
                <label className="text-xs text-gray-500">Duration (min)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">Actual waiting (min)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={waitingMinutes}
                    onChange={(e) => setWaitingMinutes(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </label>
                <label className="text-xs text-gray-500">Manual adjustment
                  <input
                    type="number"
                    step="0.01"
                    value={manualAdjustment}
                    onChange={(e) => setManualAdjustment(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">Actual toll
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualToll}
                    onChange={(e) => setActualToll(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </label>
                <label className="text-xs text-gray-500">Actual parking
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualParking}
                    onChange={(e) => setActualParking(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </label>
              </div>

              <label className="text-xs text-gray-500">Internal note</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none"
                placeholder="e.g. Added one stop at Airport due to pickup delay"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Original amount</span>
              <span className="font-semibold">{fmt(effective.originalMinor, currency)}</span>
            </div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Recalculated (actual route/time + waiting/toll/parking)</span><span>{fmt(effective.recalculatedMinor, currency)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Manual adjustment</span><span>{fmt(effective.manualAdjustmentMinor, currency)}</span></div>
            <div className="flex justify-between text-sm text-gray-700"><span className="font-semibold">Final total</span><span className="font-semibold">{fmt(effective.finalMinor, currency)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Charge delta</span><span className={effective.deltaMinor >= 0 ? 'text-green-700' : 'text-amber-700'}>{fmt(effective.deltaMinor, currency)}</span></div>

            <div className="pt-2 border-t border-dashed mt-2 space-y-1 text-xs text-gray-600">
              <p><span className="font-medium">Impact details:</span></p>
              <p>Waypoints count: {effective.waypoints.length}</p>
              <p>Distance: {effective.distanceKm.toFixed(2)} km · Duration: {effective.durationMinutes} min</p>
              <p>Waiting: {effective.waitingMinutes} min (extra: {effective.extraWaitingMinutes} min) + {fmt(effective.waitChargeMinor, currency)}</p>
              <p>Toll/Parking: {fmt(effective.actualTollMinor, currency)} / {fmt(effective.actualParkingMinor, currency)}</p>
            </div>
          </div>

          {leg1Minor != null && leg2Minor != null && isRouteImpacting && (
            <div className="bg-white border rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Snapshot composition</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {(() => {
                  const snap = bookingSnapshot?.pricing_snapshot ?? {};
                  const leg1S = typeof snap.leg1_surcharge_minor === 'number' ? snap.leg1_surcharge_minor : 0;
                  const leg2S = typeof snap.leg2_surcharge_minor === 'number' ? snap.leg2_surcharge_minor : 0;
                  const toll = typeof snap.toll_minor === 'number' ? snap.toll_minor : 0;
                  const parking = typeof snap.parking_minor === 'number' ? snap.parking_minor : 0;
                  const discount = typeof snap.discount_amount_minor === 'number' ? snap.discount_amount_minor : 0;
                  const total = typeof snap.final_fare_minor === 'number' ? snap.final_fare_minor : 0;
                  return (
                    <>
                      <div className="flex justify-between"><span>Outbound price</span><span>{fmt(leg1Minor ?? 0, currency)}</span></div>
                      {leg1S > 0 && <div className="flex justify-between"><span>Outbound surcharge</span><span>{fmt(leg1S, currency)}</span></div>}
                      {toll > 0 && <div className="flex justify-between"><span>Outbound toll</span><span>{fmt(toll, currency)}</span></div>}
                      {parking > 0 && <div className="flex justify-between"><span>Outbound parking</span><span>{fmt(parking, currency)}</span></div>}
                      {leg2Minor != null && (
                        <>
                          <div className="flex justify-between"><span>Return price</span><span>{fmt(leg2Minor ?? 0, currency)}</span></div>
                          {leg2S > 0 && <div className="flex justify-between"><span>Return surcharge</span><span>{fmt(leg2S, currency)}</span></div>}
                          {toll > 0 && <div className="flex justify-between"><span>Return toll</span><span>{fmt(toll, currency)}</span></div>}
                          {parking > 0 && <div className="flex justify-between"><span>Return parking</span><span>{fmt(parking, currency)}</span></div>}
                        </>
                      )}
                      {discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{fmt(discount, currency)}</span></div>}
                      {total > 0 && <div className="flex justify-between"><span>Total</span><span>{fmt(total, currency)}</span></div>}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {driverReport && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Driver report (reference)</p>
              {driverReport.extra_waypoints?.length ? <p className="text-sm text-amber-800">📍 Extra stops: {driverReport.extra_waypoints.join(' → ')}</p> : null}
              {driverReport.waiting_minutes ? <p className="text-sm text-amber-800">⏱ Waiting: {driverReport.waiting_minutes} min</p> : null}
              {driverReport.extra_toll ? <p className="text-sm text-amber-800">🚗 Toll: {currency} {driverReport.extra_toll.toFixed(2)}</p> : null}
              {driverReport.extra_parking ? <p className="text-sm text-amber-800">🅿️ Parking: {currency} {driverReport.extra_parking.toFixed(2)}</p> : null}
              {driverReport.notes ? <p className="text-sm text-amber-800 italic">"{driverReport.notes}"</p> : null}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="px-6 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <button
            onClick={() => submit({ draft: true })}
            disabled={draftSaving || saving}
            className="border rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {draftSaving ? 'Saving…' : 'Save draft review'}
          </button>

          <button
            onClick={() => submit({ draft: false })}
            disabled={saving}
            className="border rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Mark no change / no extra
          </button>

          <button
            onClick={() => submit({ draft: false })}
            disabled={saving}
            className="bg-gray-900 hover:bg-black text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Processing…' : effective.deltaMinor > 0 ? 'Apply extra charge' : 'Mark fulfilled'}
          </button>

          <button
            onClick={() => onClose()}
            className="border rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
