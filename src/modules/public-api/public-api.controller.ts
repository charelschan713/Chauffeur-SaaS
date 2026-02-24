import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { PublicApiService } from './public-api.service';
import { QuoteCalculatorService } from './quote-calculator.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { supabaseAdmin } from '../../config/supabase.config';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsUUID,
  IsEmail,
  IsInt,
} from 'class-validator';

class QuoteQueryDto {
  @ApiProperty({ example: 'aschauffeured' })
  tenant_slug!: string;

  @ApiProperty({ example: 'POINT_TO_POINT' })
  service_type!: string;

  @ApiProperty({ required: false })
  service_city_id?: string;

  @ApiProperty({ required: false })
  pickup_datetime?: string;

  @ApiProperty({ required: false, example: '25.5' })
  distance_km?: string;

  @ApiProperty({ required: false, example: '2' })
  duration_hours?: string;

  @ApiProperty({ required: false, example: '90' })
  duration_minutes?: string;

  @ApiProperty({ required: false, example: '2' })
  waypoint_count?: string;

  @ApiProperty({ required: false, example: '1' })
  baby_seat_infant?: string;

  @ApiProperty({ required: false, example: '0' })
  baby_seat_convertible?: string;

  @ApiProperty({ required: false, example: '1' })
  baby_seat_booster?: string;

  @ApiProperty({ required: false })
  promo_code?: string;

  @ApiProperty({ required: false })
  contact_id?: string;
}

class CreateBookingApiDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  passenger_email!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  passenger_first_name!: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  passenger_last_name!: string;

  @ApiProperty({ example: '+61400000000', required: false })
  @IsOptional()
  @IsString()
  passenger_phone?: string;

  @ApiProperty({ example: 'SYD Terminal 3, Sydney' })
  @IsString()
  pickup_address!: string;

  @ApiProperty({ example: -33.9399 })
  @IsNumber()
  pickup_lat!: number;

  @ApiProperty({ example: 151.1753 })
  @IsNumber()
  pickup_lng!: number;

  @ApiProperty({ example: 'Craig Ave, Vaucluse NSW' })
  @IsString()
  dropoff_address!: string;

  @ApiProperty({ example: -33.8577 })
  @IsNumber()
  dropoff_lat!: number;

  @ApiProperty({ example: 151.2751 })
  @IsNumber()
  dropoff_lng!: number;

  @ApiProperty({ example: '2026-03-01T18:15:00Z' })
  @IsDateString()
  pickup_datetime!: string;

  @ApiProperty({ example: 'uuid-of-vehicle-type' })
  @IsUUID()
  vehicle_type_id!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  passenger_count!: number;

  @ApiProperty({ example: 'QF1', required: false })
  @IsOptional()
  @IsString()
  flight_number?: string;

  @ApiProperty({ example: 'Child seat required', required: false })
  @IsOptional()
  @IsString()
  special_requests?: string;
}

// ─── Public endpoints (no auth required) ───
@ApiTags('Public API')
@Controller('public')
export class PublicOpenController {
  constructor(
    private readonly publicApiService: PublicApiService,
    private readonly quoteCalculator: QuoteCalculatorService,
  ) {}

  @Get('quote')
  @ApiOperation({ summary: 'Get instant price quote (no auth)' })
  @ApiResponse({ status: 200, description: 'Price estimate for the trip' })
  getQuote(
    @Query('tenant_slug') tenant_slug: string,
    @Query('service_type') service_type: string,
    @Query('service_city_id') service_city_id?: string,
    @Query('pickup_datetime') pickup_datetime?: string,
    @Query('distance_km') distance_km?: string,
    @Query('duration_hours') duration_hours?: string,
    @Query('duration_minutes') duration_minutes?: string,
    @Query('waypoint_count') waypoint_count?: string,
    @Query('baby_seat_infant') baby_seat_infant?: string,
    @Query('baby_seat_convertible') baby_seat_convertible?: string,
    @Query('baby_seat_booster') baby_seat_booster?: string,
    @Query('promo_code') promo_code?: string,
    @Query('contact_id') contact_id?: string,
  ) {
    return this.publicApiService.getQuote({
      tenant_slug,
      service_type,
      service_city_id,
      pickup_datetime,
      distance_km,
      duration_hours,
      duration_minutes,
      waypoint_count,
      baby_seat_infant,
      baby_seat_convertible,
      baby_seat_booster,
      promo_code,
      contact_id,
    });
  }

