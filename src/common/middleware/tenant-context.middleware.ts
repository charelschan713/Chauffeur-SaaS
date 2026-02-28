import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly dataSource: DataSource) {}

  async use(req: any, _res: any, next: () => void) {
    const user = req.user;
    if (!user) return next();

    if (user.isPlatformAdmin) {
      return next();
    }

    const tenantId = user.tenant_id;
    if (!tenantId) throw new UnauthorizedException('No tenant context');

    const membership = await this.dataSource.query(
      `select status from public.memberships
       where tenant_id = $1 and user_id = $2`,
      [tenantId, user.sub],
    );

    if (!membership.length || membership[0].status !== 'active') {
      throw new ForbiddenException('Inactive tenant membership');
    }

    await this.dataSource.query(
      `select set_config('app.tenant_id', $1, true)`,
      [tenantId],
    );

    next();
  }
}
