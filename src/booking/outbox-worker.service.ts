import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class OutboxWorkerService implements OnModuleInit {
  private readonly logger = new Logger(OutboxWorkerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    if (process.env.RUN_OUTBOX_WORKER !== 'true') return;
    this.resetStuckEvents().catch((err: unknown) => this.logger.error(err));
    setInterval(
      () => this.processBatch().catch((err: unknown) => this.logger.error(err)),
      3000,
    );
  }

  private async resetStuckEvents() {
    await this.dataSource.query(
      `update public.outbox_events set status = 'PENDING'
       where status = 'PROCESSING'
         and created_at < now() - interval '5 minutes'`,
    );
  }

  private async processBatch() {
    const events = await this.dataSource.transaction(async (manager: EntityManager) => {
      const rows = await manager.query(
        `select * from public.outbox_events
         where status = 'PENDING'
           and available_at <= now()
         order by created_at
         for update skip locked
         limit 50`,
      );

      this.logger.log('OutboxWorker tick');

      for (const row of rows) {
        await manager.query(
          `update public.outbox_events
           set status = 'PROCESSING'
           where id = $1`,
          [row.id],
        );
      }

      return rows;
    });

    for (const event of events) {
      try {
        this.logger.log(
          `Processing event: ${event.event_type} payload: ${JSON.stringify(event.payload)}`,
        );
        await this.notificationService.handleEvent(
          event.event_type,
          event.payload,
        );
        this.events.emit(event.event_type, event.payload);
        await this.dataSource.query(
          `update public.outbox_events
           set status = 'PUBLISHED', published_at = now()
           where id = $1`,
          [event.id],
        );
      } catch (err: unknown) {
        const retries = event.retry_count + 1;
        const newStatus = retries >= 5 ? 'FAILED' : 'PENDING';
        await this.dataSource.query(
          `update public.outbox_events
           set retry_count = $1, status = $2
           where id = $3`,
          [retries, newStatus, event.id],
        );
      }
    }
  }
}
