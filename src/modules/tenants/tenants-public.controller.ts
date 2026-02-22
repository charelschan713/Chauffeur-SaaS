import { Controller, Get, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsPublicController {
  constructor(private readonly tenantsService: TenantsService) {}

  // 公开接口：根据域名查租户（前端middleware用）
  @Get('by-domain/:domain')
  findByDomain(@Param('domain') domain: string) {
    return this.tenantsService.findByDomain(domain);
  }

  // 公开接口：根据slug查租户（乘客预约页用）
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }
}
