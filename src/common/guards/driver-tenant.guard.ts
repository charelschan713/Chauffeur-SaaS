import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TenantPermissionsService } from '../tenant-permissions.service';

@Injectable()
export class DriverTenantPermissionGuard implements CanActivate {
  constructor(private readonly perms: TenantPermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req?.user?.tenant_id;
    if (!tenantId) return true;
    await this.perms.assertPermission(tenantId, 'can_driver_app_access');
    return true;
  }
}
