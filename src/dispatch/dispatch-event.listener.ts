import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { BookingService } from '../booking/booking.service';

@Injectable()
export class DispatchEventListener {
  private readonly logger = new Logger(DispatchEventListener.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly bookingService: BookingService,
  ) {}

  @OnEvent('BookingCancelled')
  async onBookingCancelled(payload: { tenant_id: string; booking_id: string }) {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const rows = await manager.query(
        `select id, status from public.assignments
         where tenant_id = $1 and booking_id = $2
         for update`,
        [payload.tenant_id, payload.booking_id],
      );
      if (!rows.length) return;
      const assignment = rows[0];
      if (['CANCELLED', 'JOB_COMPLETED'].includes(assignment.status)) return;

      await manager.query(
        `update public.assignments set status = 'CANCELLED'
         where id = $1`,
        [assignment.id],
      );

      await manager.query(
        `insert into public.dispatch_assignment_activity (
          tenant_id, assignment_id, activity_type
        ) values ($1,$2,'CANCELLED')`,
        [payload.tenant_id, assignment.id],
      );
    });
  }

  @OnEvent('DriverAcceptedAssignment')
  async onDriverAccepted(payload: { tenant_id: string; booking_id: string; driver_id: string }) {
    try {
      await this.bookingService.transition(payload.booking_id, 'ASSIGNED', payload.driver_id);
    } catch (err) {
      this.logger.error('Failed to sync booking ASSIGNED', err);
    }
  }

  @OnEvent('DriverStartedTrip')
  async onDriverStarted(payload: { tenant_id: string; booking_id: string; driver_id: string }) {
    try {
      await this.bookingService.transition(payload.booking_id, 'IN_PROGRESS', payload.driver_id);
    } catch (err) {
      this.logger.error('Failed to sync booking IN_PROGRESS', err);
    }
  }
}
