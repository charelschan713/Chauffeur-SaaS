import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface EligibleDriver {
  driverId: string;
  fullName: string;
  tenantVehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  availabilityStatus: string;
  lastSeenAt: Date | null;
}

@Injectable()
export class EligibilityResolver {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(tenantId: string, bookingId: string): Promise<EligibleDriver[]> {
    const bookings = await this.dataSource.query(
      `SELECT service_class_id FROM public.bookings
       WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!bookings.length || !bookings[0].service_class_id) return [];
    const serviceClassId = bookings[0].service_class_id;

    const drivers = await this.dataSource.query(
      `SELECT
         m.user_id as driver_id,
         u.full_name,
         tv.id as tenant_vehicle_id,
         pv.make as vehicle_make,
         pv.model as vehicle_model,
         COALESCE(dds.status, 'OFFLINE') as availability_status,
         dds.updated_at as last_seen_at
       FROM public.tenant_service_class_vehicles tscv
       JOIN public.tenant_vehicles tv ON tv.id = tscv.tenant_vehicle_id
       JOIN public.platform_vehicles pv ON pv.id = tv.platform_vehicle_id
       JOIN public.memberships m
         ON m.tenant_id = tv.tenant_id
        AND m.role = 'driver'
        AND m.status = 'active'
       JOIN public.users u ON u.id = m.user_id
       LEFT JOIN public.dispatch_driver_status dds
         ON dds.driver_id = m.user_id
        AND dds.tenant_id = tv.tenant_id
       WHERE tscv.service_class_id = $1
         AND tv.tenant_id = $2
         AND tv.active = true
         AND dds.status = 'AVAILABLE'
       ORDER BY dds.updated_at DESC NULLS LAST`,
      [serviceClassId, tenantId],
    );

    return drivers.map((d: any) => ({
      driverId: d.driver_id,
      fullName: d.full_name,
      tenantVehicleId: d.tenant_vehicle_id,
      vehicleMake: d.vehicle_make,
      vehicleModel: d.vehicle_model,
      availabilityStatus: d.availability_status,
      lastSeenAt: d.last_seen_at,
    }));
  }
}
