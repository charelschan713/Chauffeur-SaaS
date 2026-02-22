import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  // 乘客创建预约
  async create(passenger_id: string, dto: CreateBookingDto) {
    // 1. 获取定价规则计算价格
    const { data: rule } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', dto.tenant_id)
      .eq('vehicle_class', dto.vehicle_class)
      .eq('is_active', true)
      .single();

    if (!rule) {
      throw new BadRequestException('No pricing available for this vehicle class');
    }

    // 2. 用直线距离估算（实际可接Google Maps API）
    const distance_km = this.calcDistance(
      dto.pickup_lat,
      dto.pickup_lng,
      dto.dropoff_lat,
      dto.dropoff_lng,
    );

    const duration_minutes = Math.round(distance_km * 1.5);
    const calculated =
      rule.base_fare +
      rule.price_per_km * distance_km +
      rule.price_per_minute * duration_minutes;

    const total_price = parseFloat(
      Math.max(calculated, rule.minimum_fare).toFixed(2),
    );

    // 3. 创建预约
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        tenant_id: dto.tenant_id,
        passenger_id,
        pickup_address: dto.pickup_address,
        pickup_lat: dto.pickup_lat,
        pickup_lng: dto.pickup_lng,
        dropoff_address: dto.dropoff_address,
        dropoff_lat: dto.dropoff_lat,
        dropoff_lng: dto.dropoff_lng,
        pickup_datetime: dto.pickup_datetime,
        vehicle_class: dto.vehicle_class,
        passenger_count: dto.passenger_count,
        special_requests: dto.special_requests ?? null,
        flight_number: dto.flight_number ?? null,
        corporate_account_id: dto.corporate_account_id ?? null,
        base_price: rule.base_fare,
        total_price,
        currency: rule.currency,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 乘客查看自己的预约
  async findByPassenger(passenger_id: string, status?: string) {
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        drivers(
          id,
          profiles(first_name, last_name, phone, avatar_url),
          vehicles(make, model, color, plate_number)
        )
      `)
      .eq('passenger_id', passenger_id)
      .order('pickup_datetime', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 乘客查看单个预约详情
  async findOneForPassenger(booking_id: string, passenger_id: string) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        drivers(
          id,
          profiles(first_name, last_name, phone, avatar_url),
          vehicles(make, model, color, plate_number)
        ),
        payments(status, payment_method, paid_at)
      `)
      .eq('id', booking_id)
      .eq('passenger_id', passenger_id)
      .single();

    if (error || !data) throw new NotFoundException('Booking not found');
    return data;
  }

  // 乘客取消预约
  async cancelByPassenger(
    booking_id: string,
    passenger_id: string,
    _dto: CancelBookingDto,
  ) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('status, pickup_datetime')
      .eq('id', booking_id)
      .eq('passenger_id', passenger_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    // 只有 PENDING / CONFIRMED 可以取消
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException(
        'Cannot cancel a booking that is already in progress or completed',
      );
    }

    // 出发前2小时内不可取消
    const pickup = new Date(booking.pickup_datetime);
    const now = new Date();
    const diffHours = (pickup.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 2) {
      throw new BadRequestException('Cannot cancel within 2 hours of pickup time');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // TENANT_ADMIN：查看本租户所有预约
  async findAllByTenant(tenant_id: string, status?: string, date?: string) {
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        drivers(profiles(first_name, last_name)),
        profiles!passenger_id(first_name, last_name, phone)
      `)
      .eq('tenant_id', tenant_id)
      .order('pickup_datetime', { ascending: true });

    if (status) query = query.eq('status', status);

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      query = query
        .gte('pickup_datetime', start.toISOString())
        .lte('pickup_datetime', end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // TENANT_ADMIN：手动派单给司机
  async assignDriver(booking_id: string, tenant_id: string, dto: AssignDriverDto) {
    // 确认预约属于该租户
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('status, vehicle_class')
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be assigned at this stage');
    }

    // 确认司机属于该租户且状态为ACTIVE且可接单
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, status, is_available')
      .eq('id', dto.driver_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found in your tenant');
    if (driver.status !== 'ACTIVE') {
      throw new BadRequestException('Driver is not active');
    }
    if (!driver.is_available) {
      throw new BadRequestException('Driver is not available');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ driver_id: dto.driver_id, status: 'DRIVER_ASSIGNED' })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 派单后司机设为不可接单
    await supabaseAdmin
      .from('drivers')
      .update({ is_available: false })
      .eq('id', dto.driver_id);

    return data;
  }

  // 司机查看派给自己的预约
  async findByDriver(user_id: string, status?: string) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver profile not found');

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        profiles!passenger_id(first_name, last_name, phone)
      `)
      .eq('driver_id', driver.id)
      .order('pickup_datetime', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 司机开始行程
  async startTrip(booking_id: string, user_id: string) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found');

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', booking_id)
      .eq('driver_id', driver.id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'DRIVER_ASSIGNED') {
      throw new BadRequestException('Booking is not in DRIVER_ASSIGNED status');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'IN_PROGRESS' })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 司机完成行程
  async completeTrip(booking_id: string, user_id: string) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, total_trips')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found');

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', booking_id)
      .eq('driver_id', driver.id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Trip is not in progress');
    }

    // 完成订单
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'COMPLETED' })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 司机trip数+1，恢复可接单
    await supabaseAdmin
      .from('drivers')
      .update({
        total_trips: driver.total_trips + 1,
        is_available: true,
      })
      .eq('id', driver.id);

    return data;
  }

  // 工具：Haversine公式计算两点直线距离(km)
  private calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
