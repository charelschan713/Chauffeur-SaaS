import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class PlatformSyncService implements OnModuleInit {
  private readonly logger = new Logger(PlatformSyncService.name);
  private readonly intervalMs = 60 * 60 * 1000; // hourly

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    const url = process.env.TARGET_SUPABASE_URL;
    const key = process.env.TARGET_SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      this.logger.warn('Platform sync disabled: TARGET_SUPABASE_URL / TARGET_SUPABASE_SERVICE_KEY missing');
      return;
    }
    // run once on startup
    this.sync().catch(err => this.logger.error('Initial platform sync failed', err));
    // then hourly
    setInterval(() => this.sync().catch(err => this.logger.error('Platform sync failed', err)), this.intervalMs);
  }

  private async sync() {
    const url = process.env.TARGET_SUPABASE_URL as string;
    const key = process.env.TARGET_SUPABASE_SERVICE_KEY as string;
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Source of truth: platform_vehicles (SaaS)
    const rows = await this.dataSource.query(
      `SELECT id, make, model, active, created_at, updated_at
       FROM public.platform_vehicles
       ORDER BY make, model ASC`
    );

    const payload = rows.map((r: any) => ({
      platform_car_type_id: r.id,
      name: [r.make, r.model].filter(Boolean).join(' ').trim() || 'Unnamed',
      class: null,
      passengers: null,
      luggage: null,
      base_fare_minor: null,
      min_fare_minor: null,
      per_km_minor: null,
      hourly_minor: null,
      active: r.active ?? true,
      updated_at: r.updated_at ?? new Date().toISOString(),
    }));

    if (!payload.length) {
      this.logger.warn('No platform vehicles found to sync');
      return;
    }

    const { error } = await supabase
      .from('platform_car_types')
      .upsert(payload, { onConflict: 'platform_car_type_id' });

    if (error) {
      this.logger.error('Supabase upsert failed', error);
      throw error;
    }

    // Soft-disable missing
    const ids = rows.map((r: any) => r.id);
    await supabase
      .from('platform_car_types')
      .update({ active: false })
      .not('platform_car_type_id', 'in', `(${ids.join(',')})`);

    this.logger.log(`Synced ${payload.length} platform car types`);
  }
}
