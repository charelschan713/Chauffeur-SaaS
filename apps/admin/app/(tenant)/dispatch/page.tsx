'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ConsoleLayout } from '@/components/patterns/Console';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

interface Booking {
  id: string;
  booking_reference: string;
  customer_first_name: string;
  customer_last_name: string;
  pickup_address_text: string;
  dropoff_address_text: string;
  pickup_at_utc: string;
  passenger_count?: number;
  operational_status: string;
}

interface Driver {
  driver_id: string;
  full_name: string;
  email: string;
  availability_status: string;
}

export default function DispatchConsolePage() {
  const queryClient = useQueryClient();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const bookingsQuery = useQuery({
    queryKey: ['dispatch-bookings'],
    queryFn: async () => {
      const response = await api.get('/bookings', {
        params: { operational_status: 'CONFIRMED' },
      });
      return response.data.data as Booking[];
    },
    refetchInterval: 15000,
  });

  const driversQuery = useQuery({
    queryKey: ['drivers-available'],
    queryFn: async () => {
      const response = await api.get('/drivers/available');
      return response.data.data as Driver[];
    },
    refetchInterval: 15000,
  });

  const bookings = bookingsQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const selectedBooking = useMemo(() => bookings.find((b) => b.id === selectedBookingId), [bookings, selectedBookingId]);

  const offerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBookingId || !selectedDriverId) return;
      await api.post('/dispatch/offer', {
        bookingId: selectedBookingId,
        driverId: selectedDriverId,
        vehicleId: vehicleId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['drivers-available'] });
      setStatusMessage('Driver offered successfully');
      setSelectedDriverId(null);
      setVehicleId('');
    },
    onError: () => {
      setStatusMessage('Failed to offer driver');
    },
  });

  const queuePanel = (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const isSelected = booking.id === selectedBookingId;
        return (
          <button
            key={booking.id}
            onClick={() => {
              setSelectedBookingId(booking.id);
              setStatusMessage('');
            }}
            className={`w-full text-left border rounded-lg px-4 py-3 text-sm ${
              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{booking.booking_reference}</p>
              <span className="text-xs text-gray-500">
                {new Date(booking.pickup_at_utc).toLocaleString()}
              </span>
            </div>
            <p className="text-gray-600">
              {booking.customer_first_name} {booking.customer_last_name}
            </p>
            <p className="text-xs text-gray-500 line-clamp-1">{booking.pickup_address_text}</p>
          </button>
        );
      })}
      {bookings.length === 0 && !bookingsQuery.isLoading && (
        <p className="text-sm text-gray-500 text-center">No confirmed bookings awaiting dispatch.</p>
      )}
    </div>
  );

  const workspacePanel = selectedBooking ? (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs uppercase text-gray-500">Pickup</p>
        <p className="font-medium">{selectedBooking.pickup_address_text}</p>
        <p className="text-xs text-gray-500">
          {new Date(selectedBooking.pickup_at_utc).toLocaleString()}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase text-gray-500">Dropoff</p>
        <p className="font-medium">{selectedBooking.dropoff_address_text}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-gray-500">Passengers</p>
        <p className="font-medium">{selectedBooking.passenger_count ?? 'N/A'}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-gray-500">Status</p>
        <p className="font-medium">{selectedBooking.operational_status}</p>
      </div>
    </div>
  ) : (
    <div className="h-full flex items-center justify-center text-sm text-gray-500">
      Select a booking to view details
    </div>
  );

  const resourcesPanel = (
    <div className="space-y-4">
      <div className="space-y-3">
        {drivers.map((driver) => {
          const isSelected = driver.driver_id === selectedDriverId;
          return (
            <button
              key={driver.driver_id}
              onClick={() => {
                setSelectedDriverId(driver.driver_id);
                setStatusMessage('');
              }}
              className={`w-full text-left border rounded-lg px-4 py-3 text-sm ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <p className="font-semibold">{driver.full_name}</p>
              <p className="text-xs text-gray-500">{driver.email}</p>
              <span className="text-xs text-gray-400">{driver.availability_status}</span>
            </button>
          );
        })}
        {drivers.length === 0 && !driversQuery.isLoading && (
          <p className="text-sm text-gray-500 text-center">No available drivers</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase text-gray-500">Vehicle ID (optional)</label>
        <input
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          placeholder="Vehicle UUID"
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={() => offerMutation.mutate()}
        disabled={!selectedBookingId || !selectedDriverId || offerMutation.isPending}
        className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {offerMutation.isPending ? 'Offering...' : 'Offer Driver'}
      </button>

      {statusMessage && (
        <p className="text-xs text-gray-600 text-center">{statusMessage}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {(bookingsQuery.isError || driversQuery.isError) && (
        <ErrorAlert message="Unable to load dispatch data" />
      )}

      <ConsoleLayout
        header={<h2 className="text-xl font-semibold text-gray-900">Dispatch Console</h2>}
        queue={
          bookingsQuery.isLoading ? (
            <div className="text-sm text-gray-500">Loading bookings...</div>
          ) : (
            queuePanel
          )
        }
        workspace={workspacePanel}
        resources={
          driversQuery.isLoading ? (
            <div className="text-sm text-gray-500">Loading drivers...</div>
          ) : (
            resourcesPanel
          )
        }
      />
    </div>
  );
}
