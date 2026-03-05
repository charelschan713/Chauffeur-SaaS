'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { formatBookingTime } from '@/lib/format-datetime';
import { Select } from '@/components/ui/Select';
import { PhoneSplitField } from '@/components/ui/PhoneSplitField';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import { LoadingSpinner, InlineSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { useBookingWizardStore } from '@/lib/ui/useBookingWizardStore';

const formSchema = z
  .object({
    service_class_id: z.string().min(1, 'Car type is required'),
    service_type_id: z.string().min(1, 'Service type is required'),
    city_id: z.string().min(1, 'City is required'),
    flight_number: z.string().optional(),
    customer_name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    customer_phone_country_code: z.string().default('+61'),
    customer_phone_number: z.string().trim().optional(),
    customer_email: z
      .string()
      .trim()
      .optional()
      .refine((val) => !val || /.+@.+\..+/.test(val), 'Invalid email address'),
    passenger_is_customer: z.boolean().default(true),
    passenger_first_name: z.string().trim().optional(),
    passenger_last_name: z.string().trim().optional(),
    passenger_phone_country_code: z.string().default('+61'),
    passenger_phone_number: z.string().trim().optional(),
    pickup_address_text: z.string().trim().min(2, 'Pickup address must be at least 2 characters'),
    dropoff_address_text: z.string().trim().min(2, 'Dropoff address must be at least 2 characters'),
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
      if (!values.passenger_phone_number?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Passenger phone is required',
          path: ['passenger_phone_number'],
        });
      }
    }
    // Return trip: return time must be after outbound pickup time
    if (values.is_return_trip && values.return_pickup_at_utc && values.pickup_at_utc) {
      const outbound = new Date(values.pickup_at_utc).getTime();
      const ret = new Date(values.return_pickup_at_utc).getTime();
      if (ret <= outbound) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Return time must be after the outbound pickup time',
          path: ['return_pickup_at_utc'],
        });
      }
    }
    // Return trip: return time is required if is_return_trip is checked
    if (values.is_return_trip && !values.return_pickup_at_utc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Return pickup time is required',
        path: ['return_pickup_at_utc'],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; distanceKm: number; durationMinutes: number; estimates: Record<string, number>; tolls: Record<string, number> };

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

const SECTIONS = ['service', 'datetime', 'route', 'requirements', 'car', 'extras'] as const;

