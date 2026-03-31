import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type TenantPermissionKey =
  | 'can_push_jobs'
  | 'can_partner_assign'
  | 'can_driver_app_access'
  | 'can_api_access';

@Injectable()
export class TenantPermissionsService {
  constructor(private readonly dataSource: DataSource) {}

  async getPermissions(tenantId: string) {
    const rows = await this.dataSource.query(
      `select * from public.tenant_permissions where tenant_id = $1 limit 1`,
      [tenantId],
    );
    return rows?.[0] ?? null;
  }

  async assertPermission(tenantId: string, key: TenantPermissionKey) {
    const perms = await this.getPermissions(tenantId);
    const allowed = perms?.[key] === true;
    if (!allowed) {
      throw new ForbiddenException('Tenant not allowed');
    }
  }
}
