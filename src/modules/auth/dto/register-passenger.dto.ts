import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterPassengerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
