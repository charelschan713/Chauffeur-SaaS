import { Body, Controller, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ComplianceService } from './compliance.service';

@Controller()
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('compliance/upload')
  @UseGuards(JwtGuard)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body('entity_type') entity_type: 'TENANT' | 'DRIVER' | 'VEHICLE',
    @Body('entity_id') entity_id: string,
    @Body('document_type') document_type: string,
    @Body('expires_at') expires_at?: string,
  ) {
    return this.complianceService.uploadDocument(req.user.profile.tenant_id, entity_type, entity_id, document_type, file, expires_at);
  }

  @Get('compliance/:entity_type/:entity_id')
  @UseGuards(JwtGuard)
  getDocuments(@Request() req: any, @Param('entity_type') entity_type: string, @Param('entity_id') entity_id: string) {
    return this.complianceService.getDocuments(entity_type, entity_id, req.user.profile.tenant_id);
  }

  @Get('admin/compliance/pending')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getPending(@Query('status') status?: string, @Query('tenant_id') tenant_id?: string, @Query('document_type') document_type?: string) {
    return this.complianceService.getPendingReviews(status, tenant_id, document_type);
  }

  @Patch('admin/compliance/:id/approve')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  approve(@Request() req: any, @Param('id') id: string) {
    return this.complianceService.approveDocument(id, req.user.id);
  }

  @Patch('admin/compliance/:id/reject')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  reject(@Request() req: any, @Param('id') id: string, @Body('rejection_reason') reason: string) {
    return this.complianceService.rejectDocument(id, req.user.id, reason);
  }

  @Get('admin/compliance/stats')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  stats() {
    return this.complianceService.getStats();
  }
}
