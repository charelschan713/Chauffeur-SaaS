import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DISPATCH_EVENTS } from './dispatch-events';

@Injectable()
export class DispatchTimeoutWorker implements OnModuleInit {
  private readonly logger = new Logger(DispatchTimeoutWorker.name);

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    if (process.env.RUN_DISPATCH_WORKER !== 'true') return;
    setInterval(() => {
      this.handleExpiredOffers().catch((err) =>
        this.logger.error('dispatch worker error', err),
      );
    }, 30_000);
  }

  private async handleExpiredOffers() {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const rows = await manager.query(
        `select id, tenant_id, booking_id, driver_id
         from public.assignments
         where status = 'OFFERED'
           and offered_at < now() - interval '2 minutes'
         for update skip locked`,
      );

      for (const row of rows) {
        await manager.query(
          `update public.assignments
           set status = 'EXPIRED'
           where id = $1`,
          [row.id],
        );

        await manager.query(
          `insert into public.dispatch_assignment_activity (
            tenant_id, assignment_id, activity_type
          ) values ($1,$2,'TIMEOUT')`,
          [row.tenant_id, row.id],
        );

        await manager.query(
          `insert into public.outbox_events (
            tenant_id, aggregate_type, aggregate_id, event_type, event_schema_version, payload
          ) values ($1,'dispatch',$2,$3,1,$4)`,
          [
            row.tenant_id,
            row.id,
            DISPATCH_EVENTS.ASSIGNMENT_EXPIRED,
            {
              tenant_id: row.tenant_id,
              assignment_id: row.id,
              booking_id: row.booking_id,
              driver_id: row.driver_id,
            },
          ],
        );
      }
    });
  }
}
