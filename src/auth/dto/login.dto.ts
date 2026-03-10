import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  /** Optional tenant slug — when provided, login is scoped to that company.
   *  If the driver has no active membership in that tenant, login is rejected.
   *  If omitted, the first active membership is used (backward-compatible). */
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
