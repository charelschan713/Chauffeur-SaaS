'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

const formSchema = z
  .object({
    service_class_id: z.string().min(1, 'Car type is required'),
    service_type_id: z.string().min(1, 'Service type is required'),
    city_id: z.string().min(1, 'City is required'),
    flight_number: z.string().optional(),
    customer_name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    customer_phone: z.string().trim().optional(),
    customer_email: z
      .string()
      .trim()
      .optional()
      .refine((val) => !val || /.+@.+\..+/.test(val), 'Invalid email address'),
    passenger_is_customer: z.boolean().default(true),
    passenger_first_name: z.string().trim().optional(),
    passenger_last_name: z.string().trim().optional(),
    passenger_phone: z.string().trim().optional(),
    pickup_address_text: z.string().trim().min(5, 'Pickup address must be at least 5 characters'),
    dropoff_address_text: z.string().trim().min(5, 'Dropoff address must be at least 5 characters'),
    waypoints: z.array(z.string()).default([]),
    pickup_at_utc: z.string().min(1, 'Pickup time is required'),
    is_return_trip: z.boolean().default(false),
    return_pickup_at_utc: z.string().optional(),
    return_pickup_address_text: z.string().optional(),
    timezone: z.string().trim().min(1, 'Timezone is required'),
    passenger_count: z.coerce.number().int().min(1).max(14),
    luggage_count: z.coerce.number().int().min(0).max(20).optional(),
    special_requests: z.string().max(500, 'Max 500 characters').optional(),
    infant_seats: z.coerce.number().int().min(0).max(3).default(0),
    toddler_seats: z.coerce.number().int().min(0).max(3).default(0),
    booster_seats: z.coerce.number().int().min(0).max(3).default(0),
  })
  .superRefine((values, ctx) => {
    if (!values.passenger_is_customer) {
      if (!values.passenger_first_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Passenger first name is required',
          path: ['passenger_first_name'],
        });
      }
      if (!values.passenger_last_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Passenger last name is required',
          path: ['passenger_last_name'],
        });
      }
      if (!values.passenger_phone?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Passenger phone is required',
          path: ['passenger_phone'],
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; distanceKm: number; durationMinutes: number; estimates: Record<string, number> };

function toDisplay(minor: number) {
  return (minor / 100).toFixed(2);
}

const TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'UTC',
];

