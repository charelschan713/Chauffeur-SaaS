import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PricingService {
  constructor(private readonly dataSource: DataSource) {}

  async listServiceClasses(tenantId: string) {
    return this.dataSource.query(
      `SELECT sc.id, sc.name, sc.description, sc.display_order, sc.surge_multiplier, sc.currency, sc.active, sc.created_at,
              sc.base_fare_minor, sc.per_km_minor, sc.per_min_driving_minor, sc.per_min_waiting_minor,
              sc.minimum_fare_minor, sc.waypoint_minor, sc.infant_seat_minor, sc.toddler_seat_minor,
              sc.booster_seat_minor, sc.hourly_rate_minor,
              COALESCE(sc.passenger_capacity, 0) AS passenger_capacity,
              COALESCE(sc.luggage_capacity, 0)   AS luggage_capacity,
              (SELECT COUNT(*) FROM public.tenant_service_class_platform_vehicles v
               WHERE v.service_class_id = sc.id AND v.tenant_id = $1) AS vehicle_count
       FROM public.tenant_service_classes sc
       WHERE sc.tenant_id = $1 AND sc.active = true
       ORDER BY sc.display_order ASC, sc.created_at ASC`,
      [tenantId],
    );
  }

  async createServiceClass(tenantId: string, body: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_service_classes
        (tenant_id, name, description, display_order, surge_multiplier, currency, active,
         base_fare_minor, per_km_minor, per_min_driving_minor, per_min_waiting_minor,
         minimum_fare_minor, waypoint_minor, infant_seat_minor, toddler_seat_minor,
         booster_seat_minor, hourly_rate_minor, passenger_capacity, luggage_capacity)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        tenantId,
        body.name,
        body.description ?? null,
        body.displayOrder ?? 0,
        body.surgeMultiplier ?? 1.0,
        body.currency ?? 'AUD',
        body.base_fare_minor ?? 0,
        body.per_km_minor ?? 0,
        body.per_min_driving_minor ?? 0,
        body.per_min_waiting_minor ?? 0,
        body.minimum_fare_minor ?? 0,
        body.waypoint_minor ?? 0,
        body.infant_seat_minor ?? 0,
        body.toddler_seat_minor ?? 0,
        body.booster_seat_minor ?? 0,
        body.hourly_rate_minor ?? 0,
        body.passenger_capacity ?? 4,
        body.luggage_capacity ?? 2,
      ],
    );
    return rows[0];
  }

  async getServiceClass(tenantId: string, id: string) {
    const [serviceClass, platformVehicles] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM public.tenant_service_classes
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      ),
      this.dataSource.query(
        `SELECT pv.id, pv.make, pv.model
           FROM public.tenant_service_class_platform_vehicles scpv
           JOIN public.platform_vehicles pv ON pv.id = scpv.platform_vehicle_id
          WHERE scpv.service_class_id = $1 AND pv.active = true`,
        [id],
      ),
    ]);
    if (!serviceClass.length) throw new NotFoundException('Service class not found');
    return { ...serviceClass[0], platform_vehicles: platformVehicles };
  }

  async updateServiceClass(tenantId: string, id: string, body: any) {
    const rows = await this.dataSource.query(
      `UPDATE public.tenant_service_classes
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           display_order = COALESCE($3, display_order),
           surge_multiplier = COALESCE($4, surge_multiplier),
           currency = COALESCE($5, currency),
           active = COALESCE($6, active),
           base_fare_minor = COALESCE($7, base_fare_minor),
           per_km_minor = COALESCE($8, per_km_minor),
           per_min_driving_minor = COALESCE($9, per_min_driving_minor),
           per_min_waiting_minor = COALESCE($10, per_min_waiting_minor),
           minimum_fare_minor = COALESCE($11, minimum_fare_minor),
           waypoint_minor = COALESCE($12, waypoint_minor),
           infant_seat_minor = COALESCE($13, infant_seat_minor),
           toddler_seat_minor = COALESCE($14, toddler_seat_minor),
           booster_seat_minor = COALESCE($15, booster_seat_minor),
           hourly_rate_minor = COALESCE($16, hourly_rate_minor),
           passenger_capacity = COALESCE($17, passenger_capacity),
           luggage_capacity = COALESCE($18, luggage_capacity),
           vehicle_class = COALESCE($19, vehicle_class),
           updated_at = now()
       WHERE tenant_id = $20 AND id = $21
       RETURNING *`,
      [
        body.name ?? null,
        body.description ?? null,
        body.displayOrder ?? null,
        body.surgeMultiplier ?? null,
        body.currency ?? null,
        body.active ?? null,
        body.base_fare_minor ?? null,
        body.per_km_minor ?? null,
        body.per_min_driving_minor ?? null,
        body.per_min_waiting_minor ?? null,
        body.minimum_fare_minor ?? null,
        body.waypoint_minor ?? null,
        body.infant_seat_minor ?? null,
        body.toddler_seat_minor ?? null,
        body.booster_seat_minor ?? null,
        body.hourly_rate_minor ?? null,
        body.passenger_capacity ?? null,
        body.luggage_capacity ?? null,
        body.vehicle_class ?? null,
        tenantId,
        id,
      ],
    );
    if (!rows.length) throw new NotFoundException('Service class not found');
    return rows[0];
  }

  
  async listServiceClassPlatformVehicles(tenantId: string, serviceClassId: string) {
    return this.dataSource.query(
      `SELECT pv.id, pv.make, pv.model, pv.active
         FROM public.tenant_service_class_platform_vehicles scpv
         JOIN public.platform_vehicles pv ON pv.id = scpv.platform_vehicle_id
        WHERE scpv.tenant_id = $1 AND scpv.service_class_id = $2`,
      [tenantId, serviceClassId],
    );
  }

  async linkServiceClassPlatformVehicles(tenantId: string, serviceClassId: string, platformVehicleIds: string[]) {
    // Replace all: delete existing selections, then insert the new set
    await this.dataSource.query(
      `DELETE FROM public.tenant_service_class_platform_vehicles
       WHERE tenant_id = $1 AND service_class_id = $2`,
      [tenantId, serviceClassId],
    );
    for (const pvId of platformVehicleIds) {
      await this.dataSource.query(
        `INSERT INTO public.tenant_service_class_platform_vehicles (tenant_id, service_class_id, platform_vehicle_id)
         VALUES ($1,$2,$3)
         ON CONFLICT (service_class_id, platform_vehicle_id) DO NOTHING`,
        [tenantId, serviceClassId, pvId],
      );
    }
    return { success: true };
  }

  async unlinkServiceClassPlatformVehicle(tenantId: string, serviceClassId: string, platformVehicleId: string) {
    await this.dataSource.query(
      `DELETE FROM public.tenant_service_class_platform_vehicles
       WHERE tenant_id = $1 AND service_class_id = $2 AND platform_vehicle_id = $3`,
      [tenantId, serviceClassId, platformVehicleId],
    );
    return { success: true };
  }
  async deactivateServiceClass(tenantId: string, id: string) {
    const rows = await this.dataSource.query(
      `UPDATE public.tenant_service_classes
       SET active = false, updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING id`,
      [tenantId, id],
    );
    if (!rows.length) throw new NotFoundException('Service class not found');
    return { success: true };
  }

  async hardDeleteServiceClass(tenantId: string, id: string) {
    // Check for active/upcoming bookings referencing this car type
    const conflicts = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.bookings
       WHERE tenant_id = $1 AND service_class_id = $2
         AND operational_status::text NOT IN ('COMPLETED','CANCELLED')`,
      [tenantId, id],
    );
    if (Number(conflicts[0]?.count) > 0) {
      throw new Error('Cannot delete: car type has active bookings. Deactivate instead.');
    }
    await this.dataSource.query(
      `DELETE FROM public.tenant_service_class_platform_vehicles
       WHERE tenant_id = $1 AND service_class_id = $2`,
      [tenantId, id],
    );
    await this.dataSource.query(
      `DELETE FROM public.service_class_pricing_items
       WHERE tenant_id = $1 AND service_class_id = $2`,
      [tenantId, id],
    );
    const rows = await this.dataSource.query(
      `DELETE FROM public.tenant_service_classes
       WHERE tenant_id = $1 AND id = $2 RETURNING id`,
      [tenantId, id],
    );
    if (!rows.length) throw new NotFoundException('Service class not found');
    return { success: true };
  }

  async listItems(tenantId: string, serviceClassId: string) {
    return this.dataSource.query(
      `SELECT id, service_class_id, item_type, amount_minor, unit, active, created_at
       FROM public.service_class_pricing_items
       WHERE tenant_id = $1 AND service_class_id = $2
       ORDER BY created_at ASC`,
      [tenantId, serviceClassId],
    );
  }

  async createItem(tenantId: string, body: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.service_class_pricing_items
        (tenant_id, service_class_id, item_type, amount_minor, unit, active)
       VALUES ($1,$2,$3,$4,$5,true)
       RETURNING *`,
      [
        tenantId,
        body.serviceClassId,
        body.itemType,
        body.amountMinor,
        body.unit,
      ],
    );
    return rows[0];
  }

  async updateItem(tenantId: string, id: string, body: any) {
    const rows = await this.dataSource.query(
      `UPDATE public.service_class_pricing_items
       SET item_type = COALESCE($1, item_type),
           amount_minor = COALESCE($2, amount_minor),
           unit = COALESCE($3, unit),
           active = COALESCE($4, active)
       WHERE tenant_id = $5 AND id = $6
       RETURNING *`,
      [
        body.itemType ?? null,
        body.amountMinor ?? null,
        body.unit ?? null,
        body.active ?? null,
        tenantId,
        id,
      ],
    );
    if (!rows.length) throw new NotFoundException('Pricing item not found');
    return rows[0];
  }

  async deactivateItem(tenantId: string, id: string) {
    const rows = await this.dataSource.query(
      `UPDATE public.service_class_pricing_items
       SET active = false
       WHERE tenant_id = $1 AND id = $2
       RETURNING id`,
      [tenantId, id],
    );
    if (!rows.length) throw new NotFoundException('Pricing item not found');
    return { success: true };
  }

  async listZones(tenantId: string) {
    return this.dataSource.query(
      `SELECT id, service_class_id, name, pickup_zone_name, dropoff_zone_name, flat_price_minor, active, valid_from, valid_to, created_at
       FROM public.pricing_zones
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
  }

  async createZone(tenantId: string, body: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.pricing_zones
        (tenant_id, service_class_id, name, pickup_zone_name, dropoff_zone_name, flat_price_minor, valid_from, valid_to, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
       RETURNING *`,
      [
        tenantId,
        body.serviceClassId,
        body.name,
        body.pickupZoneName,
        body.dropoffZoneName,
        body.flatPriceMinor,
        body.validFrom ?? null,
        body.validTo ?? null,
      ],
    );
    return rows[0];
  }

  async updateZone(tenantId: string, id: string, body: any) {
    const rows = await this.dataSource.query(
      `UPDATE public.pricing_zones
       SET name = COALESCE($1, name),
           pickup_zone_name = COALESCE($2, pickup_zone_name),
           dropoff_zone_name = COALESCE($3, dropoff_zone_name),
           flat_price_minor = COALESCE($4, flat_price_minor),
           valid_from = COALESCE($5, valid_from),
           valid_to = COALESCE($6, valid_to),
           active = COALESCE($7, active)
       WHERE tenant_id = $8 AND id = $9
       RETURNING *`,
      [
        body.name ?? null,
        body.pickupZoneName ?? null,
        body.dropoffZoneName ?? null,
        body.flatPriceMinor ?? null,
        body.validFrom ?? null,
        body.validTo ?? null,
        body.active ?? null,
        tenantId,
        id,
      ],
    );
    if (!rows.length) throw new NotFoundException('Pricing zone not found');
    return rows[0];
  }

  async deactivateZone(tenantId: string, id: string) {
    const rows = await this.dataSource.query(
      `UPDATE public.pricing_zones
       SET active = false
       WHERE tenant_id = $1 AND id = $2
       RETURNING id`,
      [tenantId, id],
    );
    if (!rows.length) throw new NotFoundException('Pricing zone not found');
    return { success: true };
  }
}
