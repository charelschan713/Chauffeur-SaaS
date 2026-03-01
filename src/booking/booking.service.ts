import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
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

  async listBookings(tenantId: string, query: Record<string, any>) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE b.tenant_id = $1';
    const params: any[] = [tenantId];
    let index = 2;

    if (query.operational_status) {
      where += ` AND b.operational_status = ANY($${index}::text[])`;
      params.push(String(query.operational_status).split(','));
      index++;
    }

    if (query.date_from) {
      where += ` AND b.pickup_at_utc >= $${index}`;
      params.push(query.date_from);
      index++;
    }

    if (query.date_to) {
      where += ` AND b.pickup_at_utc <= $${index}`;
      params.push(query.date_to);
      index++;
    }

    if (query.search) {
      where += ` AND (b.booking_reference ILIKE $${index} OR b.customer_first_name ILIKE $${index} OR b.customer_last_name ILIKE $${index})`;
      params.push(`%${query.search}%`);
      index++;
    }

    const countResult = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.bookings b ${where}`,
      params,
    );
    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.dataSource.query(
      `SELECT 
        b.id,
        b.booking_reference,
        b.booking_source,
        b.customer_first_name,
        b.customer_last_name,
        b.operational_status,
        b.payment_status,
        b.pickup_at_utc,
        b.timezone,
        b.pickup_address_text,
        b.dropoff_address_text,
        b.total_price_minor,
        b.currency,
        a.driver_id,
        a.status as assignment_status
       FROM public.bookings b
       LEFT JOIN public.assignments a
         ON a.booking_id = b.id
         AND a.status NOT IN ('CANCELLED','DECLINED','EXPIRED')
       ${where}
       ORDER BY b.pickup_at_utc DESC
       LIMIT $${index} OFFSET $${index + 1}`,
      [...params, limit, offset],
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        has_next: page * limit < total,
      },
    };
  }

  async getBookingDetail(tenantId: string, bookingId: string) {
    const bookings = await this.dataSource.query(
      `SELECT * FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!bookings.length) throw new NotFoundException('Booking not found');
    const booking = bookings[0];

    const [history, assignments, payments] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM public.booking_status_history
         WHERE booking_id = $1
         ORDER BY created_at ASC`,
        [bookingId],
      ),
      this.dataSource.query(
        `SELECT a.*, u.full_name as driver_name
           FROM public.assignments a
           LEFT JOIN public.users u ON u.id = a.driver_id
          WHERE a.booking_id = $1
          ORDER BY a.created_at DESC`,
        [bookingId],
      ),
      this.dataSource.query(
        `SELECT * FROM public.payments
          WHERE booking_id = $1
          ORDER BY created_at ASC`,
        [bookingId],
      ),
    ]);

    const summary = payments.length
      ? {
          authorized_minor: payments[0].amount_authorized_minor ?? 0,
          captured_minor: payments[0].amount_captured_minor ?? 0,
          refunded_minor: payments[0].amount_refunded_minor ?? 0,
          currency: payments[0].currency ?? 'AUD',
        }
      : null;

    return {
      booking,
      status_history: history,
      assignments,
      payments: payments.length
        ? {
            items: payments,
            summary,
          }
        : null,
    };
  }

  async createBooking(tenantId: string, dto: any) {
    const clientRequestId = dto.clientRequestId ?? randomUUID();

    const existing = await this.dataSource.query(
      `select booking_id from public.idempotency_keys
       where tenant_id = $1 and client_request_id = $2`,
      [tenantId, clientRequestId],
    );
    if (existing.length) return { bookingId: existing[0].booking_id };

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const bookingId = randomUUID();
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
    return this.dataSource.transaction(async (manager: EntityManager) => {
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

  async cancelBooking(
    tenantId: string,
    bookingId: string,
    triggeredBy: string,
    reason?: string,
  ) {
    const rows = await this.dataSource.query(
      `SELECT tenant_id FROM public.bookings WHERE id = $1`,
      [bookingId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    if (rows[0].tenant_id !== tenantId) {
      throw new ForbiddenException('Booking does not belong to tenant');
    }

    return this.transition(bookingId, 'CANCELLED', triggeredBy, reason);
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


