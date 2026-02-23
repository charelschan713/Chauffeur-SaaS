import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('API Keys')
@ApiBearerAuth('JWT-auth')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiOperation({ summary: 'Create a new API key' })
  create(
    @Body() dto: { key_name: string; expires_at?: string },
    @Request() req: any,
  ) {
    return this.apiKeysService.createApiKey(
      req.user.profile.tenant_id,
      req.user.id,
      dto.key_name,
      dto.expires_at,
    );
  }

  @Get()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  @ApiOperation({ summary: 'List all API keys' })
  list(@Request() req: any) {
    return this.apiKeysService.listApiKeys(req.user.profile.tenant_id);
  }

  @Patch(':id/revoke')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(@Param('id') id: string, @Request() req: any) {
    return this.apiKeysService.revokeApiKey(id, req.user.profile.tenant_id);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiOperation({ summary: 'Delete an API key' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.apiKeysService.deleteApiKey(id, req.user.profile.tenant_id);
  }
}