  @Get('promo-code/validate')
  @ApiOperation({ summary: 'Validate a promo code (no auth)' })
  async validatePromoCode(
    @Query('tenant_slug') tenant_slug: string,
    @Query('code') code: string,
  ) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', tenant_slug)
      .single();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const result = await this.quoteCalculator.validatePromoCode(tenant.id, code);

    if (!result) {
      return { valid: false, message: 'Invalid or expired promo code' };
    }

    return {
      valid: true,
      code: result.code,
      discount_type: result.type,
      discount_value: result.value,
    };
  }
}

// ─── API-Key protected endpoints ───
@ApiTags('Public API')
@ApiHeader({
  name: 'X-API-Key',
  description: 'Your tenant API key (tk_...)',
  required: true,
})
@Controller('v1')
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(
    private readonly publicApiService: PublicApiService,
    private readonly quoteCalculator: QuoteCalculatorService,
  ) {}

  @Get('vehicles')
  @ApiOperation({ summary: 'Get available vehicle types and pricing' })
  @ApiResponse({ status: 200, description: 'List of available vehicle types' })
  getVehicles(@Request() req: any) {
    return this.publicApiService.getAvailableVehicleTypes(req.tenant_id);
  }

  @Get('quote')
  @ApiOperation({ summary: 'Get instant price quote (requires API key)' })
  @ApiResponse({ status: 200, description: 'Price estimate for the trip' })
  getQuote(
    @Query('tenant_slug') tenant_slug: string,
    @Query('service_type') service_type: string,
    @Query('service_city_id') service_city_id?: string,
    @Query('pickup_datetime') pickup_datetime?: string,
    @Query('distance_km') distance_km?: string,
    @Query('duration_hours') duration_hours?: string,
    @Query('duration_minutes') duration_minutes?: string,
    @Query('waypoint_count') waypoint_count?: string,
    @Query('baby_seat_infant') baby_seat_infant?: string,
    @Query('baby_seat_convertible') baby_seat_convertible?: string,
    @Query('baby_seat_booster') baby_seat_booster?: string,
    @Query('promo_code') promo_code?: string,
    @Query('contact_id') contact_id?: string,
  ) {
    return this.publicApiService.getQuote({
      tenant_slug,
      service_type,
      service_city_id,
      pickup_datetime,
      distance_km,
      duration_hours,
      duration_minutes,
      waypoint_count,
      baby_seat_infant,
      baby_seat_convertible,
      baby_seat_booster,
      promo_code,
      contact_id,
    });
  }

  @Get('promo-code/validate')
  async validatePromoCode(
    @Query('tenant_slug') tenant_slug: string,
    @Query('code') code: string,
  ) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', tenant_slug)
      .single();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const result = await this.quoteCalculator.validatePromoCode(tenant.id, code);

    if (!result) {
      return { valid: false, message: 'Invalid or expired promo code' };
    }

    return {
      valid: true,
      code: result.code,
      discount_type: result.type,
      discount_value: result.value,
    };
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  createBooking(@Request() req: any, @Body() dto: CreateBookingApiDto) {
    return this.publicApiService.createBooking(req.tenant_id, dto);
  }

  @Get('bookings/:booking_id')
  @ApiOperation({ summary: 'Get booking status and details' })
  @ApiResponse({ status: 200, description: 'Booking details' })
  getBooking(
    @Request() req: any,
    @Param('booking_id') booking_id: string,
  ) {
    return this.publicApiService.getBooking(req.tenant_id, booking_id);
  }

  @Delete('bookings/:booking_id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  cancelBooking(
    @Request() req: any,
    @Param('booking_id') booking_id: string,
    @Body('reason') reason?: string,
  ) {
    return this.publicApiService.cancelBooking(
      req.tenant_id,
      booking_id,
      reason,
    );
  }
}
