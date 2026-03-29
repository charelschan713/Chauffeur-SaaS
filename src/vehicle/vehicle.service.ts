import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class VehicleService {
  constructor(private readonly dataSource: DataSource) {}

  async listTenantVehicles(tenantId: string) {
    return this.dataSource.query(
      `SELECT tv.id, tv.active, tv.created_at, tv.updated_at,
              tv.year, tv.colour, tv.plate,
              tv.passenger_capacity, tv.luggage_capacity, tv.notes,
              tv.rego_expiry, tv.insurance_expiry,
              tv.source_type, tv.approval_status, tv.platform_verified,
              tv.external_driver_id,
              pv.id as platform_vehicle_id,
              pv.make, pv.model, pv.active as platform_active
         FROM public.tenant_vehicles tv
         JOIN public.platform_vehicles pv ON pv.id = tv.platform_vehicle_id
        WHERE tv.tenant_id = $1 AND tv.deleted_at IS NULL
        ORDER BY tv.created_at DESC`,
      [tenantId],
    );
  }

  async listPlatformVehicles() {
    return this.dataSource.query(
      `SELECT id, make, model, active, created_at FROM public.platform_vehicles ORDER BY make, model ASC`,
    );
  }

  async claimVehicle(tenantId: string, platformVehicleId: string, body?: any) {
    const plate = String(body?.plate ?? '').trim().toUpperCase() || null;

    if (plate) {
      const dup = await this.dataSource.query(
        `SELECT id FROM public.tenant_vehicles
          WHERE tenant_id = $1
            AND deleted_at IS NULL
            AND lower(plate) = lower($2)
          LIMIT 1`,
        [tenantId, plate],
      );
      if (dup.length) {
        throw new BadRequestException('Rego already exists. Plate must be unique per tenant.');
      }
    }

    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_vehicles
        (tenant_id, platform_vehicle_id, active, year, colour, plate, passenger_capacity, luggage_capacity, notes, rego_expiry, insurance_expiry)
       VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        tenantId,
        platformVehicleId,
        body?.year ?? null,
        body?.colour ?? null,
        plate,
        body?.passenger_capacity ?? 4,
        body?.luggage_capacity ?? 2,
        body?.notes ?? null,
        body?.rego_expiry ?? null,
        body?.insurance_expiry ?? null,
      ],
    );
    return rows[0];
  }

  
  async listAssignable(tenantId: string, serviceClassId: string) {
    if (!serviceClassId) return [];
    return this.dataSource.query(
      `SELECT tv.id, tv.plate, tv.year,
              pv.make, pv.model
         FROM public.tenant_vehicles tv
         JOIN public.tenant_service_class_platform_vehicles scpv
           ON scpv.platform_vehicle_id = tv.platform_vehicle_id
          AND scpv.service_class_id = $1
          AND scpv.tenant_id = $2
         JOIN public.platform_vehicles pv ON pv.id = tv.platform_vehicle_id
        WHERE tv.tenant_id = $2 AND tv.active = true`,
      [serviceClassId, tenantId],
    );
  }
  async deactivateTenantVehicle(tenantId: string, id: string) {
    // Guard: no in-progress assignments
    const check = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.assignments a
         JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.vehicle_id = $1 AND b.tenant_id = $2
          AND a.status IN ('PENDING','ACCEPTED','JOB_STARTED')`,
      [id, tenantId],
    );
    if (Number(check[0]?.count ?? 0) > 0) {
      throw new BadRequestException('Vehicle has active assignments and cannot be deactivated');
    }
    const rows = await this.dataSource.query(
      `UPDATE public.tenant_vehicles SET active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Vehicle not found');
    return { success: true };
  }

  async updateTenantVehicle(tenantId: string, id: string, body: any) {
    const normalizedPlate = body.plate === undefined
      ? null
      : (String(body.plate ?? '').trim().toUpperCase() || null);

    if (normalizedPlate) {
      const dup = await this.dataSource.query(
        `SELECT id FROM public.tenant_vehicles
          WHERE tenant_id = $1
            AND deleted_at IS NULL
            AND id <> $2
            AND lower(plate) = lower($3)
          LIMIT 1`,
        [tenantId, id, normalizedPlate],
      );
      if (dup.length) {
        throw new BadRequestException('Rego already exists. Plate must be unique per tenant.');
      }
    }

    const rows = await this.dataSource.query(
      `UPDATE public.tenant_vehicles
       SET active = COALESCE($1, active),
           year = COALESCE($2, year),
           colour = COALESCE($3, colour),
           plate = COALESCE($4, plate),
           passenger_capacity = COALESCE($5, passenger_capacity),
           luggage_capacity = COALESCE($6, luggage_capacity),
           notes = COALESCE($7, notes),
           rego_expiry = COALESCE($8, rego_expiry),
           insurance_expiry = COALESCE($9, insurance_expiry),
           updated_at = now()
       WHERE tenant_id = $10 AND id = $11
       RETURNING *`,
      [
        body.active ?? null,
        body.year ?? null,
        body.colour ?? null,
        normalizedPlate,
        body.passenger_capacity ?? null,
        body.luggage_capacity ?? null,
        body.notes ?? null,
        body.rego_expiry ?? null,
        body.insurance_expiry ?? null,
        tenantId,
        id,
      ],
    );
    if (!rows.length) throw new NotFoundException('Vehicle not found');
    return rows[0];
  }

  async deleteTenantVehicle(tenantId: string, id: string) {
    // Guard: no in-progress assignments
    const check = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.assignments a
         JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.vehicle_id = $1 AND b.tenant_id = $2
          AND a.status IN ('PENDING','ACCEPTED','JOB_STARTED')`,
      [id, tenantId],
    );
    if (Number(check[0]?.count ?? 0) > 0) {
      throw new BadRequestException('Vehicle has active assignments and cannot be deleted');
    }
    const rows = await this.dataSource.query(
      `UPDATE public.tenant_vehicles SET deleted_at = now(), active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Vehicle not found');
    return { success: true };
  }
}
