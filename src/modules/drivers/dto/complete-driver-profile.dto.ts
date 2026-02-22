import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CompleteDriverProfileDto {
  @IsString()
  license_number!: string;

  @IsDateString()
  license_expiry!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
