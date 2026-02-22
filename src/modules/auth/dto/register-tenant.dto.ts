import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @IsString()
  company_name!: string;

  @IsString()
  slug!: string;
}
