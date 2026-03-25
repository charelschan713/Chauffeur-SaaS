'use client';
import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {LoadingSpinner, PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Toast } from '@/components/ui/Toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { formatStatus } from '@/lib/ui/formatStatus';

type Booking = {
  id: string;
  booking_reference: string;
  pickup_at_utc?: string | null;
  pickup_address_text?: string | null;
  dropoff_address_text?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  passenger_name?: string | null;
  operational_status?: string | null;
  total_price_minor?: number | null;
  currency?: string | null;
  service_class_name?: string | null;
  job_type?: 'NORMAL' | 'DRIVER_JOB' | null;
  service_type_name?: string | null;
  passenger_count?: number | null;
  luggage_count?: number | null;
};

type Driver = {
  id: string;
  driver_id?: string;   // alias used by some endpoints
  full_name: string;
  vehicle_label?: string | null;
  status?: string | null;
  availability_status?: string | null;
  last_seen_at?: string | null;
};

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function shortAddress(value?: string | null) {
  if (!value) return '—';
  return value.length > 40 ? `${value.slice(0, 40)}…` : value;
}

function relativeTime(value?: string | null) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function DispatchBoardInner() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingParam = searchParams?.get('booking_id');
  const returnParam = searchParams?.get('return');

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchVehicle, setSearchVehicle] = useState('');
  const [searchBooking, setSearchBooking] = useState('');
  const [searchDriver, setSearchDriver] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [offerState, setOfferState] = useState<Record<string, 'NONE' | 'OFFERED' | 'FAILED'>>({});
  const [bookingNotFound, setBookingNotFound] = useState(false);

  const { data: bookingsData, isLoading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useQuery({
    queryKey: ['dispatch-bookings'],
    queryFn: async () => {
      const res = await api.get('/bookings', { params: { operational_status: 'CONFIRMED' } });
      return res.data ?? [];
    },
  });

  const { data: driversData, isLoading: driversLoading, error: driversError, refetch: refetchDrivers } = useQuery({
    queryKey: ['dispatch-drivers'],
    queryFn: async () => {
      const res = await api.get('/drivers');
      return res.data ?? [];
    },
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['dispatch-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles');
      return res.data ?? [];
    },
  });

  const bookings: Booking[] = Array.isArray(bookingsData)
    ? bookingsData
    : (bookingsData?.data ?? []);
  const drivers: Driver[] = Array.isArray(driversData)
    ? driversData
    : (driversData?.data ?? []);
  const vehicles: any[] = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.data ?? []);

  useEffect(() => {
    if (!bookingParam || bookings.length === 0) return;
    const match = bookings.find((b) => b.id === bookingParam);
    if (match) {
      setSelectedBookingId(match.id);
      setBookingNotFound(false);
    } else {
      setBookingNotFound(true);
    }
  }, [bookingParam, bookings]);

  const filteredBookings = useMemo(() => {
    const q = searchBooking.toLowerCase();
    return bookings.filter((b) =>
      [b.booking_reference, b.customer_first_name, b.customer_last_name, b.passenger_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [bookings, searchBooking]);

  const filteredDrivers = useMemo(() => {
    const q = searchDriver.toLowerCase();
    return drivers.filter((d) => d.full_name?.toLowerCase().includes(q));
  }, [drivers, searchDriver]);

  const filteredVehicles = useMemo(() => {
    const q = searchVehicle.toLowerCase();
    return vehicles.filter((v) =>
      `${v.make} ${v.model} ${v.plate} ${v.colour ?? ''}`.toLowerCase().includes(q)
    ).filter((v) => v.active);
  }, [vehicles, searchVehicle]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) ?? null;
  // Drivers may return either `id` or `driver_id` depending on endpoint
  const driverId = (d: Driver) => d.driver_id ?? d.id;
  const selectedDriver = drivers.find((d) => driverId(d) === selectedDriverId) ?? null;
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  const offerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBookingId || !selectedDriverId) return;
      await api.post('/dispatch/offer', {
        bookingId: selectedBookingId,
        driverId: selectedDriverId,
        vehicleId: selectedVehicleId ?? undefined,
      });
    },
    onSuccess: () => {
      if (selectedBookingId) {
        setOfferState((prev) => ({ ...prev, [selectedBookingId]: 'OFFERED' }));
      }
      setToast({ message: 'Offer sent', tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['dispatch-bookings'] });
    },
    onError: () => {
      if (selectedBookingId) {
        setOfferState((prev) => ({ ...prev, [selectedBookingId]: 'FAILED' }));
      }
      setToast({ message: 'Offer failed', tone: 'error' });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch" description="Assign confirmed bookings to available drivers" />

      {bookingsError && <ErrorAlert message="Unable to load bookings" onRetry={refetchBookings} />}
      {driversError && <ErrorAlert message="Unable to load drivers" onRetry={refetchDrivers} />}

      {bookingNotFound && (
        <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-4 py-2 text-sm">
          This booking is not in CONFIRMED dispatch queue.
        </div>
      )}

      <div className="bg-white border rounded p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className={selectedBooking ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selectedBooking ? `📋 ${selectedBooking.booking_reference}` : '📋 Select booking'}
          </span>
          <span className="text-gray-300">·</span>
          <span className={selectedDriver ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selectedDriver ? `👤 ${selectedDriver.full_name}` : '👤 Select driver'}
          </span>
          <span className="text-gray-300">·</span>
          <span className={selectedVehicle ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selectedVehicle
              ? `🚘 ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.plate}`
              : '🚘 Select vehicle (optional)'}
          </span>
        </div>
        <Button
          disabled={!selectedBookingId || !selectedDriverId || offerMutation.isPending}
          onClick={() => offerMutation.mutate()}
        >
          {offerMutation.isPending ? 'Sending...' : 'Send Offer'}
        </Button>
      </div>

      {offerState[selectedBookingId ?? ''] === 'OFFERED' && returnParam && selectedBooking && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700 font-medium">
              Offer sent for {selectedBooking.booking_reference}
            </span>
            <Button variant="secondary" onClick={() => router.push(`${returnParam}?assigned=1`)}>
              Return to booking
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title={`Unassigned Bookings (${filteredBookings.length})`}
        >
          <div className="mb-3">
            <Input
              value={searchBooking}
              onChange={(e) => setSearchBooking(e.target.value)}
              placeholder="Search bookings"
            />
          </div>
          {bookingsLoading ? (
            <div className="flex items-center justify-center h-40"><LoadingSpinner /></div>
          ) : filteredBookings.length === 0 ? (
            <EmptyState title="No confirmed bookings waiting for dispatch" />
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
              {filteredBookings.map((b) => {
                const customer = b.passenger_name || `${b.customer_first_name ?? ''} ${b.customer_last_name ?? ''}`.trim();
                const offerStatus = offerState[b.id] ?? 'NONE';
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBookingId(b.id)}
                    className={`w-full text-left border rounded p-3 transition ${
                      selectedBookingId === b.id ? 'ring-2 ring-blue-600 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{b.booking_reference}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">CONFIRMED</Badge>
                        {offerStatus === 'OFFERED' && <Badge variant="success">OFFERED</Badge>}
                        {offerStatus === 'FAILED' && <Badge variant="danger">FAILED</Badge>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{formatTime(b.pickup_at_utc)}</div>
                    <div className="text-sm text-gray-700">{shortAddress(b.pickup_address_text)} → {shortAddress(b.dropoff_address_text)}</div>
                    <div className="text-xs text-gray-500">{customer || '—'}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">{b.currency} {((b.total_price_minor ?? 0) / 100).toFixed(2)}</span>
                      {b.service_class_name && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {b.service_class_name}
                        </span>
                      )}
                      {b.passenger_count != null && b.passenger_count > 0 && (
                        <span className="text-xs text-gray-400">👤 {b.passenger_count}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card title={`Drivers (${filteredDrivers.length})`}>
          <div className="mb-3">
            <Input
              value={searchDriver}
              onChange={(e) => setSearchDriver(e.target.value)}
              placeholder="Search by name…"
            />
          </div>
          {driversLoading ? (
            <div className="flex items-center justify-center h-40"><LoadingSpinner /></div>
          ) : filteredDrivers.length === 0 ? (
            <EmptyState title="No drivers found" description="Add drivers in the Drivers page." />
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
              {filteredDrivers.map((d) => {
                return (
                  <button
                    key={driverId(d)}
                    onClick={() => setSelectedDriverId(driverId(d) ?? null)}
                    className={`w-full text-left border rounded p-3 transition ${
                      selectedDriverId === driverId(d) ? 'ring-2 ring-blue-600 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{d.full_name}</div>
                    {d.vehicle_label && <div className="text-xs text-gray-500 mt-0.5">{d.vehicle_label}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Vehicles column */}
        <Card title={`Vehicles (${filteredVehicles.length})`}>
          <div className="mb-3">
            <Input
              value={searchVehicle}
              onChange={(e) => setSearchVehicle(e.target.value)}
              placeholder="Search make, model, plate…"
            />
          </div>
          {filteredVehicles.length === 0 ? (
            <EmptyState title="No vehicles found" description="Add vehicles in the Vehicles page." />
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
              {filteredVehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicleId(v.id === selectedVehicleId ? null : v.id)}
                  className={`w-full text-left border rounded p-3 transition ${
                    selectedVehicleId === v.id ? 'ring-2 ring-blue-600 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{v.make} {v.model}</div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                      {v.plate}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {v.colour && <span>{v.colour} · </span>}
                    {v.year && <span>{v.year} · </span>}
                    {v.passenger_capacity && <span>👥 {v.passenger_capacity} pax</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default function DispatchBoardPage() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingSpinner /></div>}>
      <DispatchBoardInner />
    </Suspense>
  );
}
