'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { WizardLayout } from '@/components/patterns/Wizard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

const formSchema = z.object({
  customer_name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  customer_phone: z.string().trim().optional(),
  customer_email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /.+@.+\..+/.test(val), 'Invalid email address'),
  pickup_address_text: z.string().trim().min(5, 'Pickup address must be at least 5 characters'),
  dropoff_address_text: z.string().trim().min(5, 'Dropoff address must be at least 5 characters'),
  pickup_at_utc: z.string().min(1, 'Pickup time is required'),
  timezone: z.string().trim().min(1, 'Timezone is required'),
  passenger_count: z.coerce.number().int().min(1).max(14),
  luggage_count: z.coerce.number().int().min(0).max(20).optional(),
  special_requests: z.string().max(500, 'Max 500 characters').optional(),
});

type FormValues = z.infer<typeof formSchema>;

const steps = [
  { id: 'customer', label: 'Customer Details' },
  { id: 'trip', label: 'Trip Details' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'review', label: 'Review & Submit' },
] as const;

const stepFields: Record<(typeof steps)[number]['id'], (keyof FormValues)[]> = {
  customer: ['customer_name', 'customer_phone', 'customer_email'],
  trip: ['pickup_address_text', 'dropoff_address_text', 'pickup_at_utc', 'timezone'],
  requirements: ['passenger_count', 'luggage_count', 'special_requests'],
  review: [],
};

export default function CreateBookingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      pickup_address_text: '',
      dropoff_address_text: '',
      pickup_at_utc: '',
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
        passengerCount: values.passenger_count,
        luggageCount: values.luggage_count ?? 0,
        specialRequests: values.special_requests?.trim() || undefined,
        bookingSource: 'ADMIN' as const,
      };
      const response = await api.post('/bookings', payload);
      return response.data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      const bookingId = response?.data?.id ?? response?.data?.booking?.id;
      if (bookingId) {
        router.push(`/tenant/bookings/${bookingId}`);
      } else {
        router.push('/tenant/bookings');
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
            <ReviewRow label="Customer">{values.customer_name}</ReviewRow>
            <ReviewRow label="Contact">
              {values.customer_email || '—'} / {values.customer_phone || '—'}
            </ReviewRow>
            <ReviewRow label="Pickup">
              {values.pickup_address_text} — {values.pickup_at_utc || 'No time set'} ({values.timezone})
            </ReviewRow>
            <ReviewRow label="Dropoff">{values.dropoff_address_text}</ReviewRow>
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
