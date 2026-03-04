import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      toll_parking_minor?: number;
      leg?: 'A' | 'B';
    },
  ) {
    const leg = dto.leg ?? 'A';
    const tollParkingMinor = dto.toll_parking_minor ?? 0;
    const bookings = await this.dataSource.query(
      `SELECT total_price_minor, pricing_snapshot
       FROM public.bookings
       WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!bookings.length) throw new NotFoundException('Booking not found');
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
         driver_pay_minor, platform_fee_minor, toll_parking_minor, offered_at, leg)
       VALUES ($1,$2,$3,$4,'PENDING','MANUAL',$5,$6,$7,$8,$9,$10,now(),$11)
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
        leg,
      ],
    );

    await this.notificationService.handleEvent('DriverInvitationSent', {
      booking_id: bookingId,
      driver_id: dto.driver_id,
    });

    return { id: rows[0].id };
  }

  async accept(tenantId: string, assignmentId: string, driverId: string) {
    await this.dataSource.query(
      `UPDATE public.assignments
       SET status = 'ACCEPTED', accepted_at = now()
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
}
