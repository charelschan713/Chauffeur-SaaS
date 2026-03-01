import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

interface DriverQueryParams {
  search?: string;
  availabilityStatus?: string;
}

@Injectable()
export class DriverService {
  constructor(private readonly dataSource: DataSource) {}

  async listDrivers(tenantId: string, params: DriverQueryParams) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('u.id', 'driver_id')
      .addSelect('u.full_name', 'full_name')
      .addSelect('u.email', 'email')
      .addSelect('coalesce(ds.status, \'OFFLINE\')', 'availability_status')
      .addSelect('ds.updated_at', 'last_seen_at')
      .from('memberships', 'm')
      .innerJoin('users', 'u', 'u.id = m.user_id')
      .leftJoin(
        'dispatch_driver_status',
        'ds',
        'ds.driver_id = u.id AND ds.tenant_id = m.tenant_id',
      )
      .where('m.tenant_id = :tenantId', { tenantId })
      .andWhere('m.role = :role', { role: 'DRIVER' });

    if (params.search) {
      qb.andWhere('(u.full_name ILIKE :search OR u.email ILIKE :search)', {
        search: `%${params.search}%`,
      });
    }

    if (params.availabilityStatus) {
      qb.andWhere('coalesce(ds.status, \'OFFLINE\') = :status', {
        status: params.availabilityStatus,
      });
    }

    const rows = await qb.orderBy('u.full_name', 'ASC').getRawMany();

    return { data: rows };
  }

  async updateStatus(tenantId: string, driverId: string, status: string) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.query(
        `select id from public.dispatch_driver_status
         where tenant_id = $1 and driver_id = $2`,
        [tenantId, driverId],
      );

      if (existing.length) {
        await manager.query(
          `update public.dispatch_driver_status
           set status = $1, updated_at = now()
           where tenant_id = $2 and driver_id = $3`,
          [status, tenantId, driverId],
        );
      } else {
        await manager.query(
          `insert into public.dispatch_driver_status
           (id, tenant_id, driver_id, status, updated_at)
           values ($1,$2,$3,$4,now())`,
          [randomUUID(), tenantId, driverId, status],
        );
      }

      return { success: true };
    });
  }
}
