import { IsNumber, IsString, Min } from 'class-validator';

export class CreatePricingRuleDto {
  @IsString()
  vehicle_class!: 'BUSINESS' | 'FIRST' | 'VAN' | 'ELECTRIC';

  @IsNumber()
  @Min(0)
  base_fare!: number;

  @IsNumber()
  @Min(0)
  price_per_km!: number;

  @IsNumber()
  @Min(0)
  price_per_minute!: number;

  @IsNumber()
  @Min(0)
  minimum_fare!: number;

  @IsString()
  currency!: string;
}
