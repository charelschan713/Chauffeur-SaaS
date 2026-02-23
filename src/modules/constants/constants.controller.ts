import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ConstantsService } from './constants.service';

@Controller('constants')
export class ConstantsController {
  constructor(private readonly constantsService: ConstantsService) {}

  // 公开：获取所有系统常量
  @Get()
  getAllConstants() {
    return this.constantsService.getAllConstants();
  }

  // 租户：获取自定义名称
  @Get('me/labels')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getTenantLabels(@Request() req: any) {
    return this.constantsService.getTenantLabels(req.user.profile.tenant_id);
  }

  // 租户：批量更新自定义名称
  @Post('me/labels')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  batchUpsertLabels(
    @Request() req: any,
    @Body()
    body: {
      labels: Array<{
        constant_id: string;
        custom_name: string;
        custom_description?: string;
      }>;
      language?: string;
    },
  ) {
    return this.constantsService.batchUpsertLabels(
      req.user.profile.tenant_id,
      body.labels,
      body.language ?? 'en',
    );
  }
}
