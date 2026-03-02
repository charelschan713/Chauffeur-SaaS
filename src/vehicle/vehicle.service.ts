import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class VehicleService {
  constructor(private readonly dataSource: DataSource) {}

  async listTenantVehicles(tenantId: string) {
    return this.dataSource.query(
      `SELECT tv.id, tv.active, tv.created_at,
              pv.id as platform_vehicle_id,
              pv.make, pv.model, pv.year, pv.plate, pv.color,
              pv.passenger_capacity, pv.luggage_capacity, pv.vehicle_type_name
         FROM public.tenant_vehicles tv
         JOIN public.platform_vehicles pv ON pv.id = tv.platform_vehicle_id
        WHERE tv.tenant_id = $1
        ORDER BY tv.created_at DESC`,
      [tenantId],
    );
  }

  async listPlatformVehicles() {
    return this.dataSource.query(
      `SELECT * FROM public.platform_vehicles ORDER BY created_at DESC`,
    );
  }

  async claimVehicle(tenantId: string, platformVehicleId: string) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_vehicles (tenant_id, platform_vehicle_id, active)
       VALUES ($1,$2,true)
       ON CONFLICT (tenant_id, platform_vehicle_id)
       DO UPDATE SET active = true
       RETURNING *`,
      [tenantId, platformVehicleId],
    );
    return rows[0];
  }

  async updateTenantVehicle(tenantId: string, id: string, body: any) {
    const rows = await this.dataSource.query(
      `UPDATE public.tenant_vehicles
       SET active = COALESCE($1, active)
       WHERE tenant_id = $2 AND id = $3
       RETURNING *`,
      [body.active ?? null, tenantId, id],
    );
    if (!rows.length) throw new NotFoundException('Vehicle not found');
    return rows[0];
  }
}
