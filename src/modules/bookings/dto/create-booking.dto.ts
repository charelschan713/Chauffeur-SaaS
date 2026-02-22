import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  tenant_id!: string;

  @IsString()
  pickup_address!: string;

  @IsNumber()
  pickup_lat!: number;

  @IsNumber()
  pickup_lng!: number;

  @IsString()
  dropoff_address!: string;

  @IsNumber()
  dropoff_lat!: number;

  @IsNumber()
  dropoff_lng!: number;

  @IsDateString()
  pickup_datetime!: string;

  @IsIn(['BUSINESS', 'FIRST', 'VAN', 'ELECTRIC'])
  vehicle_class!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  passenger_count!: number;

  @IsOptional()
  @IsString()
  special_requests?: string;

  @IsOptional()
  @IsString()
  flight_number?: string;

  @IsOptional()
  @IsString()
  corporate_account_id?: string;
}