export default function CreateBookingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state: wizardState, update: updateWizard, reset: resetWizard } = useBookingWizardStore();
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLabel, setSearchLabel] = useState('Recent Customers');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [saveAsPassenger, setSaveAsPassenger] = useState(false);
  const [passengerLabel, setPassengerLabel] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickupPlaceId, setPickupPlaceId] = useState('');
  const [dropoffPlaceId, setDropoffPlaceId] = useState('');
  const [returnPickupPlaceId, setReturnPickupPlaceId] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>(wizardState.waypoints ?? []);
  const [activeSection, setActiveSection] = useState(wizardState.activeSection ?? 'service');

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
    trigger,
    reset,
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
      customer_phone_country_code: '+61',
      customer_phone_number: '',
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
      ...(wizardState.values ?? {}),
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    updateWizard({ activeSection, waypoints });
  }, [activeSection, waypoints, updateWizard]);

  useEffect(() => {
    const subscription = watch((vals) => {
      updateWizard({ values: vals as Record<string, any> });
    });
    return () => subscription.unsubscribe();
  }, [watch, updateWizard]);

  // Load recent customers on mount
  useEffect(() => {
    api.get('/customers?limit=5&sort=recent').then((res) => {
      const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setCustomerResults(data);
      setSearchLabel('Recent Customers');
    });
  }, []);

  // ── Clear All ────────────────────────────────────────────────────────────
  function clearAll() {
    reset({
      service_class_id: '', service_type_id: '', city_id: '', flight_number: '',
      customer_name: '', customer_phone_country_code: '+61', customer_phone_number: '', customer_email: '',
      pickup_address_text: '', dropoff_address_text: '', waypoints: [],
      pickup_at_utc: '', is_return_trip: false, return_pickup_at_utc: '', return_pickup_address_text: '',
      timezone: 'Australia/Sydney', passenger_count: 1, luggage_count: 0, special_requests: '',
      infant_seats: 0, toddler_seats: 0, booster_seats: 0,
    });
    setWaypoints([]);
    setPickupPlaceId('');
    setDropoffPlaceId('');
    setSelectedCustomerId(null);
    setSaveAsPassenger(false);
    setPassengerLabel('');
    setCustomerSearch('');
    setActiveSection('service');
    resetWizard();
  }

  // Debounced customer search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!customerSearch.trim()) {
      setSearchLabel('Recent Customers');
      api.get('/customers?limit=5&sort=recent').then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setCustomerResults(data);
      });
      return;
    }
    setSearchLabel('Search Results');
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/customers?search=${encodeURIComponent(customerSearch.trim())}&limit=8`);
        const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setCustomerResults(data);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [customerSearch]);

  function selectCustomer(c: any) {
    setValue('customer_name', `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim());
    setValue('customer_email', c.email ?? '');
    setValue('customer_phone_country_code', c.phone_country_code ?? '+61');
    setValue('customer_phone_number', c.phone_number ?? '');
    setSelectedCustomerId(c.id ?? null);
    setCustomerSearch('');
    setCustomerResults([]);
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const [firstName, ...rest] = values.customer_name.trim().split(' ');
      const payload = {
        customer: {
          firstName,
          lastName: rest.join(' ') || 'Customer',
          email: values.customer_email?.trim() || undefined,
          phone_country_code: values.customer_phone_country_code || '+61',
          phone_number: values.customer_phone_number?.trim() || undefined,
        },
        pickup: { address: values.pickup_address_text.trim(), place_id: pickupPlaceId || undefined },
        dropoff: { address: values.dropoff_address_text.trim(), place_id: dropoffPlaceId || undefined },
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
        passenger_phone_country_code: values.passenger_is_customer
          ? (values.customer_phone_country_code || '+61')
          : (values.passenger_phone_country_code || '+61'),
        passenger_phone_number: values.passenger_is_customer
          ? (values.customer_phone_number?.trim() || undefined)
          : (values.passenger_phone_number?.trim() || undefined),
        infant_seats: values.infant_seats,
        toddler_seats: values.toddler_seats,
        booster_seats: values.booster_seats,
      };
      const response = await api.post('/bookings', payload);

      // Save passenger profile if opted in and a known customer is selected
      if (saveAsPassenger && selectedCustomerId) {
        const v = values;
        const isPassengerCustomer = v.passenger_is_customer;
        const pFirstName = isPassengerCustomer
          ? payload.customer.firstName
          : (v.passenger_first_name ?? payload.customer.firstName);
        const pLastName = isPassengerCustomer
          ? payload.customer.lastName
          : (v.passenger_last_name ?? payload.customer.lastName);
        const pPhoneCountry = isPassengerCustomer
          ? (v.customer_phone_country_code || '+61')
          : (v.passenger_phone_country_code || '+61');
        const pPhoneNumber = isPassengerCustomer
          ? v.customer_phone_number
          : v.passenger_phone_number;

        await api.post(`/customers/${selectedCustomerId}/passengers`, {
          first_name: pFirstName,
          last_name: pLastName,
          phone_country_code: pPhoneCountry || '+61',
          phone_number: pPhoneNumber || null,
          preferences: passengerLabel ? { label: passengerLabel } : {},
        }).catch(() => {/* non-blocking */});
      }

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
      const tolls: Record<string, number> = {};
      for (const c of classes) {
        const estimateRes = await api.post('/pricing/estimate', {
          serviceClassId: c.id,
          serviceTypeId: values.service_type_id,
          distanceKm: routeRes.data.distanceKm,
          durationMinutes: routeRes.data.durationMinutes,
          waypointsCount: waypoints.filter(Boolean).length,
          infant_seats: values.infant_seats ?? 0,
          toddler_seats: values.toddler_seats ?? 0,
          booster_seats: values.booster_seats ?? 0,
          pickupAddress: values.pickup_address_text,
          dropoffAddress: values.dropoff_address_text,
        });
        estimates[c.id] = estimateRes.data?.grand_total_minor ?? estimateRes.data?.total_minor ?? 0;
        tolls[c.id] = estimateRes.data?.toll_parking_minor ?? 0;
      }

      setQuote({
        status: 'success',
        distanceKm: routeRes.data.distanceKm,
        durationMinutes: routeRes.data.durationMinutes,
        estimates,
        tolls,
      });
    } catch {
      setQuote({
        status: 'error',
        message: 'Route calculation unavailable. Please contact your administrator to configure Google Maps integration.',
      });
    }
  }

  const onSubmit = handleSubmit((vals) => {
    if (!seatCountValid) return;
    mutation.mutate(vals);
  });

  const totalBabySeats = (values.infant_seats ?? 0) + (values.toddler_seats ?? 0) + (values.booster_seats ?? 0);
  const maxBabySeats = Math.max(0, (values.passenger_count ?? 1) - 1);
  const seatCountValid = totalBabySeats <= maxBabySeats;

  const canQuote = Boolean(
    values.service_type_id && values.city_id && values.pickup_address_text && values.dropoff_address_text && values.pickup_at_utc && seatCountValid,
  );

  const summaries = {
    service: selectedCity?.name && selectedServiceType?.display_name ? `${selectedCity.name} · ${selectedServiceType.display_name}` : 'Select city and service type',
    datetime: values.pickup_at_utc
      ? formatBookingTime(values.pickup_at_utc, values.timezone, selectedCity?.name)
      : 'Select pickup time',
    route: values.pickup_address_text && values.dropoff_address_text
      ? waypoints.length > 0
        ? `${values.pickup_address_text} → ${waypoints.length} stops → ${values.dropoff_address_text}`
        : `${values.pickup_address_text} → ${values.dropoff_address_text}`
      : 'Enter route',
    requirements: `${values.passenger_count} pax · ${values.luggage_count ?? 0} bags`,
    car: selectedCarType ? `${selectedCarType.name}${quote.status === 'success' ? ` · $${toDisplay((quote as Extract<typeof quote, {status:'success'}>).estimates[selectedCarType.id] ?? 0)}` : ''}` : 'Select a car type',
    extras: `Infant ${values.infant_seats} · Toddler ${values.toddler_seats} · Booster ${values.booster_seats}`,
  } as const;

  async function goNext(current: typeof SECTIONS[number]) {
    const idx = SECTIONS.indexOf(current);
    const next = SECTIONS[idx + 1];
    if (!next) return;

    const valid = await validateSection(current);
    if (!valid) return;

    setActiveSection(next);
  }

  function goBack(current: typeof SECTIONS[number]) {
    const idx = SECTIONS.indexOf(current);
    const prev = SECTIONS[idx - 1];
    if (!prev) return;
    setActiveSection(prev);
  }

  async function validateSection(section: typeof SECTIONS[number]) {
    if (section === 'service') {
      return trigger(['city_id', 'service_type_id']);
    }
    if (section === 'datetime') {
      return trigger(['pickup_at_utc', 'timezone']);
    }
    if (section === 'route') {
      return trigger(['pickup_address_text', 'dropoff_address_text']);
    }
    if (section === 'requirements') {
      return trigger(['passenger_count', 'luggage_count']);
    }
    if (section === 'car') {
      return trigger(['service_class_id']);
    }
    return true;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Booking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the details below to create a booking</p>
        </div>
        <button type="button" onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Clear All
        </button>
      </div>

      {mutation.isError && <ErrorAlert message="Failed to create booking. Please try again." />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border rounded p-5 sticky top-6">
            <h2 className="font-semibold mb-4">Customer & Passenger</h2>

            {/* Customer search / select */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block">
                {searchLabel}
              </label>

              {/* Search input */}
              <div className="relative">
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name, email or phone…"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <InlineSpinner />
                  </div>
                )}
              </div>

              {/* Results list */}
              {customerResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto bg-white shadow-sm">
                  {customerResults.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {[c.email, c.phone_number ? `${c.phone_country_code ?? ''} ${c.phone_number}` : null]
                          .filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {customerSearch.trim() && !searchLoading && customerResults.length === 0 && (
                <p className="text-xs text-gray-400 px-1">No customers found. Fill in details below to create a new one.</p>
              )}
            </div>

            <div className="space-y-3">
              <Field label="Customer Name" error={errors.customer_name?.message}>
                <Input
                  {...register('customer_name')}
                  placeholder="e.g. Jane Doe"
                />
              </Field>
              <PhoneSplitField
                label="Phone"
                countryCode={values.customer_phone_country_code ?? '+61'}
                number={values.customer_phone_number ?? ''}
                onCountryCodeChange={(v) => setValue('customer_phone_country_code', v)}
                onNumberChange={(v) => setValue('customer_phone_number', v)}
              />
              <Field label="Email" error={errors.customer_email?.message}>
                <Input
                  {...register('customer_email')}
                  placeholder="Optional"
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
                    <Input
                      {...register('passenger_first_name')}
                    />
                  </Field>
                  <Field label="Passenger Last Name" error={errors.passenger_last_name?.message}>
                    <Input
                      {...register('passenger_last_name')}
                    />
                  </Field>
                  <PhoneSplitField
                    label="Passenger Phone"
                    error={errors.passenger_phone_number?.message}
                    countryCode={values.passenger_phone_country_code ?? '+61'}
                    number={values.passenger_phone_number ?? ''}
                    onCountryCodeChange={(v) => setValue('passenger_phone_country_code', v)}
                    onNumberChange={(v) => setValue('passenger_phone_number', v)}
                  />
                </div>
              )}
            </div>

            {/* Save as Passenger Profile */}
            {selectedCustomerId && (
              <div className="mt-4 border-t pt-4 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsPassenger}
                    onChange={(e) => setSaveAsPassenger(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Save passenger to this customer's profile
                  </span>
                </label>
                {saveAsPassenger && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Profile Label <span className="text-gray-400 font-normal">(optional — e.g. "Wife", "PA")</span>
                    </label>
                    <Input
                      value={passengerLabel}
                      onChange={(e) => setPassengerLabel(e.target.value)}
                      placeholder="e.g. Wife, PA, Child"
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Booking Summary Card */}
          <div className="bg-white border rounded p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Booking Summary</h3>
            <div className="space-y-2 text-sm">
              {/* Customer */}
              <div className="flex gap-2">
                <span className="text-gray-400 w-5 shrink-0">👤</span>
                <span className={values.customer_name ? 'text-gray-900' : 'text-gray-300'}>
                  {values.customer_name || 'No customer'}
                </span>
              </div>
              {/* Service */}
              <div className="flex gap-2">
                <span className="text-gray-400 w-5 shrink-0">🏙️</span>
                <span className={selectedCity ? 'text-gray-900' : 'text-gray-300'}>
                  {selectedCity?.name && selectedServiceType?.display_name
                    ? `${selectedCity.name} · ${selectedServiceType.display_name}`
                    : 'No service selected'}
                </span>
              </div>
              {/* Date/time */}
              <div className="flex gap-2">
                <span className="text-gray-400 w-5 shrink-0">🕐</span>
                <span className={values.pickup_at_utc ? 'text-gray-900' : 'text-gray-300'}>
                  {values.pickup_at_utc
                    ? formatBookingTime(values.pickup_at_utc, values.timezone, selectedCity?.name)
                    : 'No date/time'}
                </span>
              </div>
              {/* Route */}
              <div className="flex gap-2 items-start">
                <span className="text-gray-400 w-5 shrink-0 mt-0.5">📍</span>
                <span className={values.pickup_address_text ? 'text-gray-900' : 'text-gray-300 text-sm'}>
                  {values.pickup_address_text ? (
                    <span className="block space-y-0.5">
                      <span className="block truncate">{values.pickup_address_text}</span>
                      {waypoints.filter(Boolean).map((wp, i) => (
                        <span key={i} className="block">
                          <span className="text-gray-400 text-xs">↓ stop {i + 1}</span>
                          <span className="block truncate text-gray-700">{wp}</span>
                        </span>
                      ))}
                      <span className="block text-gray-400 text-xs">↓</span>
                      <span className="block truncate">{values.dropoff_address_text || '—'}</span>
                    </span>
                  ) : 'No route'}
                </span>
              </div>
              {/* Car type + price */}
              {selectedCarType && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-5 shrink-0">🚘</span>
                  <span className="text-gray-900">
                    {selectedCarType.name}
                    {quote.status === 'success' && quote.estimates[selectedCarType.id]
                      ? <span className="ml-1 text-blue-600 font-semibold">${toDisplay(quote.estimates[selectedCarType.id])}</span>
                      : null}
                  </span>
                </div>
              )}
              {/* Pax */}
              <div className="flex gap-2">
                <span className="text-gray-400 w-5 shrink-0">🧳</span>
                <span className="text-gray-600">{values.passenger_count} pax · {values.luggage_count ?? 0} bags</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column — all sections on one page */}
        <div className="lg:col-span-2 space-y-4">

          {/* Service */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Service</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">City</label>
                <Select value={values.city_id} onChange={(e) => {
                  setValue('city_id', e.target.value, { shouldValidate: true });
                  const city = cities.find((c: any) => c.id === e.target.value);
                  if (city?.timezone) setValue('timezone', city.timezone);
                }}>
                  <option value="">Select a city</option>
                  {cities.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                {errors.city_id && <p className="text-xs text-red-600 mt-1">{errors.city_id.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Service Type</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {serviceTypes.map((s: any) => (
                    <button key={s.id} type="button"
                      onClick={() => setValue('service_type_id', s.id, { shouldValidate: true })}
                      className={`border rounded-lg px-3 py-2 text-left text-sm transition-colors ${values.service_type_id === s.id ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                      {s.display_name ?? s.name}
                    </button>
                  ))}
                </div>
                {errors.service_type_id && <p className="text-xs text-red-600 mt-1">{errors.service_type_id.message}</p>}
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Date & Time</h2>
            <div className="space-y-4">
              <input type="hidden" {...register('timezone')} />
              <DateTimePicker label="Pickup Date & Time" value={values.pickup_at_utc}
                onChange={(v) => setValue('pickup_at_utc', v, { shouldValidate: true })}
                error={errors.pickup_at_utc?.message} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Flight Number">
                  <Input {...register('flight_number')} placeholder="e.g. QF401" />
                </Field>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="return_trip" {...register('is_return_trip')} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <label htmlFor="return_trip" className="text-sm font-medium text-gray-700 cursor-pointer">Return Trip</label>
                </div>
              </div>
              {values.is_return_trip && (
                <DateTimePicker label="Return Date & Time" value={values.return_pickup_at_utc ?? ''}
                  onChange={(v) => setValue('return_pickup_at_utc', v, { shouldValidate: true })}
                  error={errors.return_pickup_at_utc?.message}
                  minDate={values.pickup_at_utc || undefined} />
              )}
            </div>
          </div>

          {/* Route */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Route</h2>
            <div className="space-y-3">
              <Field label="Pickup Address" error={errors.pickup_address_text?.message}>
                <PlacesAutocomplete value={values.pickup_address_text ?? ''}
                  onChange={(val, placeId) => { setValue('pickup_address_text', val, { shouldValidate: true }); setPickupPlaceId(placeId ?? ''); }}
                  placeholder="123 George St, Sydney" error={errors.pickup_address_text?.message}
                  cityLat={selectedCity?.lat ?? null} cityLng={selectedCity?.lng ?? null} cityName={selectedCity?.name ?? null} />
              </Field>

              {waypoints.map((wp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <PlacesAutocomplete value={wp}
                      onChange={(val) => { const next = [...waypoints]; next[idx] = val; setWaypoints(next); }}
                      placeholder={`Stop ${idx + 1}`}
                      cityLat={selectedCity?.lat ?? null} cityLng={selectedCity?.lng ?? null} cityName={selectedCity?.name ?? null} />
                  </div>
                  <button type="button" onClick={() => setWaypoints((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                </div>
              ))}

              <Field label="Dropoff Address" error={errors.dropoff_address_text?.message}>
                <PlacesAutocomplete value={values.dropoff_address_text ?? ''}
                  onChange={(val, placeId) => { setValue('dropoff_address_text', val, { shouldValidate: true }); setDropoffPlaceId(placeId ?? ''); }}
                  placeholder="Airport or destination" error={errors.dropoff_address_text?.message}
                  cityLat={selectedCity?.lat ?? null} cityLng={selectedCity?.lng ?? null} cityName={selectedCity?.name ?? null} />
              </Field>

              {waypoints.length < 5 && (
                <button type="button" onClick={() => setWaypoints((prev) => [...prev, ''])}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  + Add Stop
                </button>
              )}
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Requirements</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Field label="Passengers" error={errors.passenger_count?.message}>
                  <Input type="number" min={1} max={14} {...register('passenger_count', { valueAsNumber: true })} />
                </Field>
                <p className="text-xs text-gray-400 mt-1">Include infants & children in total count</p>
              </div>
              <Field label="Luggage" error={errors.luggage_count?.message}>
                <Input type="number" min={0} max={20} {...register('luggage_count', { valueAsNumber: true })} />
              </Field>
              <div className="col-span-2 md:col-span-3">
                <Field label="Special Requests">
                  <textarea {...register('special_requests')} rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional notes for the driver" />
                </Field>
              </div>
            </div>
          </div>

          {/* Extra Options — before quote so final price is inclusive */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Extra Options</h2>
            {(() => {
              const seatError = !seatCountValid && totalBabySeats > 0;
              return (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Infant Seat">
                      <Input type="number" min={0} max={values.passenger_count} {...register('infant_seats', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Toddler Seat">
                      <Input type="number" min={0} max={values.passenger_count} {...register('toddler_seats', { valueAsNumber: true })} />
                    </Field>
                    <Field label="Booster Seat">
                      <Input type="number" min={0} max={values.passenger_count} {...register('booster_seats', { valueAsNumber: true })} />
                    </Field>
                  </div>
                  {seatError ? (
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      ⚠️ Baby seats ({totalBabySeats}) must be less than total passengers ({values.passenger_count ?? 1}) — at least 1 adult required. Babies are included in the passenger count.
                    </p>
                  ) : totalBabySeats > 0 ? (
                    <p className="text-xs text-green-600 mt-2">
                      ✓ {totalBabySeats} baby seat{totalBabySeats > 1 ? 's' : ''} + {(values.passenger_count ?? 1) - totalBabySeats} adult{(values.passenger_count ?? 1) - totalBabySeats !== 1 ? 's' : ''} = {values.passenger_count ?? 1} total passengers
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-2">Seat surcharge prices are set per car type and will be included in the quote.</p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Car Type + Quote */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Car Type</h2>
              <div className="flex items-center gap-3">
                <Button onClick={handleGetQuote} disabled={!canQuote}>
                  {quote.status === 'loading' ? 'Calculating…' : quote.status === 'success' ? '↻ Recalculate' : 'Get Quote'}
                </Button>
                {quote.status === 'success' && (
                  <span className="text-sm text-green-700 font-medium">✓ {quote.distanceKm.toFixed(1)} km · {quote.durationMinutes} min</span>
                )}
              </div>
            </div>
            {quote.status === 'error' && <p className="text-sm text-red-600 mb-3">{quote.message}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {carTypes.map((c: any) => {
                const price = quote.status === 'success' ? (quote.estimates[c.id] ?? 0) : 0;
                const toll  = quote.status === 'success' ? (quote.tolls[c.id]     ?? 0) : 0;
                const insufficient = (c.passenger_capacity ?? 0) > 0 && ((c.passenger_capacity ?? 0) < values.passenger_count || (c.luggage_capacity ?? 0) < (values.luggage_count ?? 0));
                return (
                  <button key={c.id} type="button" disabled={insufficient}
                    onClick={() => setValue('service_class_id', c.id, { shouldValidate: true })}
                    className={`border rounded-lg p-3 text-left transition-colors ${values.service_class_id === c.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'} ${insufficient ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {quote.status === 'success' && (
                      <div className="mt-1 space-y-0.5">
                        <div className="text-blue-600 font-semibold text-sm">${toDisplay(price)}</div>
                        {toll > 0 && (
                          <div className="text-xs text-amber-600 font-medium">+ ${toDisplay(toll)} toll est.</div>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">🧍 {c.passenger_capacity ?? 0} · 🧳 {c.luggage_capacity ?? 0}</div>
                  </button>
                );
              })}
            </div>
            {errors.service_class_id && <p className="text-xs text-red-600 mt-2">{errors.service_class_id.message}</p>}
          </div>

          {/* Submit */}
          <div className="pb-4">
            <Button onClick={onSubmit} disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? 'Creating…' : 'Create Booking'}
            </Button>
          </div>

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

// AccordionCard kept for backwards compat but no longer used in main flow
