'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { WizardLayout } from '@/components/patterns/Wizard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

const formSchema = z
  .object({
    service_class_id: z.string().min(1, 'Car type is required'),
    service_type_id: z.string().min(1, 'Service type is required'),
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
    pickup_at_utc: z.string().min(1, 'Pickup time is required'),
    is_return_trip: z.boolean().default(false),
    return_pickup_at_utc: z.string().optional(),
    return_pickup_address_text: z.string().optional(),
    timezone: z.string().trim().min(1, 'Timezone is required'),
    passenger_count: z.coerce.number().int().min(1).max(14),
    luggage_count: z.coerce.number().int().min(0).max(20).optional(),
    special_requests: z.string().max(500, 'Max 500 characters').optional(),
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

const steps = [
  { id: 'service', label: 'Service' },
  { id: 'customer', label: 'Customer Details' },
  { id: 'trip', label: 'Trip Details' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'review', label: 'Review & Submit' },
] as const;

const stepFields: Record<(typeof steps)[number]['id'], (keyof FormValues)[]> = {
  service: ['service_class_id', 'service_type_id'],
  customer: [
    'customer_name',
    'customer_phone',
    'customer_email',
    'passenger_is_customer',
    'passenger_first_name',
    'passenger_last_name',
    'passenger_phone',
  ],
  trip: ['pickup_address_text', 'dropoff_address_text', 'pickup_at_utc', 'is_return_trip', 'return_pickup_at_utc', 'return_pickup_address_text', 'timezone'],
  requirements: ['passenger_count', 'luggage_count', 'special_requests'],
  review: [],
};

function toDisplay(minor: number) {
  return (minor / 100).toFixed(2);
}

export default function CreateBookingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

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

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      service_class_id: '',
      service_type_id: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      pickup_address_text: '',
      dropoff_address_text: '',
      pickup_at_utc: '',
      is_return_trip: false,
      return_pickup_at_utc: '',
      return_pickup_address_text: '',
      timezone: 'Australia/Sydney',
      passenger_count: 1,
      luggage_count: 0,
      special_requests: '',
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
        return_pickup_at_utc: values.return_pickup_at_utc ? new Date(values.return_pickup_at_utc).toISOString() : undefined,
        return_pickup_address_text: values.return_pickup_address_text?.trim() || undefined,
        passengerCount: values.passenger_count,
        luggageCount: values.luggage_count ?? 0,
        specialRequests: values.special_requests?.trim() || undefined,
        bookingSource: 'ADMIN' as const,
        service_class_id: values.service_class_id,
        service_type_id: values.service_type_id,
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

  const goNext = async () => {
    const fields = stepFields[steps[stepIndex].id];
    if (fields.length) {
      const valid = await trigger(fields, { shouldFocus: true });
      if (!valid) return;
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  const stepId = steps[stepIndex].id;
  const values = watch();

  return (
    <div className="space-y-4">
      {mutation.isError && <ErrorAlert message="Failed to create booking. Please try again." />}

      <WizardLayout
        steps={steps}
        currentStepId={stepId}
        footer={
          <div className="flex justify-between w-full">
            <button
              onClick={goBack}
              disabled={stepIndex === 0 || mutation.isPending}
              className="px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Back
            </button>
            {stepIndex < steps.length - 1 ? (
              <button
                onClick={goNext}
                disabled={mutation.isPending}
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={mutation.isPending}
                className="px-4 py-2 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
              >
                {mutation.isPending ? 'Creating...' : 'Create Booking'}
              </button>
            )}
          </div>
        }
      >
        {stepId === 'service' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Car Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {carTypes.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setValue('service_class_id', c.id, { shouldValidate: true })}
                    className={`border rounded p-3 text-left ${values.service_class_id === c.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">Base ${toDisplay(c.base_fare_minor ?? 0)} · Hourly ${toDisplay(c.hourly_rate_minor ?? 0)}</div>
                  </button>
                ))}
              </div>
              {errors.service_class_id && <p className="text-xs text-red-600">{errors.service_class_id.message}</p>}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Service Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              {errors.service_type_id && <p className="text-xs text-red-600">{errors.service_type_id.message}</p>}
            </div>
          </div>
        )}

        {stepId === 'customer' && (
          <div className="grid grid-cols-1 gap-4">
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
        )}

        {stepId === 'trip' && (
          <div className="grid grid-cols-1 gap-4">
            <Field label="Pickup Address" error={errors.pickup_address_text?.message}>
              <input
                {...register('pickup_address_text')}
                placeholder="123 George St, Sydney"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Dropoff Address" error={errors.dropoff_address_text?.message}>
              <input
                {...register('dropoff_address_text')}
                placeholder="Airport or destination"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Pickup Time" error={errors.pickup_at_utc?.message}>
              <input
                type="datetime-local"
                {...register('pickup_at_utc')}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </Field>
            
            <label className="text-sm font-medium text-gray-700 space-y-1">
              <span>Return Trip?</span>
              <input
                type="checkbox"
                {...register('is_return_trip')}
                className="h-4 w-4"
              />
            </label>
            {values.is_return_trip && (
              <>
                <Field label="Return Pickup Address (optional)" error={errors.return_pickup_address_text?.message}>
                  <input
                    {...register('return_pickup_address_text')}
                    placeholder="Use dropoff address if blank"
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Return Pickup Time" error={errors.return_pickup_at_utc?.message}>
                  <input
                    type="datetime-local"
                    {...register('return_pickup_at_utc')}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </Field>
              </>
            )}

            <Field label="Timezone" error={errors.timezone?.message}>
              <input
                {...register('timezone')}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}

        {stepId === 'requirements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Passengers" error={errors.passenger_count?.message}>
              <input
                type="number"
                min={1}
                max={14}
                {...register('passenger_count', { valueAsNumber: true })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Luggage" error={errors.luggage_count?.message}>
              <input
                type="number"
                min={0}
                max={20}
                {...register('luggage_count', { valueAsNumber: true })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
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
        )}

        {stepId === 'review' && (
          <div className="space-y-4 text-sm">
            <ReviewRow label="Car Type">{carTypes.find((c: any) => c.id === values.service_class_id)?.name ?? '—'}</ReviewRow>
            <ReviewRow label="Service Type">{serviceTypes.find((s: any) => s.id === values.service_type_id)?.display_name ?? '—'}</ReviewRow>
            <ReviewRow label="Customer">{values.customer_name}</ReviewRow>
            <ReviewRow label="Contact">
              {values.customer_email || '—'} / {values.customer_phone || '—'}
            </ReviewRow>
            <ReviewRow label="Pickup">
              {values.pickup_address_text} — {values.pickup_at_utc || 'No time set'} ({values.timezone})
            </ReviewRow>
            <ReviewRow label="Dropoff">{values.dropoff_address_text}</ReviewRow>
            {values.is_return_trip && (
              <ReviewRow label="Return Pickup">
                {values.return_pickup_address_text || values.dropoff_address_text} — {values.return_pickup_at_utc || 'No time set'}
              </ReviewRow>
            )}
            <ReviewRow label="Passengers">{values.passenger_count}</ReviewRow>
            <ReviewRow label="Luggage">{values.luggage_count ?? 0}</ReviewRow>
            <ReviewRow label="Special Requests">{values.special_requests || '—'}</ReviewRow>
          </div>
        )}
      </WizardLayout>
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

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{children}</span>
    </div>
  );
}
