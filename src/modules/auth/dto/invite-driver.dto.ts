import { IsEmail, IsString } from 'class-validator';

export class InviteDriverDto {
  @IsEmail()
  email!: string;

  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;
}
