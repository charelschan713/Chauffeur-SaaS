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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  IsEmail,
  IsInt,
} from 'class-validator';

class QuoteQueryDto {
  @ApiProperty({ example: 'BUSINESS' })
  vehicle_class!: string;

  @ApiProperty({ example: 'SYD Terminal 3, Sydney' })
  pickup_address!: string;

  @ApiProperty({ example: 'Craig Ave, Vaucluse NSW' })
  dropoff_address!: string;

  @ApiProperty({ example: -33.9399 })
  pickup_lat!: number;

  @ApiProperty({ example: 151.1753 })
  pickup_lng!: number;

  @ApiProperty({ example: -33.8577 })
  dropoff_lat!: number;

  @ApiProperty({ example: 151.2751 })
  dropoff_lng!: number;
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

  @ApiProperty({
    example: 'BUSINESS',
    enum: ['BUSINESS', 'FIRST', 'VAN', 'ELECTRIC'],
  })
  @IsIn(['BUSINESS', 'FIRST', 'VAN', 'ELECTRIC'])
  vehicle_class!: string;

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

@ApiTags('Public API')
@ApiHeader({
  name: 'X-API-Key',
  description: 'Your tenant API key (tk_...)',
  required: true,
})
@Controller('v1')
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Get('vehicles')
  @ApiOperation({ summary: 'Get available vehicle classes and pricing' })
  @ApiResponse({ status: 200, description: 'List of available vehicle classes' })
  getVehicles(@Request() req: any) {
    return this.publicApiService.getAvailableVehicleClasses(req.tenant_id);
  }

  @Get('quote')
  @ApiOperation({ summary: 'Get instant price quote' })
  @ApiResponse({ status: 200, description: 'Price estimate for the trip' })
  getQuote(@Request() req: any, @Query() query: QuoteQueryDto) {
    return this.publicApiService.getQuote(
      req.tenant_id,
      query.vehicle_class,
      query.pickup_address,
      query.dropoff_address,
      parseFloat(query.pickup_lat as any),
      parseFloat(query.pickup_lng as any),
      parseFloat(query.dropoff_lat as any),
      parseFloat(query.dropoff_lng as any),
    );
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
