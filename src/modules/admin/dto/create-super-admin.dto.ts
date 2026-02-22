import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateSuperAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @IsString()
  super_admin_secret!: string;
}
