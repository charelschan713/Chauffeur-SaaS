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
    dropoff_address_text: z.string().trim().optional(),
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
  | { status: 'success'; distanceKm: number; durationMinutes: number; estimates: Record<string, number>; breakdowns: Record<string, any> };

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

  const { data: tenantBusiness } = useQuery({
    queryKey: ['tenant-business'],
    queryFn: async () => {
      const res = await api.get('/tenants/business');
      return res.data ?? null;
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
        // Customer fields — flat as backend expects
        customer_first_name: firstName,
        customer_last_name: rest.join(' ') || 'Customer',
        customer_email: values.customer_email?.trim() || null,
        customer_phone_country_code: values.customer_phone_country_code || '+61',
        customer_phone_number: values.customer_phone_number?.trim() || undefined,
        customer_id: selectedCustomerId || undefined,
        // Route
        pickup_address_text: (values.pickup_address_text ?? '').trim(),
        pickup_place_id: pickupPlaceId || undefined,
        dropoff_address_text: (values.dropoff_address_text ?? '').trim(),
        dropoff_place_id: dropoffPlaceId || undefined,
        // Timing — snake_case to match backend
        pickup_at_utc: new Date(values.pickup_at_utc).toISOString(),
        timezone: values.timezone || 'Australia/Sydney',
        is_return_trip: values.is_return_trip,
        return_pickup_at_utc: values.return_pickup_at_utc
          ? new Date(values.return_pickup_at_utc).toISOString()
          : undefined,
        return_pickup_address_text: values.return_pickup_address_text?.trim() || undefined,
        passenger_count: values.passenger_count,
        luggage_count: values.luggage_count ?? 0,
        special_requests: values.special_requests?.trim() || undefined,
        booking_source: 'ADMIN',
        service_class_id: values.service_class_id,
        service_type_id: values.service_type_id,
        city_id: values.city_id,
        flight_number: values.flight_number?.trim() || undefined,
        waypoints: waypoints.filter(Boolean).map((w) => ({ address: w })),
        waypoints_count: waypoints.filter(Boolean).length,
        passenger_first_name: values.passenger_is_customer ? firstName : (values.passenger_first_name ?? firstName),
        passenger_last_name: values.passenger_is_customer ? (rest.join(' ') || 'Customer') : ((values.passenger_last_name ?? rest.join(' ')) || 'Customer'),
        passenger_is_customer: values.passenger_is_customer,
        passenger_phone_country_code: values.passenger_is_customer
          ? (values.customer_phone_country_code || '+61')
          : (values.passenger_phone_country_code || '+61'),
        passenger_phone_number: values.passenger_is_customer
          ? (values.customer_phone_number?.trim() || undefined)
          : (values.passenger_phone_number?.trim() || undefined),
        infant_seats: values.infant_seats ?? 0,
        toddler_seats: values.toddler_seats ?? 0,
        booster_seats: values.booster_seats ?? 0,
      };
      const response = await api.post('/bookings', payload);

      // Save passenger profile if opted in and a known customer is selected
      if (saveAsPassenger && selectedCustomerId) {
        const v = values;
        const isPassengerCustomer = v.passenger_is_customer;
        const pFirstName = isPassengerCustomer
          ? payload.customer_first_name
          : (v.passenger_first_name ?? payload.customer_first_name);
        const pLastName = isPassengerCustomer
          ? payload.customer_last_name
          : (v.passenger_last_name ?? payload.customer_last_name);
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
    if (values.is_return_trip && !values.return_pickup_at_utc) {
      setQuote({ status: 'error', message: 'Return pickup time is required.' });
      return;
    }
    const tenantSlug = tenantBusiness?.slug;
    if (!tenantSlug) {
      setQuote({ status: 'error', message: 'Tenant configuration missing (slug).' });
      return;
    }

    setQuote({ status: 'loading' });
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const publicUrl = (path: string) => (apiBase ? `${apiBase}${path}` : path);

      const outboundRoute = await api.get(publicUrl('/public/maps/route'), {
        params: {
          tenant_slug: tenantSlug,
          origin: values.pickup_address_text,
          destination: values.dropoff_address_text,
          pickup_at: values.pickup_at_utc ? new Date(values.pickup_at_utc).toISOString() : undefined,
          waypoints: waypoints.filter(Boolean),
        },
      });

      if (!outboundRoute.data || !outboundRoute.data.distance_km) {
        setQuote({
          status: 'error',
          message: 'Route calculation unavailable. Please contact your administrator to configure Google Maps integration.',
        });
        return;
      }

      let returnRoute: { distance_km: number; duration_minutes: number } | null = null;
      if (values.is_return_trip) {
        const returnDestination = values.return_pickup_address_text?.trim() || values.pickup_address_text;
        const returnRouteRes = await api.get(publicUrl('/public/maps/route'), {
          params: {
            tenant_slug: tenantSlug,
            origin: values.dropoff_address_text,
            destination: returnDestination,
            pickup_at: values.return_pickup_at_utc ? new Date(values.return_pickup_at_utc).toISOString() : undefined,
          },
        });
        if (returnRouteRes.data?.distance_km) {
          returnRoute = returnRouteRes.data;
        }
      }

      const quoteRes = await api.post(publicUrl(`/public/pricing/quote?tenant_slug=${encodeURIComponent(tenantSlug)}`), {
        service_type_id: values.service_type_id,
        trip_mode: values.is_return_trip ? 'RETURN' : 'ONE_WAY',
        pickup_address: values.pickup_address_text,
        dropoff_address: values.dropoff_address_text,
        pickup_at_utc: new Date(values.pickup_at_utc).toISOString(),
        return_pickup_at_utc: values.return_pickup_at_utc ? new Date(values.return_pickup_at_utc).toISOString() : undefined,
        return_pickup_address: values.return_pickup_address_text?.trim() || undefined,
        timezone: values.timezone || 'Australia/Sydney',
        passenger_count: values.passenger_count,
        luggage_count: values.luggage_count ?? 0,
        distance_km: outboundRoute.data.distance_km,
        duration_minutes: outboundRoute.data.duration_minutes,
        waypoints_count: waypoints.filter(Boolean).length,
        return_distance_km: returnRoute?.distance_km,
        return_duration_minutes: returnRoute?.duration_minutes,
        return_waypoints_count: 0,
        infant_seats: values.infant_seats ?? 0,
        toddler_seats: values.toddler_seats ?? 0,
        booster_seats: values.booster_seats ?? 0,
      });

      let results: any[] = [];
      try {
        results = quoteRes.data?.results ?? [];
        const estimates: Record<string, number> = {};
        const breakdowns: Record<string, any> = {};
        for (const r of results) {
          const snap = r?.pricing_snapshot_preview ?? {};
          estimates[r.service_class_id] = snap.final_fare_minor ?? r.estimated_total_minor ?? 0;
          breakdowns[r.service_class_id] = snap;
        }

        setQuote({
          status: 'success',
          distanceKm: outboundRoute.data.distance_km,
          durationMinutes: outboundRoute.data.duration_minutes,
          estimates,
          breakdowns,
        });
      } catch (e: any) {
        console.error('[admin][booking-new] post-quote processing failed', {
          error: e,
          message: e?.message,
          stack: e?.stack,
          resultsPreview: Array.isArray(results) ? results.slice(0, 1) : results,
        });
        throw e;
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const detail = typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
      console.error('[admin][booking-new] quote failed', { status, data, err });
      setQuote({
        status: 'error',
        message: `Route calculation unavailable. ${status ? `(${status})` : ''} ${detail}`.trim(),
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
    extras: `Infant (0–6m) ${values.infant_seats} · Toddler (0–4y) ${values.toddler_seats} · Booster (4–8y) ${values.booster_seats}`,
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
                  <div className="flex-1">
                    <span className="text-gray-900 font-medium">{selectedCarType.name}</span>
                    {quote.status === 'success' && (() => {
                      const bd = quote.breakdowns[selectedCarType.id] ?? {};
                      const total = quote.estimates[selectedCarType.id] ?? 0;
                      return total > 0 ? (
                        <div className="mt-1 space-y-0.5 text-xs">
                          {(bd.leg1_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-gray-500">
                              <span>Outbound price</span><span>${toDisplay(bd.leg1_minor)}</span>
                            </div>
                          )}
                          {(bd.leg1_surcharge_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Outbound surcharge</span><span>+${toDisplay(bd.leg1_surcharge_minor)}</span>
                            </div>
                          )}
                          {(bd.toll_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Outbound toll</span><span>+${toDisplay(bd.toll_minor)}</span>
                            </div>
                          )}
                          {(bd.parking_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Outbound parking</span><span>+${toDisplay(bd.parking_minor)}</span>
                            </div>
                          )}
                          {(bd.leg2_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-gray-500">
                              <span>Return price</span><span>${toDisplay(bd.leg2_minor)}</span>
                            </div>
                          )}
                          {(bd.leg2_surcharge_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Return surcharge</span><span>+${toDisplay(bd.leg2_surcharge_minor)}</span>
                            </div>
                          )}
                          {(bd.toll_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Return toll</span><span>+${toDisplay(bd.toll_minor)}</span>
                            </div>
                          )}
                          {(bd.parking_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Return parking</span><span>+${toDisplay(bd.parking_minor)}</span>
                            </div>
                          )}
                          {(bd.discount_amount_minor ?? 0) > 0 && (
                            <div className="flex justify-between text-emerald-600">
                              <span>Discount</span><span>- ${toDisplay(bd.discount_amount_minor)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-blue-600 font-semibold pt-1 border-t border-gray-200 mt-1">
                            <span>Total</span><span>${toDisplay(total)}</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
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
                <label className="text-sm font-medium text-gray-700 block mb-1">Service Type</label>
                <Select
                  value={values.service_type_id}
                  onChange={(e) => setValue('service_type_id', e.target.value, { shouldValidate: true })}
                >
                  <option value="">Select service type...</option>
                  {serviceTypes.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.display_name ?? s.name}</option>
                  ))}
                </Select>
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
                {/* P2P / Event / Wedding — Trip Type */}
                {selectedServiceType?.calculation_type !== 'HOURLY_CHARTER' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Trip Type</label>
                    <Select
                      value={values.is_return_trip ? 'RETURN' : 'ONE_WAY'}
                      onChange={(e) => setValue('is_return_trip', e.target.value === 'RETURN', { shouldValidate: true })}
                    >
                      <option value="ONE_WAY">One Way</option>
                      <option value="RETURN">Return</option>
                    </Select>
                  </div>
                )}
                {/* Hourly — Duration Hours */}
                {selectedServiceType?.calculation_type === 'HOURLY_CHARTER' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Duration (hours)</label>
                    <Select
                      value={String(values.luggage_count ?? 2)}
                      onChange={(e) => setValue('luggage_count', Number(e.target.value))}
                    >
                      {[2,3,4,5,6,7,8,9,10,12].map(h => <option key={h} value={h}>{h} hours</option>)}
                    </Select>
                  </div>
                )}
                {/* P2P only — Flight Number */}
                {selectedServiceType?.code === 'POINT_TO_POINT' && (
                  <Field label="Flight Number (optional)">
                    <Input {...register('flight_number')} placeholder="e.g. QF401" />
                  </Field>
                )}
              </div>
              {/* Return — time only, pickup = dropoff address */}
              {values.is_return_trip && selectedServiceType?.calculation_type !== 'HOURLY_CHARTER' && (
                <div className="space-y-2">
                  <DateTimePicker label="Return Date & Time" value={values.return_pickup_at_utc ?? ''}
                    onChange={(v) => setValue('return_pickup_at_utc', v, { shouldValidate: true })}
                    error={errors.return_pickup_at_utc?.message}
                    minDate={values.pickup_at_utc || undefined} />
                  <p className="text-xs text-gray-400">Return pickup from drop-off location.</p>
                </div>
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
                <label className="text-sm font-medium text-gray-700 block mb-1">Passengers</label>
                <Select value={String(values.passenger_count)}
                  onChange={(e) => setValue('passenger_count', Number(e.target.value), { shouldValidate: true })}>
                  {Array.from({length: 14}, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} passenger{n > 1 ? 's' : ''}</option>
                  ))}
                </Select>
                {errors.passenger_count && <p className="text-xs text-red-600 mt-1">{errors.passenger_count.message}</p>}
                <p className="text-xs text-gray-400 mt-1">Include infants & children</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Luggage</label>
                <Select value={String(values.luggage_count ?? 0)}
                  onChange={(e) => setValue('luggage_count', Number(e.target.value), { shouldValidate: true })}>
                  {Array.from({length: 21}, (_, i) => i).map(n => (
                    <option key={n} value={n}>{n} bag{n !== 1 ? 's' : ''}</option>
                  ))}
                </Select>
              </div>
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
                    {[
                      { label: 'Infant Seat (0–6 months)', field: 'infant_seats' as const },
                      { label: 'Toddler Seat (0–4 yrs)', field: 'toddler_seats' as const },
                      { label: 'Booster Seat (4–8 yrs)', field: 'booster_seats' as const },
                    ].map(({ label, field }) => (
                      <div key={field}>
                        <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                        <Select value={String(values[field] ?? 0)}
                          onChange={(e) => setValue(field, Number(e.target.value), { shouldValidate: true })}>
                          {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                        </Select>
                      </div>
                    ))}
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
              {carTypes.filter((c: any) => c.name && c.active !== false).map((c: any) => {
                const price = quote.status === 'success' ? (quote.estimates[c.id] ?? 0) : 0;
                const bd    = quote.status === 'success' ? (quote.breakdowns[c.id] ?? {}) : {};
                const insufficient = (c.passenger_capacity ?? 0) > 0 && ((c.passenger_capacity ?? 0) < values.passenger_count || (c.luggage_capacity ?? 0) < (values.luggage_count ?? 0));
                return (
                  <button key={c.id} type="button" disabled={insufficient}
                    onClick={() => setValue('service_class_id', c.id, { shouldValidate: true })}
                    className={`border rounded-lg p-3 text-left transition-colors ${values.service_class_id === c.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'} ${insufficient ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {quote.status === 'success' && (
                      <div className="mt-1.5 space-y-0.5 text-xs">
                        {(bd.leg1_minor ?? 0) > 0 && (
                          <div className="text-gray-500">Outbound price: ${toDisplay(bd.leg1_minor)}</div>
                        )}
                        {(bd.leg1_surcharge_minor ?? 0) > 0 && (
                          <div className="text-amber-600">Outbound surcharge: +${toDisplay(bd.leg1_surcharge_minor)}</div>
                        )}
                        {(bd.toll_minor ?? 0) > 0 && (
                          <div className="text-amber-600">Outbound toll: +${toDisplay(bd.toll_minor)}</div>
                        )}
                        {(bd.parking_minor ?? 0) > 0 && (
                          <div className="text-amber-600">Outbound parking: +${toDisplay(bd.parking_minor)}</div>
                        )}
                        {(bd.leg2_minor ?? 0) > 0 && (
                          <div className="text-gray-500">Return price: ${toDisplay(bd.leg2_minor)}</div>
                        )}
                        {(bd.leg2_surcharge_minor ?? 0) > 0 && (
                          <div className="text-amber-600">Return surcharge: +${toDisplay(bd.leg2_surcharge_minor)}</div>
                        )}
                        {(bd.toll_minor ?? 0) > 0 && (
                          <div className="text-amber-600">Return toll: +${toDisplay(bd.toll_minor)}</div>
                        )}
                        {(bd.parking_minor ?? 0) > 0 && (
                          <div className="text-amber-600">Return parking: +${toDisplay(bd.parking_minor)}</div>
                        )}
                        {(bd.discount_amount_minor ?? 0) > 0 && (
                          <div className="text-emerald-600">Discount: -${toDisplay(bd.discount_amount_minor)}</div>
                        )}
                        <div className="text-blue-600 font-semibold pt-0.5 border-t border-gray-100">Total: ${toDisplay(price)}</div>
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
