import { IsString, IsUUID } from 'class-validator';

export class SwitchTenantDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  refreshToken: string;
}
