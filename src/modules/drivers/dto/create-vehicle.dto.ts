import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  make!: string;

  @IsString()
  model!: string;

  @IsInt()
  @Min(2000)
  @Max(2030)
  year!: number;

  @IsString()
  color!: string;

  @IsString()
  plate_number!: string;

  @IsIn(['BUSINESS', 'FIRST', 'VAN', 'ELECTRIC'])
  vehicle_class!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  capacity!: number;
}