export default function CreateBookingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  const [waypoints, setWaypoints] = useState<string[]>([]);

  const { data: carTypes = [] } = useQuery({
    queryKey: ['car-types'],
    queryFn: async () => {
      const res = await api.get('/pricing/service-classes');
      return res.data ?? [];
    },
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await api.get('/service-types');
      return res.data ?? [];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const res = await api.get('/cities');
      return res.data ?? [];
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      service_class_id: '',
      service_type_id: '',
      city_id: '',
      flight_number: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      pickup_address_text: '',
      dropoff_address_text: '',
      waypoints: [],
      pickup_at_utc: '',
      is_return_trip: false,
      return_pickup_at_utc: '',
      return_pickup_address_text: '',
      timezone: 'Australia/Sydney',
      passenger_count: 1,
      luggage_count: 0,
      special_requests: '',
      infant_seats: 0,
      toddler_seats: 0,
      booster_seats: 0,
    },
    mode: 'onBlur',
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const [firstName, ...rest] = values.customer_name.trim().split(' ');
      const payload = {
        customer: {
          firstName,
          lastName: rest.join(' ') || 'Customer',
          email: values.customer_email?.trim() || undefined,
          phone: values.customer_phone?.trim() || undefined,
        },
        pickup: { address: values.pickup_address_text.trim() },
        dropoff: { address: values.dropoff_address_text.trim() },
        pickupAtUtc: new Date(values.pickup_at_utc).toISOString(),
        timezone: values.timezone || 'Australia/Sydney',
        is_return_trip: values.is_return_trip,
        return_pickup_at_utc: values.return_pickup_at_utc
          ? new Date(values.return_pickup_at_utc).toISOString()
          : undefined,
        return_pickup_address_text: values.return_pickup_address_text?.trim() || undefined,
        passengerCount: values.passenger_count,
        luggageCount: values.luggage_count ?? 0,
        specialRequests: values.special_requests?.trim() || undefined,
        bookingSource: 'ADMIN' as const,
        service_class_id: values.service_class_id,
        service_type_id: values.service_type_id,
        city_id: values.city_id,
        flight_number: values.flight_number?.trim() || undefined,
        waypoints: waypoints.map((w) => ({ address: w })),
        infant_seats: values.infant_seats,
        toddler_seats: values.toddler_seats,
        booster_seats: values.booster_seats,
      };
      const response = await api.post('/bookings', payload);
      return response.data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      const bookingId = response?.data?.id ?? response?.data?.booking?.id;
      if (bookingId) {
        router.push(`/bookings/${bookingId}`);
      } else {
        router.push('/bookings');
      }
    },
  });

  const values = watch();
  const selectedCarType = useMemo(
    () => carTypes.find((c: any) => c.id === values.service_class_id),
    [carTypes, values.service_class_id],
  );
  const selectedServiceType = useMemo(
    () => serviceTypes.find((s: any) => s.id === values.service_type_id),
    [serviceTypes, values.service_type_id],
  );
  const selectedCity = useMemo(
    () => cities.find((c: any) => c.id === values.city_id),
    [cities, values.city_id],
  );

  async function handleGetQuote() {
    if (!values.service_type_id || !values.city_id || !values.pickup_address_text || !values.dropoff_address_text || !values.pickup_at_utc) {
      setQuote({ status: 'error', message: 'Please complete Service, Date & Time, and Route before quoting.' });
      return;
    }
    setQuote({ status: 'loading' });
    try {
      const routeRes = await api.get('/maps/route', {
        params: {
          origin: values.pickup_address_text,
          destination: values.dropoff_address_text,
        },
      });
      if (!routeRes.data || !routeRes.data.distanceKm) {
        setQuote({
          status: 'error',
          message: 'Route calculation unavailable. Please contact your administrator to configure Google Maps integration.',
        });
        return;
      }

      const classesRes = await api.get('/pricing/service-classes');
      const classes = classesRes.data ?? [];

      const estimates: Record<string, number> = {};
      for (const c of classes) {
        const estimateRes = await api.post('/pricing/estimate', {
          service_class_id: c.id,
          service_type_id: values.service_type_id,
          distance_km: routeRes.data.distanceKm,
          duration_minutes: routeRes.data.durationMinutes,
          passenger_count: values.passenger_count,
          luggage_count: values.luggage_count ?? 0,
        });
        estimates[c.id] = estimateRes.data?.grand_total_minor ?? estimateRes.data?.total_minor ?? 0;
      }

      setQuote({
        status: 'success',
        distanceKm: routeRes.data.distanceKm,
        durationMinutes: routeRes.data.durationMinutes,
        estimates,
      });
    } catch {
      setQuote({
        status: 'error',
        message: 'Route calculation unavailable. Please contact your administrator to configure Google Maps integration.',
      });
    }
  }

  const onSubmit = handleSubmit((vals) => mutation.mutate(vals));

  const canQuote = Boolean(
    values.service_type_id && values.city_id && values.pickup_address_text && values.dropoff_address_text && values.pickup_at_utc,
  );

  return (
    <div className="space-y-4">
      {mutation.isError && <ErrorAlert message="Failed to create booking. Please try again." />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border rounded p-5 sticky top-6">
            <h2 className="font-semibold mb-4">Customer & Passenger</h2>

            <div className="space-y-3">
              <Field label="Customer Name" error={errors.customer_name?.message}>
                <input
                  {...register('customer_name')}
                  placeholder="e.g. Jane Doe"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Phone" error={errors.customer_phone?.message}>
                <input
                  {...register('customer_phone')}
                  placeholder="Optional"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Email" error={errors.customer_email?.message}>
                <input
                  {...register('customer_email')}
                  placeholder="Optional"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="mt-4 space-y-3">
              <label className="text-sm font-medium text-gray-700 space-y-1">
                <span>Passenger is customer?</span>
                <input type="checkbox" {...register('passenger_is_customer')} className="h-4 w-4" />
              </label>
              {!values.passenger_is_customer && (
                <div className="space-y-3">
                  <Field label="Passenger First Name" error={errors.passenger_first_name?.message}>
                    <input
                      {...register('passenger_first_name')}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Passenger Last Name" error={errors.passenger_last_name?.message}>
                    <input
                      {...register('passenger_last_name')}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Passenger Phone" error={errors.passenger_phone?.message}>
                    <input
                      {...register('passenger_phone')}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-4">
          <AccordionCard title="Service" summary={selectedCity?.name && selectedServiceType?.display_name ? `${selectedCity.name} · ${selectedServiceType.display_name}` : 'Select city and service type'}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Service City</label>
                <select
                  value={values.city_id}
                  onChange={(e) => setValue('city_id', e.target.value, { shouldValidate: true })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select a city</option>
                  {cities.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.city_id && <p className="text-xs text-red-600 mt-1">{errors.city_id.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Service Type</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {serviceTypes.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setValue('service_type_id', s.id, { shouldValidate: true })}
                      className={`border rounded p-3 text-left ${values.service_type_id === s.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="font-medium">{s.display_name ?? s.name}</div>
                      <div className="text-xs text-gray-500">{s.calculation_type ?? s.calc_type ?? 'PTP'}</div>
                    </button>
                  ))}
                </div>
                {errors.service_type_id && <p className="text-xs text-red-600 mt-2">{errors.service_type_id.message}</p>}
              </div>
            </div>
          </AccordionCard>

          <AccordionCard title="Date & Time" summary={values.pickup_at_utc ? `${new Date(values.pickup_at_utc).toLocaleDateString()} ${new Date(values.pickup_at_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${values.timezone}` : 'Select pickup time'}>
            <div className="space-y-4">
              <Field label="Pickup Date & Time" error={errors.pickup_at_utc?.message}>
                <input type="datetime-local" {...register('pickup_at_utc')} className="w-full border rounded px-3 py-2 text-sm" />
              </Field>
              <Field label="Timezone" error={errors.timezone?.message}>
                <select {...register('timezone')} className="w-full border rounded px-3 py-2 text-sm">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>
              <Field label="Flight Number">
                <input
                  {...register('flight_number')}
                  placeholder="e.g. QF401"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
              <label className="text-sm font-medium text-gray-700 space-y-1">
                <span>Is Return Trip?</span>
                <input type="checkbox" {...register('is_return_trip')} className="h-4 w-4" />
              </label>
              {values.is_return_trip && (
                <Field label="Return Date & Time" error={errors.return_pickup_at_utc?.message}>
                  <input type="datetime-local" {...register('return_pickup_at_utc')} className="w-full border rounded px-3 py-2 text-sm" />
                </Field>
              )}
            </div>
          </AccordionCard>

          <AccordionCard
            title="Route"
            summary={
              values.pickup_address_text && values.dropoff_address_text
                ? waypoints.length > 0
                  ? `${values.pickup_address_text} → ${waypoints.length} stops → ${values.dropoff_address_text}`
                  : `${values.pickup_address_text} → ${values.dropoff_address_text}`
                : 'Enter route'
            }
          >
            <div className="space-y-4">
              <Field label="Pickup Address" error={errors.pickup_address_text?.message}>
                <input
                  {...register('pickup_address_text')}
                  placeholder="123 George St, Sydney"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Waypoints</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (waypoints.length < 5) {
                        setWaypoints((prev) => [...prev, '']);
                      }
                    }}
                    className="text-sm text-blue-600"
                  >
                    + Add Stop
                  </button>
                </div>
                {waypoints.map((wp, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={wp}
                        onChange={(e) => {
                          const next = [...waypoints];
                          next[idx] = e.target.value;
                          setWaypoints(next);
                        }}
                        placeholder={`Stop ${idx + 1} address`}
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setWaypoints((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-gray-500"
                      >
                        ×
                      </button>
                    </div>
                    {idx < waypoints.length - 1 && <div className="text-center text-gray-400">↓</div>}
                  </div>
                ))}
              </div>

              <Field label="Dropoff Address" error={errors.dropoff_address_text?.message}>
                <input
                  {...register('dropoff_address_text')}
                  placeholder="Airport or destination"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </AccordionCard>

          <AccordionCard
            title="Requirements"
            summary={`${values.passenger_count} pax · ${values.luggage_count ?? 0} bags`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Passenger Count" error={errors.passenger_count?.message}>
                <input type="number" min={1} max={14} {...register('passenger_count', { valueAsNumber: true })} className="w-full border rounded px-3 py-2 text-sm" />
              </Field>
              <Field label="Luggage Count" error={errors.luggage_count?.message}>
                <input type="number" min={0} max={20} {...register('luggage_count', { valueAsNumber: true })} className="w-full border rounded px-3 py-2 text-sm" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Special Requests" error={errors.special_requests?.message}>
                  <textarea
                    {...register('special_requests')}
                    rows={4}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="Optional notes for the driver"
                  />
                </Field>
              </div>
            </div>
          </AccordionCard>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGetQuote}
              disabled={!canQuote}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              {quote.status === 'loading' ? 'Calculating...' : 'Get Quote'}
            </button>
            {quote.status === 'success' && (
              <span className="text-sm text-green-700">{quote.distanceKm.toFixed(1)} km · {quote.durationMinutes} min</span>
            )}
          </div>

          {quote.status === 'error' && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
              {quote.message}
            </div>
          )}

          {quote.status === 'success' && (
            <AccordionCard title="Select Car Type" summary={selectedCarType ? `${selectedCarType.name} · $${toDisplay(quote.estimates[selectedCarType.id] ?? 0)}` : 'Select a car type'}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {carTypes.map((c: any) => {
                  const price = quote.estimates[c.id] ?? 0;
                  const insufficient = (c.passenger_capacity ?? 0) < values.passenger_count || (c.luggage_capacity ?? 0) < (values.luggage_count ?? 0);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={insufficient}
                      onClick={() => setValue('service_class_id', c.id, { shouldValidate: true })}
                      className={`border rounded p-3 text-left ${values.service_class_id === c.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'} ${insufficient ? 'opacity-50' : ''}`}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-sm text-gray-700">${toDisplay(price)}</div>
                      <div className="text-xs text-gray-500">🧍 {c.passenger_capacity ?? 0} · 🧳 {c.luggage_capacity ?? 0}</div>
                    </button>
                  );
                })}
              </div>
              {errors.service_class_id && <p className="text-xs text-red-600 mt-2">{errors.service_class_id.message}</p>}
            </AccordionCard>
          )}

          {quote.status === 'success' && selectedCarType && (
            <AccordionCard title="Extra Options" summary={
              `Infant ${values.infant_seats} · Toddler ${values.toddler_seats} · Booster ${values.booster_seats}`
            }>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label={`Infant Seat ($${toDisplay(selectedCarType.infant_seat_minor ?? 0)})`}>
                  <input type="number" min={0} max={3} {...register('infant_seats', { valueAsNumber: true })} className="w-full border rounded px-3 py-2 text-sm" />
                </Field>
                <Field label={`Toddler Seat ($${toDisplay(selectedCarType.toddler_seat_minor ?? 0)})`}>
                  <input type="number" min={0} max={3} {...register('toddler_seats', { valueAsNumber: true })} className="w-full border rounded px-3 py-2 text-sm" />
                </Field>
                <Field label={`Booster Seat ($${toDisplay(selectedCarType.booster_seat_minor ?? 0)})`}>
                  <input type="number" min={0} max={3} {...register('booster_seats', { valueAsNumber: true })} className="w-full border rounded px-3 py-2 text-sm" />
                </Field>
              </div>
            </AccordionCard>
          )}

          {quote.status === 'success' && selectedCarType && selectedServiceType && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={mutation.isPending}
              className="px-4 py-2 rounded bg-green-600 text-white text-sm"
            >
              {mutation.isPending ? 'Creating...' : 'Create Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-gray-700 space-y-1">
      <span>{label}</span>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </label>
  );
}

function AccordionCard({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-gray-500">{summary}</span>
      </div>
      {children}
    </div>
  );
}
