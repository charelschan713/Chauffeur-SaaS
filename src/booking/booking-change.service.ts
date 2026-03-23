import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotificationService } from '../notification/notification.service';

const DIRECT_EDIT_STATUSES = new Set([
  'PENDING',
  'PENDING_CONFIRMATION',
  'PENDING_ADMIN_CONFIRMATION',
  'AWAITING_CONFIRMATION',
]);

const REQUEST_ALLOWED_STATUSES = new Set([
  'CONFIRMED',
  'ASSIGNED',
]);

const LOCKED_STATUSES = new Set([
  'ON_THE_WAY',
  'ARRIVED',
  'POB',
  'JOB_DONE',
  'FULFILLED',
  'COMPLETED',
]);

const INTERNAL_ONLY_FIELDS = new Set([
  'internal_notes',
  'ops_notes',
  'internal_tags',
  'assignment_notes',
]);

const CHANGE_STATUSES = {
  PENDING_CUSTOMER_APPROVAL: 'PENDING_CUSTOMER_APPROVAL',
  PENDING_ADMIN_REVIEW: 'PENDING_ADMIN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

@Injectable()
export class BookingChangeService {
  private bookingColumns: Set<string> | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  private async ensureChangeRequestColumns() {
    await this.db.query(
      `ALTER TABLE public.booking_change_requests
         ADD COLUMN IF NOT EXISTS approval_token text,
         ADD COLUMN IF NOT EXISTS approval_token_expires_at timestamptz`,
    ).catch(() => {});
  }

  private async loadBookingColumns(): Promise<Set<string>> {
    if (this.bookingColumns) return this.bookingColumns;
    const rows = await this.db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'`,
    );
    this.bookingColumns = new Set(rows.map((r: any) => r.column_name));
    return this.bookingColumns;
  }

  private filterPayloadByColumns(payload: Record<string, any>) {
    const filtered: Record<string, any> = {};
    const keys = Object.keys(payload ?? {});
    return this.loadBookingColumns().then((cols) => {
      for (const key of keys) {
        if (cols.has(key)) filtered[key] = payload[key];
      }
      return filtered;
    });
  }

  private mergeSnapshots(oldSnapshot: any, changePayload: Record<string, any>) {
    return { ...oldSnapshot, ...changePayload };
  }

  private computePriceDelta(oldSnapshot: any, newSnapshot: any) {
    const oldPrice =
      oldSnapshot?.pricing_snapshot?.final_fare_minor ??
      oldSnapshot?.pricing_snapshot?.grand_total_minor ??
      oldSnapshot?.total_price_minor ??
      null;
    const newPrice =
      newSnapshot?.pricing_snapshot?.final_fare_minor ??
      newSnapshot?.pricing_snapshot?.grand_total_minor ??
      newSnapshot?.total_price_minor ??
      null;
    if (typeof oldPrice !== 'number' || typeof newPrice !== 'number') return null;
    return newPrice - oldPrice;
  }

  private async getBooking(tenantId: string, bookingId: string) {
    const rows = await this.db.query(
      `SELECT * FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    return rows[0];
  }

  private statusCategory(status: string) {
    if (DIRECT_EDIT_STATUSES.has(status)) return 'DIRECT_EDIT';
    if (REQUEST_ALLOWED_STATUSES.has(status)) return 'REQUEST_ONLY';
    if (LOCKED_STATUSES.has(status)) return 'LOCKED';
    return 'LOCKED';
  }

  async customerModifyBooking(params: {
    tenantId: string;
    bookingId: string;
    customerId: string;
    changePayload: Record<string, any>;
  }) {
    const booking = await this.getBooking(params.tenantId, params.bookingId);
    if (booking.customer_id !== params.customerId) {
      throw new ForbiddenException('Booking does not belong to customer');
    }

    const category = this.statusCategory(booking.operational_status);
    const filteredPayload = await this.filterPayloadByColumns(params.changePayload);
    if (!Object.keys(filteredPayload).length) {
      throw new BadRequestException('No valid booking fields to modify');
    }

    if (category === 'DIRECT_EDIT') {
      await this.applyBookingUpdate(params.tenantId, params.bookingId, filteredPayload);
      return { mode: 'DIRECT_EDIT', bookingId: params.bookingId };
    }

    if (category === 'REQUEST_ONLY') {
      const oldSnapshot = booking;
      const newSnapshot = this.mergeSnapshots(booking, filteredPayload);
      const priceDelta = this.computePriceDelta(oldSnapshot, newSnapshot);

      const change = await this.createChangeRequest({
        tenantId: params.tenantId,
        bookingId: params.bookingId,
        proposedByRole: 'customer',
        proposedById: params.customerId,
        changePayload: filteredPayload,
        oldSnapshot,
        newSnapshot,
        priceDelta,
        status: CHANGE_STATUSES.PENDING_ADMIN_REVIEW,
      });

      return { mode: 'REQUEST', changeRequestId: change.id };
    }

    throw new BadRequestException('Booking can no longer be modified');
  }

  async adminProposeChange(params: {
    tenantId: string;
    bookingId: string;
    adminId: string;
    changePayload: Record<string, any>;
  }) {
    const booking = await this.getBooking(params.tenantId, params.bookingId);
    const filteredPayload = await this.filterPayloadByColumns(params.changePayload);
    if (!Object.keys(filteredPayload).length) {
      throw new BadRequestException('No valid booking fields to modify');
    }

    const keys = Object.keys(filteredPayload);
    const internalOnly = keys.every((k) => INTERNAL_ONLY_FIELDS.has(k));

    if (internalOnly) {
      await this.applyBookingUpdate(params.tenantId, params.bookingId, filteredPayload);
      return { mode: 'INTERNAL_EDIT', bookingId: params.bookingId };
    }

    const oldSnapshot = booking;
    const newSnapshot = this.mergeSnapshots(booking, filteredPayload);
    const priceDelta = this.computePriceDelta(oldSnapshot, newSnapshot);

    const approvalToken = crypto.randomUUID();
    const approvalTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

    const change = await this.createChangeRequest({
      tenantId: params.tenantId,
      bookingId: params.bookingId,
      proposedByRole: 'admin',
      proposedById: params.adminId,
      changePayload: filteredPayload,
      oldSnapshot,
      newSnapshot,
      priceDelta,
      status: CHANGE_STATUSES.PENDING_CUSTOMER_APPROVAL,
      approvalToken,
      approvalTokenExpiresAt,
    });

    // Mark booking awaiting customer approval
    await this.db.query(
      `UPDATE public.bookings
       SET operational_status = 'AWAITING_CUSTOMER_APPROVAL', updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [params.bookingId, params.tenantId],
    ).catch(() => {});

    await this.db.query(
      `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,'AWAITING_CUSTOMER_APPROVAL',$4,'Admin proposed change',now())`,
      [params.tenantId, params.bookingId, booking.operational_status, params.adminId],
    ).catch(() => {});

    const approvalUrl = `${process.env.CUSTOMER_PORTAL_URL ?? 'https://aschauffeured.chauffeurssolution.com'}/booking-changes/approve?token=${approvalToken}`;

    // Notify customer (best-effort)
    this.notificationService
      .handleEvent('BookingChangeProposed', {
        tenant_id: params.tenantId,
        booking_id: params.bookingId,
        change_request_id: change.id,
        old_snapshot: oldSnapshot,
        new_snapshot: newSnapshot,
        price_delta_minor: priceDelta,
        approval_url: approvalUrl,
      })
      .catch(() => {});

    return { mode: 'PROPOSED', changeRequestId: change.id, approvalUrl };
  }

  private async createChangeRequest(params: {
    tenantId: string;
    bookingId: string;
    proposedByRole: 'admin' | 'customer';
    proposedById: string;
    changePayload: Record<string, any>;
    oldSnapshot: any;
    newSnapshot: any;
    priceDelta: number | null;
    status: typeof CHANGE_STATUSES[keyof typeof CHANGE_STATUSES];
    approvalToken?: string | null;
    approvalTokenExpiresAt?: string | null;
  }) {
    await this.ensureChangeRequestColumns();
    const [row] = await this.db.query(
      `INSERT INTO public.booking_change_requests
        (tenant_id, booking_id, proposed_by_role, proposed_by_id,
         change_payload, old_snapshot, new_snapshot, price_delta_minor, status,
         approval_token, approval_token_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        params.tenantId,
        params.bookingId,
        params.proposedByRole,
        params.proposedById,
        params.changePayload,
        params.oldSnapshot,
        params.newSnapshot,
        params.priceDelta,
        params.status,
        params.approvalToken ?? null,
        params.approvalTokenExpiresAt ?? null,
      ],
    );
    return row;
  }

  async listChangeRequests(tenantId: string, bookingId: string) {
    return this.db.query(
      `SELECT * FROM public.booking_change_requests
       WHERE tenant_id = $1 AND booking_id = $2
       ORDER BY created_at DESC`,
      [tenantId, bookingId],
    );
  }

  async approveChangeRequest(params: {
    tenantId: string;
    bookingId: string;
    changeRequestId: string;
  }) {
    const rows = await this.db.query(
      `SELECT * FROM public.booking_change_requests
       WHERE id = $1 AND tenant_id = $2 AND booking_id = $3`,
      [params.changeRequestId, params.tenantId, params.bookingId],
    );
    if (!rows.length) throw new NotFoundException('Change request not found');

    const cr = rows[0];
    if (cr.status !== CHANGE_STATUSES.PENDING_CUSTOMER_APPROVAL && cr.status !== CHANGE_STATUSES.PENDING_ADMIN_REVIEW) {
      throw new BadRequestException('Change request not pending');
    }

    await this.applyBookingUpdate(params.tenantId, params.bookingId, cr.change_payload);

    await this.db.query(
      `UPDATE public.booking_change_requests
       SET status = $1, approved_at = now()
       WHERE id = $2`,
      [CHANGE_STATUSES.APPROVED, params.changeRequestId],
    );

    return { status: CHANGE_STATUSES.APPROVED };
  }

  async approveChangeByToken(params: { token: string }) {
    await this.ensureChangeRequestColumns();
    const rows = await this.db.query(
      `SELECT * FROM public.booking_change_requests
       WHERE approval_token = $1 AND status = $2`,
      [params.token, CHANGE_STATUSES.PENDING_CUSTOMER_APPROVAL],
    );
    if (!rows.length) throw new NotFoundException('Change request not found');

    const cr = rows[0];
    if (cr.approval_token_expires_at && new Date(cr.approval_token_expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Approval link expired');
    }

    // Load booking + customer stripe customer id
    const bookingRows = await this.db.query(
      `SELECT b.*, c.stripe_customer_id
       FROM public.bookings b
       JOIN public.customers c ON c.id = b.customer_id
       WHERE b.id = $1 AND b.tenant_id = $2`,
      [cr.booking_id, cr.tenant_id],
    );
    if (!bookingRows.length) throw new NotFoundException('Booking not found');
    const b = bookingRows[0];

    // If price delta is positive, charge the difference off-session
    const delta = cr.price_delta_minor ?? 0;
    if (delta > 0) {
      // Require saved payment method
      const pmRows = await this.db.query(
        `SELECT stripe_payment_method_id FROM public.saved_payment_methods
         WHERE customer_id = $1 AND tenant_id = $2 AND is_default = true LIMIT 1`,
        [b.customer_id, cr.tenant_id],
      );
      if (!pmRows.length) throw new BadRequestException('No default payment method saved');

      const intRows = await this.db.query(
        `SELECT stripe_secret_key FROM public.tenant_settings WHERE tenant_id = $1 LIMIT 1`,
        [cr.tenant_id],
      );
      const secretKey = intRows[0]?.stripe_secret_key ?? process.env.STRIPE_SECRET_KEY;
      if (!secretKey) throw new BadRequestException('Stripe not configured');

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(secretKey);

      try {
        await stripe.paymentIntents.create({
          amount: delta,
          currency: (b.currency ?? 'AUD').toLowerCase(),
          customer: b.stripe_customer_id,
          payment_method: pmRows[0].stripe_payment_method_id,
          confirm: true,
          off_session: true,
          metadata: { tenant_id: cr.tenant_id, booking_id: b.id, payment_type: 'CHANGE_DELTA' },
        });
      } catch (err: any) {
        throw new BadRequestException(`Charge failed: ${err?.message ?? 'unknown error'}`);
      }
    }

    // Apply changes after charge success (or no charge needed)
    await this.applyBookingUpdate(cr.tenant_id, cr.booking_id, cr.change_payload);

    // Update booking status back to CONFIRMED
    await this.db.query(
      `UPDATE public.bookings
       SET operational_status = 'CONFIRMED', updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [cr.booking_id, cr.tenant_id],
    ).catch(() => {});

    await this.db.query(
      `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,'CONFIRMED',NULL,'Customer approved change',now())`,
      [cr.tenant_id, cr.booking_id, b.operational_status],
    ).catch(() => {});

    await this.db.query(
      `UPDATE public.booking_change_requests
       SET status = $1, approved_at = now()
       WHERE id = $2`,
      [CHANGE_STATUSES.APPROVED, cr.id],
    );

    return { status: CHANGE_STATUSES.APPROVED };
  }

  async rejectChangeRequest(params: {
    tenantId: string;
    bookingId: string;
    changeRequestId: string;
  }) {
    const rows = await this.db.query(
      `SELECT * FROM public.booking_change_requests
       WHERE id = $1 AND tenant_id = $2 AND booking_id = $3`,
      [params.changeRequestId, params.tenantId, params.bookingId],
    );
    if (!rows.length) throw new NotFoundException('Change request not found');

    const cr = rows[0];
    if (cr.status !== CHANGE_STATUSES.PENDING_CUSTOMER_APPROVAL && cr.status !== CHANGE_STATUSES.PENDING_ADMIN_REVIEW) {
      throw new BadRequestException('Change request not pending');
    }

    await this.db.query(
      `UPDATE public.booking_change_requests
       SET status = $1, rejected_at = now()
       WHERE id = $2`,
      [CHANGE_STATUSES.REJECTED, params.changeRequestId],
    );

    return { status: CHANGE_STATUSES.REJECTED };
  }

  private async applyBookingUpdate(tenantId: string, bookingId: string, payload: Record<string, any>) {
    const keys = Object.keys(payload);
    if (!keys.length) return;

    const sets: string[] = [];
    const values: any[] = [bookingId, tenantId];
    let idx = 3;
    for (const key of keys) {
      sets.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
    sets.push(`updated_at = now()`);

    await this.db.query(
      `UPDATE public.bookings
       SET ${sets.join(', ')}
       WHERE id = $1 AND tenant_id = $2`,
      values,
    );
  }
}
