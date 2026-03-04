import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      .addSelect('u.phone_country_code', 'phone_country_code')
      .addSelect('u.phone_number', 'phone_number')
      .addSelect('m.status', 'membership_status')
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
      .andWhere('m.role = :role', { role: 'driver' });

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

  async createDriver(tenantId: string, body: any) {
    const email = body.email?.trim();
    const firstName = body.first_name?.trim() ?? '';
    const lastName = body.last_name?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    const phoneCountryCode = body.phone_country_code?.trim() ?? null;
    const phoneNumber = body.phone_number?.trim() ?? null;

    if (!email) {
      throw new BadRequestException('email is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const authRows = await manager.query(
        `select id from auth.users where email = $1`,
        [email],
      );
      if (!authRows.length) {
        throw new BadRequestException('Auth user not found for email');
      }
      const userId = authRows[0].id;

      await manager.query(
        `insert into public.users (id, email, full_name, phone_country_code, phone_number, is_platform_admin)
         values ($1,$2,$3,$4,$5,false)
         on conflict (id) do update set
           email = excluded.email,
           full_name = excluded.full_name,
           phone_country_code = excluded.phone_country_code,
           phone_number = excluded.phone_number
        `,
        [userId, email, fullName || null, phoneCountryCode, phoneNumber],
      );

      await manager.query(
        `insert into public.memberships (tenant_id, user_id, role, status)
         values ($1,$2,'driver','active')
         on conflict (tenant_id, user_id)
         do update set role = 'driver', status = 'active'`,
        [tenantId, userId],
      );

      return { id: userId, email, full_name: fullName, phone_country_code: phoneCountryCode, phone_number: phoneNumber };
    });
  }

  async updateDriver(tenantId: string, driverId: string, body: any) {
    const firstName = body.first_name?.trim() ?? '';
    const lastName = body.last_name?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    const phoneCountryCode = body.phone_country_code?.trim() ?? null;
    const phoneNumber = body.phone_number?.trim() ?? null;
    const email = body.email?.trim();

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.query(
        `select u.id from public.users u
          join public.memberships m on m.user_id = u.id
         where u.id = $1 and m.tenant_id = $2 and m.role = 'driver'`,
        [driverId, tenantId],
      );
      if (!existing.length) throw new NotFoundException('Driver not found');

      if (email) {
        await manager.query(
          `update auth.users set email = $1 where id = $2`,
          [email, driverId],
        );
      }

      await manager.query(
        `update public.users
           set full_name = coalesce($1, full_name),
               phone_country_code = coalesce($2, phone_country_code),
               phone_number = coalesce($3, phone_number),
               email = coalesce($4, email)
         where id = $5`,
        [fullName || null, phoneCountryCode, phoneNumber, email, driverId],
      );

      return { success: true };
    });
  }

  async setMembershipStatus(tenantId: string, driverId: string, status: 'inactive' | 'suspended') {
    const existing = await this.dataSource.query(
      `SELECT id FROM public.memberships WHERE tenant_id = $1 AND user_id = $2 AND role = 'driver'`,
      [tenantId, driverId],
    );
    if (!existing.length) throw new NotFoundException('Driver not found');
    await this.dataSource.query(
      `UPDATE public.memberships SET status = $1 WHERE tenant_id = $2 AND user_id = $3`,
      [status, tenantId, driverId],
    );
    return { success: true };
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
