import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BOOKING_EVENTS } from './booking-events';

export class ImmutableBookingError extends ForbiddenException {
  constructor() {
    super('Booking is immutable after COMPLETED');
  }
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ASSIGNED', 'CANCELLED', 'NO_SHOW'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
};

@Injectable()
export class BookingService {
  constructor(private readonly dataSource: DataSource) {}

  async createBooking(tenantId: string, dto: any) {
    const clientRequestId = dto.clientRequestId ?? uuidv4();

    const existing = await this.dataSource.query(
      `select booking_id from public.idempotency_keys
       where tenant_id = $1 and client_request_id = $2`,
      [tenantId, clientRequestId],
    );
    if (existing.length) return { bookingId: existing[0].booking_id };

    return this.dataSource.transaction(async (manager) => {
      const bookingId = uuidv4();
      const bookingReference =
        'BK-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      await manager.query(
        `insert into public.bookings (
          id, tenant_id, booking_reference, booking_source,
          customer_first_name, customer_last_name, customer_email,
          pickup_address_text, dropoff_address_text,
          pickup_at_utc, timezone,
          total_price_minor, currency, client_request_id
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )`,
        [
          bookingId,
          tenantId,
          bookingReference,
          dto.bookingSource ?? 'ADMIN',
          dto.customer.firstName,
          dto.customer.lastName,
          dto.customer.email,
          dto.pickup.address,
          dto.dropoff.address,
          dto.pickupAtUtc,
          dto.timezone ?? 'UTC',
          dto.totalPriceMinor ?? 0,
          dto.currency ?? 'AUD',
          clientRequestId,
        ],
      );

      await manager.query(
        `insert into public.idempotency_keys
         (tenant_id, client_request_id, booking_id)
         values ($1,$2,$3)`,
        [tenantId, clientRequestId, bookingId],
      );

      const payload = {
        booking_id: bookingId,
        tenant_id: tenantId,
        booking_reference: bookingReference,
        customer_name: `${dto.customer.firstName} ${dto.customer.lastName}`,
        pickup_address: dto.pickup.address,
        dropoff_address: dto.dropoff.address,
        pickup_at_utc: dto.pickupAtUtc,
        total_price_minor: dto.totalPriceMinor ?? 0,
        currency: dto.currency ?? 'AUD',
      };

      await manager.query(
        `insert into public.outbox_events
         (tenant_id, aggregate_type, aggregate_id,
          event_type, event_schema_version, payload)
         values ($1,'booking',$2,$3,1,$4)`
      , [tenantId, bookingId, BOOKING_EVENTS.BOOKING_CREATED, payload]);

      return { bookingId, bookingReference };
    });
  }

  async transition(
    bookingId: string,
    newStatus: string,
    triggeredBy: string,
    reason?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `select * from public.bookings
         where id = $1 for update`,
        [bookingId],
      );

      if (!rows.length) throw new NotFoundException('Booking not found');
      const booking = rows[0];

      if (booking.operational_status === 'COMPLETED')
        throw new ImmutableBookingError();

      const allowed = ALLOWED_TRANSITIONS[booking.operational_status] ?? [];
      if (!allowed.includes(newStatus))
        throw new ForbiddenException(
          `Cannot transition from ${booking.operational_status} to ${newStatus}`,
        );

      const updateResult = await manager.query(
        `update public.bookings
         set operational_status = $1, updated_at = now()
         where id = $2 and operational_status = $3`,
        [newStatus, bookingId, booking.operational_status],
      );

      if (updateResult[1] === 0)
        throw new ForbiddenException('Concurrent modification detected');

      await manager.query(
        `insert into public.booking_status_history
         (tenant_id, booking_id, previous_status, new_status,
          triggered_by, reason)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          booking.tenant_id,
          bookingId,
          booking.operational_status,
          newStatus,
          triggeredBy,
          reason ?? null,
        ],
      );

      const eventPayload = this.buildEventPayload(
        booking,
        newStatus,
        triggeredBy,
      );

      await manager.query(
        `insert into public.outbox_events
         (tenant_id, aggregate_type, aggregate_id,
          event_type, event_schema_version, payload)
         values ($1,'booking',$2,$3,1,$4)`
      , [
          booking.tenant_id,
          bookingId,
          eventPayload.eventType,
          eventPayload.body,
        ]);

      return { bookingId, previous: booking.operational_status, newStatus };
    });
  }

  private buildEventPayload(booking: any, status: string, actor: string) {
    switch (status) {
      case 'CONFIRMED':
        return {
          eventType: BOOKING_EVENTS.BOOKING_CONFIRMED,
          body: {
            booking_id: booking.id,
            tenant_id: booking.tenant_id,
            booking_reference: booking.booking_reference,
            customer_email: booking.customer_email,
            total_price_minor: booking.total_price_minor,
            currency: booking.currency,
          },
        };
      case 'COMPLETED':
        return {
          eventType: BOOKING_EVENTS.JOB_COMPLETED,
          body: {
            booking_id: booking.id,
            tenant_id: booking.tenant_id,
            booking_reference: booking.booking_reference,
            total_price_minor: booking.total_price_minor,
            currency: booking.currency,
            completed_at: new Date(),
          },
        };
      case 'CANCELLED':
        return {
          eventType: BOOKING_EVENTS.BOOKING_CANCELLED,
          body: {
            booking_id: booking.id,
            tenant_id: booking.tenant_id,
            booking_reference: booking.booking_reference,
            cancelled_by: actor,
          },
        };
      case 'NO_SHOW':
        return {
          eventType: BOOKING_EVENTS.BOOKING_NO_SHOW,
          body: {
            booking_id: booking.id,
            tenant_id: booking.tenant_id,
            booking_reference: booking.booking_reference,
          },
        };
      default:
        throw new Error(`Unsupported transition: ${status}`);
    }
  }
}
