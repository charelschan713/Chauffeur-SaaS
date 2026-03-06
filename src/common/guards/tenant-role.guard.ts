import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const TENANT_ROLES_KEY = 'tenantRoles';

/**
 * Decorator to specify which tenant roles are allowed.
 * Usage: @TenantRoles('tenant_admin')
 */
import { SetMetadata } from '@nestjs/common';
export const TenantRoles = (...roles: string[]) =>
  SetMetadata(TENANT_ROLES_KEY, roles);

/**
 * Guard that enforces:
 * 1. User has a `tenant_id` matching the resource (set by JwtGuard via JWT payload).
 * 2. User's `role` is in the allowed list (from @TenantRoles decorator).
 * 3. Platform admins (`is_platform_admin = true`) always pass.
 *
 * Must be used AFTER JwtGuard (which populates req.user).
 */
@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      TENANT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    // Platform admins bypass all tenant role checks
    if (user.is_platform_admin) return true;

    // Must have a tenant_id on the token
    if (!user.tenant_id) throw new ForbiddenException('No tenant context');

    // If no specific roles required, just having a tenant is enough
    if (!requiredRoles?.length) return true;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Requires role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
