import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class PublicBookingsService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2023-10-16' as any,
  });

  private async createBookingRecord(tenant_id: string, dto: any) {
    let passenger_id: string | null = null;

    if (dto.passenger_email) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('user_id', dto.passenger_email)
        .limit(1);

      if (existing && existing.length > 0) {
        passenger_id = existing[0].id;
      } else {
        const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
          email: dto.passenger_email,
          email_confirm: true,
          user_metadata: {
            first_name: dto.first_name,
            last_name: dto.last_name,
            phone: dto.passenger_phone,
          },
        });

        if (authUser?.user) {
          const { data: createdProfile } = await supabaseAdmin
            .from('profiles')
            .insert({
              user_id: authUser.user.id,
              tenant_id,
              first_name: dto.first_name,
              last_name: dto.last_name,
              phone: dto.passenger_phone,
              role: 'PASSENGER',
              status: 'ACTIVE',
            })
            .select('id')
            .single();

          passenger_id = createdProfile?.id ?? null;
        }
      }
    }

    const booking_number = `BK${Date.now()}`;
    const extras_total = (dto.selected_extras ?? []).reduce(
      (sum: number, e: any) => sum + Number(e.price || 0) * Number(e.quantity || 1),
      0,
    );

    const total_fare =
      Number(dto.estimated_fare || 0) + Number(dto.toll_cost || 0) + extras_total;

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        tenant_id,
        booking_number,
        passenger_id,
        vehicle_type_id: dto.vehicle_type_id,
        service_type: dto.service_type,
        trip_type: dto.trip_type ?? 'ONE_WAY',
        pickup_address: dto.pickup_address,
        pickup_lat: dto.pickup_lat,
        pickup_lng: dto.pickup_lng,
        dropoff_address: dto.dropoff_address,
        dropoff_lat: dto.dropoff_lat,
        dropoff_lng: dto.dropoff_lng,
        waypoints: dto.waypoints ?? [],
        pickup_datetime: dto.pickup_datetime,
        return_datetime: dto.return_datetime,
        distance_km: dto.distance_km,
        duration_minutes: dto.duration_minutes,
        duration_hours: dto.duration_hours,
        passenger_count: dto.passenger_count,
        luggage_count: dto.luggage_count,
        flight_number: dto.flight_number,
        special_requests: dto.special_requests,
        estimated_fare: dto.estimated_fare,
        toll_cost: dto.toll_cost ?? 0,
        extras_total,
        total_fare,
        selected_extras: dto.selected_extras ?? [],
        billing_method: dto.billing_method ?? 'KM',
        booking_status: 'PENDING',
        payment_status: 'PENDING',
        passenger_name: `${dto.first_name ?? ''} ${dto.last_name ?? ''}`.trim(),
        passenger_email: dto.passenger_email,
        passenger_phone: dto.passenger_phone,
        stripe_customer_id: dto.stripe_customer_id ?? null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return { booking, passenger_id };
  }

  async createSetupIntent(dto: any) {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, slug')
      .eq('slug', dto.tenant_slug)
      .single();

    if (tenantError || !tenant) {
      throw new BadRequestException('Tenant not found');
    }

    let stripe_customer_id: string | null = dto.stripe_customer_id ?? null;

    if (!stripe_customer_id && dto.passenger_email) {
      const customers = await this.stripe.customers.list({
        email: dto.passenger_email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        stripe_customer_id = customers.data[0].id;
      } else {
        const customer = await this.stripe.customers.create({
          email: dto.passenger_email,
          name: `${dto.first_name ?? ''} ${dto.last_name ?? ''}`.trim(),
          phone: dto.passenger_phone,
        });
        stripe_customer_id = customer.id;
      }
    }

    const { booking } = await this.createBookingRecord(tenant.id, {
      ...dto,
      stripe_customer_id,
    });

    const setupIntent = await this.stripe.setupIntents.create({
      customer: stripe_customer_id ?? undefined,
      payment_method_types: ['card'],
      metadata: {
        booking_id: booking.id,
        tenant_id: tenant.id,
        amount: String(booking.total_fare ?? 0),
      },
    });

    return {
      client_secret: setupIntent.client_secret,
      booking_id: booking.id,
      booking_number: booking.booking_number,
      stripe_customer_id,
    };
  }

  async chargeBooking(dto: any) {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, slug')
      .eq('slug', dto.tenant_slug)
      .single();

    if (tenantError || !tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const { booking } = await this.createBookingRecord(tenant.id, dto);

    const amountCents = Math.round(Number(booking.total_fare || 0) * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'aud',
      customer: dto.stripe_customer_id,
      payment_method: dto.payment_method_id,
      confirm: true,
      metadata: {
        booking_id: booking.id,
        tenant_id: tenant.id,
      },
    });

    if (
      paymentIntent.status !== 'succeeded' &&
      paymentIntent.status !== 'requires_capture'
    ) {
      throw new BadRequestException(`Payment failed: ${paymentIntent.status}`);
    }

    await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'PAID',
        booking_status: 'CONFIRMED',
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: dto.stripe_customer_id ?? null,
      })
      .eq('id', booking.id);

    return {
      booking_id: booking.id,
      booking_number: booking.booking_number,
      payment_status: 'PAID',
    };
  }

  async createGuestBooking(dto: any) {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', dto.tenant_slug)
      .single();

    if (tenantError || !tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const { booking } = await this.createBookingRecord(tenant.id, dto);

    return {
      booking_id: booking.id,
      booking_number: booking.booking_number,
    };
  }
}
