import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AssignmentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  async manualAssign(
    tenantId: string,
    bookingId: string,
    assignedBy: string,
    dto: {
      driver_id: string;
      vehicle_id: string;
      driver_pay_type: string;
      driver_pay_value: number;
      toll_minor?: number;
      parking_minor?: number;
      /** @deprecated use toll_minor + parking_minor */
      toll_parking_minor?: number;
      leg?: 'A' | 'B';
    },
  ) {
    const leg = dto.leg ?? 'A';
    const tollMinor = dto.toll_minor ?? Math.round((dto.toll_parking_minor ?? 0) * 0.7);
    const parkingMinor = dto.parking_minor ?? Math.round((dto.toll_parking_minor ?? 0) * 0.3);
    const tollParkingMinor = tollMinor + parkingMinor;
    // ── Item 1: guard — booking must be CONFIRMED before dispatch ─────────────
    const bookings = await this.dataSource.query(
      `SELECT total_price_minor, pricing_snapshot, operational_status
       FROM public.bookings
       WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!bookings.length) throw new NotFoundException('Booking not found');
    // ASSIGNED is allowed for reassignment; all other non-CONFIRMED states are blocked
    const allowedForDispatch = new Set(['CONFIRMED', 'ASSIGNED']);
    if (!allowedForDispatch.has(bookings[0].operational_status)) {
      throw new BadRequestException(
        `Cannot assign driver: booking must be CONFIRMED or ASSIGNED ` +
        `(current: ${bookings[0].operational_status})`,
      );
    }
    const booking = bookings[0];
    const snapshotTotal = booking.pricing_snapshot?.grand_total_minor ?? null;
    const customerTotal = Number(snapshotTotal ?? booking.total_price_minor ?? 0);

    // Driver base pay (excluding toll)
    const fareOnly = customerTotal - tollParkingMinor;
    let driverPayMinor = 0;
    if (dto.driver_pay_type === 'FIXED') {
      driverPayMinor = Math.round(dto.driver_pay_value * 100);
    } else {
      driverPayMinor = Math.round(fareOnly * (dto.driver_pay_value / 100));
    }
    // Driver total = base pay + toll passthrough
    const driverTotalMinor = driverPayMinor + tollParkingMinor;
    const platformFeeMinor = customerTotal - driverTotalMinor;

    await this.dataSource.query(
      `UPDATE public.assignments
       SET status = 'CANCELLED', cancellation_reason = 'Reassigned by admin'
       WHERE booking_id = $1 AND tenant_id = $2 AND leg = $3
         AND status IN ('PENDING', 'ACCEPTED')`,
      [bookingId, tenantId, leg],
    );

    const rows = await this.dataSource.query(
      `INSERT INTO public.assignments
        (tenant_id, booking_id, driver_id, vehicle_id, status,
         assignment_method, assigned_by, driver_pay_type, driver_pay_value,
         driver_pay_minor, platform_fee_minor, toll_parking_minor,
         toll_minor, parking_minor, offered_at, leg)
       VALUES ($1,$2,$3,$4,'PENDING','MANUAL',$5,$6,$7,$8,$9,$10,$11,$12,now(),$13)
       RETURNING id`,
      [
        tenantId,
        bookingId,
        dto.driver_id,
        dto.vehicle_id,
        assignedBy,
        dto.driver_pay_type,
        dto.driver_pay_value,
        driverTotalMinor,
        platformFeeMinor,
        tollParkingMinor,
        tollMinor,
        parkingMinor,
        leg,
      ],
    );

    // Notify driver of new dispatch
    this.notificationService.handleEvent('DriverNewDispatch', {
      tenant_id: tenantId,
      booking_id: bookingId,
      driver_id: dto.driver_id,
      assignment_id: rows[0].id,
      driver_pay: `AUD ${(driverTotalMinor / 100).toFixed(2)}`,
    }).catch((e) => console.error('[Notification] DriverNewDispatch FAILED:', e?.message));

    return { id: rows[0].id };
  }

  async accept(tenantId: string, assignmentId: string, driverId: string) {
    // ── Item 4: initialise driver_execution_status='accepted' on accept ────────
    await this.dataSource.query(
      `UPDATE public.assignments
       SET status = 'ACCEPTED', accepted_at = now(),
           driver_execution_status = 'accepted'
       WHERE id = $1 AND tenant_id = $2 AND driver_id = $3 AND status = 'PENDING'`,
      [assignmentId, tenantId, driverId],
    );
    const rows = await this.dataSource.query(
      `SELECT booking_id FROM public.assignments WHERE id = $1`,
      [assignmentId],
    );
    if (rows.length) {
      await this.notificationService.handleEvent('DriverAcceptedAssignment', {
        booking_id: rows[0].booking_id,
        driver_id: driverId,
      });
    }
    return { success: true };
  }

  async reject(tenantId: string, assignmentId: string, driverId: string) {
    const rows = await this.dataSource.query(
      `UPDATE public.assignments
       SET status = 'DECLINED', rejected_at = now()
       WHERE id = $1 AND tenant_id = $2 AND driver_id = $3 AND status = 'PENDING'
       RETURNING booking_id`,
      [assignmentId, tenantId, driverId],
    );
    if (rows.length) {
      await this.notificationService.handleEvent('DriverRejectedAssignment', {
        booking_id: rows[0].booking_id,
        driver_id: driverId,
      });
    }
    return { success: true };
  }

  // ─── Partner Assignment ────────────────────────────────────────────────────

  /** Assign booking to a partner tenant */
  async assignToPartner(
    tenantId: string,
    bookingId: string,
    assignedBy: string,
    dto: {
      partner_tenant_id: string;
      partner_pay_type: 'PERCENTAGE' | 'FIXED';
      partner_pay_value: number;
      toll_parking_minor?: number;
      leg?: 'A' | 'B';
    },
  ) {
    const leg = dto.leg ?? 'A';
    const tollParkingMinor = dto.toll_parking_minor ?? 0;

    // Validate connection
    const [conn] = await this.dataSource.query(
      `SELECT id FROM public.tenant_connections
       WHERE status = 'active' AND platform_approved = true
         AND ((requester_id = $1 AND acceptor_id = $2)
           OR (requester_id = $2 AND acceptor_id = $1))`,
      [tenantId, dto.partner_tenant_id],
    );
    if (!conn) throw new ForbiddenException('No active approved connection with this partner');

    // Get booking pricing
    const [booking] = await this.dataSource.query(
      `SELECT total_price_minor, pricing_snapshot, tenant_id
       FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!booking) throw new NotFoundException('Booking not found');

    const customerTotal = Number(
      booking.pricing_snapshot?.grand_total_minor ?? booking.total_price_minor ?? 0,
    );
    const fareOnly = customerTotal - tollParkingMinor;

    let partnerPayMinor = 0;
    if (dto.partner_pay_type === 'FIXED') {
      partnerPayMinor = Math.round(dto.partner_pay_value * 100);
    } else {
      partnerPayMinor = Math.round(fareOnly * (dto.partner_pay_value / 100));
    }
    const partnerGetsMinor = partnerPayMinor + tollParkingMinor;
    const platformFeeMinor = customerTotal - partnerGetsMinor;

    // Cancel any existing pending assignment for this leg
    await this.dataSource.query(
      `UPDATE public.assignments
       SET status = 'CANCELLED', cancellation_reason = 'Replaced by partner assignment'
       WHERE booking_id = $1 AND tenant_id = $2 AND leg = $3
         AND status IN ('PENDING','ACCEPTED')`,
      [bookingId, tenantId, leg],
    );

    // Insert booking_transfer record
    const [transfer] = await this.dataSource.query(
      `INSERT INTO public.booking_transfers
         (booking_id, requester_tenant_id, partner_tenant_id, status,
          partner_pay_type, partner_pay_value, partner_pay_minor,
          toll_parking_minor, partner_platform_fee_minor, created_by)
       VALUES ($1,$2,$3,'PENDING',$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        bookingId, tenantId, dto.partner_tenant_id, dto.partner_pay_type,
        dto.partner_pay_value, partnerGetsMinor, tollParkingMinor,
        platformFeeMinor, assignedBy,
      ],
    );

    // Insert PARTNER assignment
    const [assignment] = await this.dataSource.query(
      `INSERT INTO public.assignments
         (tenant_id, booking_id, assignment_type, partner_tenant_id, transfer_id,
          status, assignment_method, assigned_by,
          partner_pay_type, partner_pay_value, partner_pay_minor,
          partner_platform_fee_minor, toll_parking_minor, offered_at, leg)
       VALUES ($1,$2,'PARTNER',$3,$4,'PENDING','MANUAL',$5,$6,$7,$8,$9,$10,now(),$11)
       RETURNING id`,
      [
        tenantId, bookingId, dto.partner_tenant_id, transfer.id, assignedBy,
        dto.partner_pay_type, dto.partner_pay_value,
        partnerGetsMinor, platformFeeMinor, tollParkingMinor, leg,
      ],
    );

    // Update booking transfer fields
    await this.dataSource.query(
      `UPDATE public.bookings
       SET owner_tenant_id = $2, executor_tenant_id = $3, booking_source = 'TRANSFER_IN',
           updated_at = NOW()
       WHERE id = $1`,
      [bookingId, tenantId, dto.partner_tenant_id],
    );

    await this.notificationService.handleEvent('PartnerTransferSent', {
      booking_id: bookingId,
      partner_tenant_id: dto.partner_tenant_id,
      transfer_id: transfer.id,
    });

    return { id: assignment.id, transfer_id: transfer.id };
  }

  /** Partner tenant accepts the transfer */
  async partnerAccept(tenantId: string, assignmentId: string, acceptedBy: string) {
    const [asgn] = await this.dataSource.query(
      `SELECT a.*, bt.requester_tenant_id
       FROM public.assignments a
       JOIN public.booking_transfers bt ON bt.id = a.transfer_id
       WHERE a.id = $1 AND a.partner_tenant_id = $2 AND a.assignment_type = 'PARTNER'`,
      [assignmentId, tenantId],
    );
    if (!asgn) throw new NotFoundException('Assignment not found');
    if (asgn.status !== 'PENDING') {
      throw new BadRequestException(`Cannot accept assignment in status: ${asgn.status}`);
    }

    await this.dataSource.query(
      `UPDATE public.assignments SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = $1`,
      [assignmentId],
    );
    await this.dataSource.query(
      `UPDATE public.booking_transfers SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = $1`,
      [asgn.transfer_id],
    );

    await this.notificationService.handleEvent('PartnerAcceptedTransfer', {
      booking_id: asgn.booking_id,
      partner_tenant_id: tenantId,
      requester_tenant_id: asgn.requester_tenant_id,
    });

    return { success: true };
  }

  /** Partner tenant rejects the transfer */
  async partnerReject(tenantId: string, assignmentId: string, reason?: string) {
    const [asgn] = await this.dataSource.query(
      `SELECT a.*, bt.requester_tenant_id
       FROM public.assignments a
       JOIN public.booking_transfers bt ON bt.id = a.transfer_id
       WHERE a.id = $1 AND a.partner_tenant_id = $2 AND a.assignment_type = 'PARTNER'`,
      [assignmentId, tenantId],
    );
    if (!asgn) throw new NotFoundException('Assignment not found');

    await this.dataSource.query(
      `UPDATE public.assignments
       SET status = 'DECLINED', cancellation_reason = $2, rejected_at = NOW()
       WHERE id = $1`,
      [assignmentId, reason ?? null],
    );
    await this.dataSource.query(
      `UPDATE public.booking_transfers
       SET status = 'REJECTED', reject_reason = $2, rejected_at = NOW()
       WHERE id = $1`,
      [asgn.transfer_id, reason ?? null],
    );
    // Revert booking source so requester can re-assign
    await this.dataSource.query(
      `UPDATE public.bookings
       SET executor_tenant_id = owner_tenant_id, updated_at = NOW()
       WHERE id = $1`,
      [asgn.booking_id],
    );

    await this.notificationService.handleEvent('PartnerRejectedTransfer', {
      booking_id: asgn.booking_id,
      partner_tenant_id: tenantId,
      requester_tenant_id: asgn.requester_tenant_id,
    });

    return { success: true };
  }

  /** Cancel a pending partner transfer (requester side) */
  async cancelPartnerTransfer(tenantId: string, assignmentId: string) {
    const [asgn] = await this.dataSource.query(
      `SELECT * FROM public.assignments
       WHERE id = $1 AND tenant_id = $2 AND assignment_type = 'PARTNER' AND status = 'PENDING'`,
      [assignmentId, tenantId],
    );
    if (!asgn) throw new NotFoundException('Pending partner assignment not found');

    await this.dataSource.query(
      `UPDATE public.assignments SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = $1`,
      [assignmentId],
    );
    await this.dataSource.query(
      `UPDATE public.booking_transfers SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = $1`,
      [asgn.transfer_id],
    );
    await this.dataSource.query(
      `UPDATE public.bookings
       SET executor_tenant_id = owner_tenant_id, updated_at = NOW()
       WHERE id = $1`,
      [asgn.booking_id],
    );

    return { success: true };
  }

  /** Get approved connections for this tenant (for partner selector dropdown) */
  async getApprovedConnections(tenantId: string) {
    return this.dataSource.query(
      `SELECT tc.id AS connection_id,
              CASE WHEN tc.requester_id = $1 THEN tc.acceptor_id ELSE tc.requester_id END AS partner_tenant_id,
              CASE WHEN tc.requester_id = $1 THEN ta.name ELSE tr.name END AS partner_name
       FROM public.tenant_connections tc
       JOIN public.tenants tr ON tr.id = tc.requester_id
       JOIN public.tenants ta ON ta.id = tc.acceptor_id
       WHERE tc.status = 'active' AND tc.platform_approved = true
         AND (tc.requester_id = $1 OR tc.acceptor_id = $1)`,
      [tenantId],
    );
  }

  async updateDriverPay(
    tenantId: string,
    assignmentId: string,
    dto: { driver_pay_type: string; driver_pay_value: number },
  ) {
    const rows = await this.dataSource.query(
      `SELECT status, booking_id FROM public.assignments
       WHERE id = $1 AND tenant_id = $2`,
      [assignmentId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Assignment not found');
    const assignment = rows[0];
    if (assignment.status === 'JOB_STARTED') {
      throw new BadRequestException('Cannot modify driver pay while job is in progress');
    }

    const bookings = await this.dataSource.query(
      `SELECT total_price_minor, pricing_snapshot FROM public.bookings WHERE id = $1`,
      [assignment.booking_id],
    );
    const snapshotTotal = bookings[0]?.pricing_snapshot?.grand_total_minor ?? null;
    const customerTotal = Number(snapshotTotal ?? bookings[0]?.total_price_minor ?? 0);

    let driverPayMinor = 0;
    if (dto.driver_pay_type === 'FIXED') {
      driverPayMinor = Math.round(dto.driver_pay_value * 100);
    } else {
      driverPayMinor = Math.round(customerTotal * (dto.driver_pay_value / 100));
    }

    await this.dataSource.query(
      `UPDATE public.assignments
       SET driver_pay_type = $3,
           driver_pay_value = $4,
           driver_pay_minor = $5,
           platform_fee_minor = $6
       WHERE id = $1 AND tenant_id = $2`,
      [assignmentId, tenantId, dto.driver_pay_type, dto.driver_pay_value, driverPayMinor, customerTotal - driverPayMinor],
    );

    await this.notificationService.handleEvent('DriverPayUpdated', {
      booking_id: assignment.booking_id,
      assignment_id: assignmentId,
    });

    return { success: true };
  }

  /** Admin: get all jobs for a driver */
  async getJobsByDriver(tenantId: string, driverId: string, filter: string = 'upcoming', from?: string, to?: string) {
    let whereClause = '';
    if (from && to) {
      whereClause = `AND b.pickup_at_utc >= '${from}'::timestamptz AND b.pickup_at_utc < '${to}'::timestamptz AND a.status::text NOT IN ('CANCELLED','REJECTED')`;
    } else if (filter === 'upcoming') {
      whereClause = `AND b.pickup_at_utc >= now() AND a.status::text NOT IN ('CANCELLED','REJECTED')`;
    } else if (filter === 'completed') {
      whereClause = `AND a.status = 'JOB_DONE'`;
    } else if (filter === 'active') {
      whereClause = `AND a.status IN ('ACCEPTED','ON_THE_WAY','ARRIVED','PASSENGER_ON_BOARD')`;
    }

    const rows = await this.dataSource.query(
      `SELECT
         a.id AS assignment_id,
         a.status AS assignment_status,
         a.driver_pay_minor,
         a.created_at AS assigned_at,
         b.id AS booking_id,
         b.booking_reference AS reference,
         b.pickup_at_utc,
         b.pickup_address,
         b.dropoff_address,
         b.operational_status AS booking_status,
         b.total_price_minor,
         b.currency,
         b.passenger_name,
         b.passenger_phone,
         sc.name AS service_class_name
       FROM public.assignments a
       JOIN public.bookings b ON b.id = a.booking_id
       LEFT JOIN public.tenant_service_classes sc ON sc.id = b.service_class_id
       WHERE a.tenant_id = $1
         AND a.driver_id = $2
         ${whereClause}
       ORDER BY b.pickup_at_utc ASC
       LIMIT 100`,
      [tenantId, driverId],
    );

    return { jobs: rows, total: rows.length };
  }
}
