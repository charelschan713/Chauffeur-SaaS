import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DISPATCH_EVENTS } from './dispatch-events';
import { v4 as uuidv4 } from 'uuid';

interface AssignmentRecord {
  id: string;
  tenant_id: string;
  booking_id: string;
  driver_id: string | null;
  status: string;
}

@Injectable()
export class DispatchService {
  private readonly OFFER_TIMEOUT_MINUTES = 2;

  constructor(private readonly dataSource: DataSource) {}

  async offerAssignment(
    tenantId: string,
    bookingId: string,
    driverId: string,
    vehicleId: string,
    dispatcherId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.ensureBookingConfirmed(manager, tenantId, bookingId);
      await this.ensureDriverAvailable(manager, tenantId, driverId);

      const assignment = await this.upsertAssignment(
        manager,
        tenantId,
        bookingId,
        driverId,
        vehicleId,
      );

      await manager.query(
        `insert into public.dispatch_assignment_activity (
          tenant_id, assignment_id, activity_type, performed_by
        ) values ($1,$2,'OFFERED',$3)`,
        [tenantId, assignment.id, dispatcherId],
      );

      await this.insertOutboxEvent(manager, tenantId, bookingId, assignment.id, DISPATCH_EVENTS.DRIVER_INVITATION_SENT, {
        tenant_id: tenantId,
        booking_id: bookingId,
        assignment_id: assignment.id,
        driver_id: driverId,
        vehicle_id: vehicleId,
      });

      return assignment;
    });
  }

  async driverAccept(tenantId: string, assignmentId: string, driverId: string) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.getAssignmentForUpdate(manager, assignmentId, tenantId);
      if (assignment.status !== 'OFFERED') throw new BadRequestException('Assignment not offered');
      if (assignment.driver_id !== driverId) throw new ForbiddenException('Driver mismatch');

      await manager.query(
        `update public.assignments set status = 'ACCEPTED'
         where id = $1`,
        [assignmentId],
      );

      await manager.query(
        `insert into public.dispatch_assignment_activity (
          tenant_id, assignment_id, activity_type, performed_by
        ) values ($1,$2,'DRIVER_ACCEPTED',$3)`,
        [tenantId, assignmentId, driverId],
      );

      await this.insertOutboxEvent(manager, tenantId, assignment.booking_id, assignmentId, DISPATCH_EVENTS.DRIVER_ACCEPTED_ASSIGNMENT, {
        tenant_id: tenantId,
        booking_id: assignment.booking_id,
        assignment_id: assignmentId,
        driver_id: driverId,
      });

      return { assignmentId, status: 'ACCEPTED' };
    });
  }

  async driverDecline(
    tenantId: string,
    assignmentId: string,
    driverId: string,
    reason?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.getAssignmentForUpdate(manager, assignmentId, tenantId);
      if (assignment.status !== 'OFFERED') throw new BadRequestException('Assignment not offered');
      if (assignment.driver_id !== driverId) throw new ForbiddenException('Driver mismatch');

      await manager.query(
        `update public.assignments set status = 'DECLINED'
         where id = $1`,
        [assignmentId],
      );

      await manager.query(
        `insert into public.dispatch_assignment_activity (
          tenant_id, assignment_id, activity_type, performed_by, reason
        ) values ($1,$2,'DRIVER_DECLINED',$3,$4)`,
        [tenantId, assignmentId, driverId, reason ?? null],
      );

      await this.insertOutboxEvent(manager, tenantId, assignment.booking_id, assignmentId, DISPATCH_EVENTS.DRIVER_DECLINED_ASSIGNMENT, {
        tenant_id: tenantId,
        booking_id: assignment.booking_id,
        assignment_id: assignmentId,
        driver_id: driverId,
        reason,
      });

      return { assignmentId, status: 'DECLINED' };
    });
  }

  async startTrip(tenantId: string, assignmentId: string, driverId: string) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.getAssignmentForUpdate(manager, assignmentId, tenantId);
      if (assignment.status !== 'ACCEPTED') throw new BadRequestException('Assignment not accepted');
      if (assignment.driver_id !== driverId) throw new ForbiddenException('Driver mismatch');

      await manager.query(
        `update public.assignments set status = 'JOB_STARTED'
         where id = $1`,
        [assignmentId],
      );

      await manager.query(
        `update public.dispatch_driver_status
         set status = 'ON_JOB', updated_at = now()
         where tenant_id = $1 and driver_id = $2`,
        [tenantId, driverId],
      );

      await manager.query(
        `insert into public.dispatch_assignment_activity (
          tenant_id, assignment_id, activity_type, performed_by
        ) values ($1,$2,'JOB_STARTED',$3)`,
        [tenantId, assignmentId, driverId],
      );

      await this.insertOutboxEvent(manager, tenantId, assignment.booking_id, assignmentId, DISPATCH_EVENTS.DRIVER_STARTED_TRIP, {
        tenant_id: tenantId,
        booking_id: assignment.booking_id,
        assignment_id: assignmentId,
        driver_id: driverId,
      });

      return { assignmentId, status: 'JOB_STARTED' };
    });
  }

  async completeTrip(tenantId: string, assignmentId: string, driverId: string) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.getAssignmentForUpdate(manager, assignmentId, tenantId);
      if (assignment.status !== 'JOB_STARTED') throw new BadRequestException('Trip not started');
      if (assignment.driver_id !== driverId) throw new ForbiddenException('Driver mismatch');

      await manager.query(
        `update public.assignments
         set status = 'JOB_COMPLETED', completed_at = now()
         where id = $1`,
        [assignmentId],
      );

      await manager.query(
        `update public.dispatch_driver_status
         set status = 'AVAILABLE', updated_at = now()
         where tenant_id = $1 and driver_id = $2`,
        [tenantId, driverId],
      );

      await manager.query(
        `insert into public.dispatch_assignment_activity (
          tenant_id, assignment_id, activity_type, performed_by
        ) values ($1,$2,'JOB_COMPLETED',$3)`,
        [tenantId, assignmentId, driverId],
      );

      await this.insertOutboxEvent(manager, tenantId, assignment.booking_id, assignmentId, DISPATCH_EVENTS.DRIVER_COMPLETED_TRIP, {
        tenant_id: tenantId,
        booking_id: assignment.booking_id,
        assignment_id: assignmentId,
        driver_id: driverId,
      });

      return { assignmentId, status: 'JOB_COMPLETED' };
    });
  }

  private async ensureBookingConfirmed(
    manager: EntityManager,
    tenantId: string,
    bookingId: string,
  ) {
    const rows = await manager.query(
      `select operational_status from public.bookings
       where id = $1 and tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    if (rows[0].operational_status !== 'CONFIRMED') {
      throw new BadRequestException('Booking must be CONFIRMED');
    }
  }

  private async ensureDriverAvailable(
    manager: EntityManager,
    tenantId: string,
    driverId: string,
  ) {
    const rows = await manager.query(
      `select status from public.dispatch_driver_status
       where tenant_id = $1 and driver_id = $2`,
      [tenantId, driverId],
    );
    if (rows.length && rows[0].status !== 'AVAILABLE') {
      throw new BadRequestException('Driver not available');
    }
  }

  private async upsertAssignment(
    manager: EntityManager,
    tenantId: string,
    bookingId: string,
    driverId: string,
    vehicleId: string,
  ) {
    const rows = await manager.query(
      `select id, status, driver_id
       from public.assignments
       where tenant_id = $1 and booking_id = $2
       limit 1`,
      [tenantId, bookingId],
    );

    if (!rows.length) {
      const id = uuidv4();
      await manager.query(
        `insert into public.assignments (
           id, tenant_id, booking_id, driver_id, vehicle_id, status, offered_at
         ) values ($1,$2,$3,$4,$5,'OFFERED',now())`,
        [id, tenantId, bookingId, driverId, vehicleId],
      );
      return { id, booking_id: bookingId };
    }

    const assignment = rows[0];
    await manager.query(
      `update public.assignments
       set driver_id = $1, vehicle_id = $2, status = 'OFFERED', offered_at = now()
       where id = $3`,
      [driverId, vehicleId, assignment.id],
    );
    return { id: assignment.id, booking_id: bookingId };
  }

  private async getAssignmentForUpdate(
    manager: EntityManager,
    assignmentId: string,
    tenantId: string,
  ): Promise<AssignmentRecord> {
    const rows = await manager.query(
      `select id, tenant_id, booking_id, driver_id, status
       from public.assignments
       where id = $1 and tenant_id = $2
       for update`,
      [assignmentId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Assignment not found');
    return rows[0];
  }

  private async insertOutboxEvent(
    manager: EntityManager,
    tenantId: string,
    bookingId: string,
    assignmentId: string,
    eventType: string,
    payload: Record<string, any>,
  ) {
    await manager.query(
      `insert into public.outbox_events (
        tenant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        event_schema_version,
        payload
      ) values ($1,'dispatch',$2,$3,1,$4)`,
      [tenantId, assignmentId, eventType, payload],
    );
  }
}
