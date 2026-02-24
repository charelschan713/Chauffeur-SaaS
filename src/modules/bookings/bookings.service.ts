import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ContactsService } from '../crm/contacts.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly webhooksService: WebhooksService,
    private readonly contactsService: ContactsService,
  ) {}
  // =====================
  // 创建订单
  // =====================
  async createBooking(
    passenger_id: string,
    tenant_id: string,
    dto: {
      service_city_id: string;
      service_type: 'POINT_TO_POINT' | 'HOURLY_CHARTER';
      trip_type: 'ONE_WAY' | 'RETURN';
      vehicle_type_id?: string;
      pickup_address: string;
      pickup_lat: number;
      pickup_lng: number;
      dropoff_address?: string;
      dropoff_lat?: number;
      dropoff_lng?: number;
      waypoints?: any[];
      pickup_datetime: string;
      pickup_timezone: string;
      return_datetime?: string;
      duration_hours?: number;
      passenger_count: number;
      flight_number?: string;
      special_requests?: string;
      passenger_name?: string;
      passenger_phone?: string;
      passenger_email?: string;
      contact_id?: string;
      crm_passenger_id?: string;
      promo_code?: string;
      billing_method?: 'KM' | 'DT';
      selected_extras?: any[];
      created_timezone?: string;
    },
  ) {
    // 获取服务城市
    const { data: serviceCity } = await supabaseAdmin
      .from('tenant_service_cities')
      .select('*')
      .eq('id', dto.service_city_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!serviceCity) {
      throw new NotFoundException('Service city not found');
    }

    const { data: vehicleType } = await supabaseAdmin
      .from('tenant_vehicle_types')
      .select('*')
      .eq('id', dto.vehicle_type_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!vehicleType) {
      throw new BadRequestException('Vehicle type not found');
    }

    // 验证婴儿座椅数量
    const babySeatExtras = dto.selected_extras?.filter(
      (e: any) => e.category === 'BABY_SEAT',
    );
    const totalBabySeats =
      babySeatExtras?.reduce((sum: number, e: any) => sum + (e.quantity ?? 0), 0) ?? 0;

    if (totalBabySeats >= (vehicleType.max_passengers ?? 4)) {
      throw new BadRequestException(
        `Baby seats cannot exceed ${(vehicleType.max_passengers ?? 4) - 1} (max_passengers - 1)`,
      );
    }

    // pricing_rules is optional (surge only)
    const { data: pricingRule } = await supabaseAdmin
      .from('pricing_rules')
      .select('surge_multiplier')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .maybeSingle();

    // 计算距离和价格
    let fare = 0;
    let distance_km = 0;
    let duration_minutes = 0;

    if (dto.service_type === 'POINT_TO_POINT') {
      if (!dto.dropoff_address) {
        throw new BadRequestException(
          'dropoff_address required for POINT_TO_POINT',
        );
      }

      distance_km = this.calcDistance(
        dto.pickup_lat,
        dto.pickup_lng,
        dto.dropoff_lat!,
        dto.dropoff_lng!,
      );
      duration_minutes = Math.round(distance_km * 1.5);

      fare =
        vehicleType.base_fare +
        vehicleType.per_km_rate * distance_km +
        (vehicleType.per_minute_rate ?? 0) * duration_minutes;
      fare = Math.max(fare, vehicleType.minimum_fare ?? vehicleType.base_fare);
    } else if (dto.service_type === 'HOURLY_CHARTER') {
      if (!dto.duration_hours) {
        throw new BadRequestException(
          'duration_hours required for HOURLY_CHARTER',
        );
      }

      fare = dto.duration_hours * (vehicleType.hourly_rate ?? 0);
      fare = Math.max(fare, vehicleType.minimum_fare ?? vehicleType.base_fare);
    }

    if (pricingRule?.surge_multiplier && pricingRule.surge_multiplier > 1) {
      fare = fare * pricingRule.surge_multiplier;
    }

    // 时段加价计算
    const { surcharge_amount, surcharge_percentage } =
      await this.calculateSurcharge(
        fare,
        dto.pickup_datetime,
        [],
      );

    // 折扣计算
    let discount_amount = 0;
    let discount_type: string | null = null;
    let discount_value = 0;
    let discount_applies_to = 'FARE_ONLY';
    let promo_code_id: string | null = null;

    if (dto.promo_code) {
      const promo = await this.validatePromoCode(
        tenant_id,
        dto.promo_code,
        fare,
      );
      if (promo) {
        discount_type = 'PROMO';
        discount_value = promo.discount_value;
        discount_applies_to = promo.applies_to;
        promo_code_id = promo.id;

        const base =
          promo.applies_to === 'FARE_ONLY' ? fare : fare + surcharge_amount;
        discount_amount =
          promo.discount_type === 'PERCENTAGE'
            ? (base * promo.discount_value) / 100
            : promo.discount_value;
      }
    }

    // 计算subtotal和total_price
    const subtotal = fare + surcharge_amount;
    const total_price = parseFloat(
      Math.max(0, subtotal - discount_amount).toFixed(2),
    );

    // 获取乘客信息
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, phone, email')
      .eq('id', passenger_id)
      .single();

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        tenant_id,
        passenger_id,
        booker_id: passenger_id,
        service_city_id: dto.service_city_id,
        service_type: dto.service_type,
        trip_type: dto.trip_type,
        vehicle_type_id: dto.vehicle_type_id ?? null,
        pickup_address: dto.pickup_address,
        pickup_lat: dto.pickup_lat,
        pickup_lng: dto.pickup_lng,
        dropoff_address: dto.dropoff_address ?? null,
        dropoff_lat: dto.dropoff_lat ?? null,
        dropoff_lng: dto.dropoff_lng ?? null,
        waypoints: dto.waypoints ?? [],
        pickup_datetime: dto.pickup_datetime,
        pickup_timezone: dto.pickup_timezone,
        return_datetime: dto.return_datetime ?? null,
        duration_hours: dto.duration_hours ?? null,
        passenger_count: dto.passenger_count,
        flight_number: dto.flight_number ?? null,
        special_requests: dto.special_requests ?? null,
        passenger_name: dto.passenger_name ?? null,
        passenger_phone: dto.passenger_phone ?? null,
        passenger_email: dto.passenger_email ?? null,
        billing_method: dto.billing_method ?? null,
        contact_id: dto.contact_id ?? null,
        distance_km: parseFloat(distance_km.toFixed(2)),
        duration_minutes,
        fare: parseFloat(fare.toFixed(2)),
        toll: 0,
        extras: 0,
        surcharge_amount: parseFloat(surcharge_amount.toFixed(2)),
        surcharge_percentage: parseFloat(surcharge_percentage.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount_type,
        discount_value,
        discount_amount: parseFloat(discount_amount.toFixed(2)),
        discount_applies_to,
        total_price,
        currency: serviceCity.currency,
        booking_status: 'PENDING',
        driver_status: 'UNASSIGNED',
        payment_status: 'UNPAID',
        created_timezone: dto.created_timezone ?? null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 更新联系人统计
    if (dto.contact_id) {
      await this.contactsService.updateStats(dto.contact_id, booking.total_price ?? 0);
    }

    // 记录状态日志
    await this.logStatusChange(booking.id, {
      booking_status: 'PENDING',
      driver_status: 'UNASSIGNED',
      payment_status: 'UNPAID',
      changed_by: passenger_id,
      changed_by_role: 'PASSENGER',
      note: 'Booking created',
    });

    // 通知：订单收到
    await this.notificationsService.notifyBookingReceived({
      ...booking,
      booker_email: (profile as any)?.email,
      booker_name: `${(profile as any)?.first_name ?? ''} ${(profile as any)?.last_name ?? ''}`.trim(),
      tenant_name: await this.getTenantName(tenant_id),
    });

    return booking;
  }

  // =====================
  // Admin确认订单
  // =====================
  async confirmBooking(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    dto: {
      fare?: number;
      toll?: number;
      extras?: number;
    } = {},
  ) {
    const booking = await this.getBookingOrFail(booking_id, tenant_id);

    if (booking.booking_status !== 'PENDING') {
      throw new BadRequestException('Only PENDING bookings can be confirmed');
    }

    // 如果Admin调整了金额
    const fare = dto.fare ?? booking.fare;
    const toll = dto.toll ?? booking.toll;
    const extras = dto.extras ?? booking.extras;
    const subtotal = fare + booking.surcharge_amount - booking.discount_amount;
    const total_price = parseFloat(
      Math.max(0, subtotal + toll + extras).toFixed(2),
    );

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        booking_status: 'CONFIRMED',
        payment_status: 'PAID',
        fare,
        toll,
        extras,
        subtotal,
        total_price,
        charged_amount: total_price,
        confirmed_by: admin_id,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      booking_status: 'CONFIRMED',
      payment_status: 'PAID',
      changed_by: admin_id,
      changed_by_role: 'TENANT_ADMIN',
      note: 'Booking confirmed by admin',
    });

    const fullBooking = await this.getBookingWithDetails(booking_id, tenant_id);
    if (fullBooking) {
      await this.notificationsService.notifyBookingConfirmed(fullBooking);
    }

    await this.webhooksService.triggerEvent(
      tenant_id,
      'booking.confirmed',
      { booking_id: data.id, booking_number: data.booking_number },
    ).catch(() => {});

    return data;
  }

  // =====================
  // Admin拒绝订单
  // =====================
  async declineBooking(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    note?: string,
  ) {
    const booking = await this.getBookingOrFail(booking_id, tenant_id);

    if (booking.booking_status !== 'PENDING') {
      throw new BadRequestException('Only PENDING bookings can be declined');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        booking_status: 'CANCELLED',
        payment_status: 'UNPAID',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      booking_status: 'CANCELLED',
      changed_by: admin_id,
      changed_by_role: 'TENANT_ADMIN',
      note: note ?? 'Booking declined by admin',
    });

    return data;
  }

  // =====================
  // 派单给司机
  // =====================
  async assignDriver(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    dto: {
      driver_id: string;
      driver_fare: number;
      driver_toll: number;
      driver_extras?: number;
    },
  ) {
    const booking = await this.getBookingOrFail(booking_id, tenant_id);

    if (booking.booking_status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Only CONFIRMED bookings can be dispatched',
      );
    }

    const driver_total = parseFloat(
      (dto.driver_fare + dto.driver_toll + (dto.driver_extras ?? 0)).toFixed(2),
    );

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        driver_id: dto.driver_id,
        driver_status: 'ASSIGNED',
        driver_fare: dto.driver_fare,
        driver_toll: dto.driver_toll,
        driver_extras: dto.driver_extras ?? 0,
        driver_total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      driver_status: 'ASSIGNED',
      changed_by: admin_id,
      changed_by_role: 'TENANT_ADMIN',
      note: `Driver assigned: ${dto.driver_id}`,
    });

    const fullBooking = await this.getBookingWithDetails(booking_id, tenant_id);
    if (fullBooking) {
      await this.notificationsService.notifyDriverAssigned(fullBooking);
    }

    await this.webhooksService.triggerEvent(
      tenant_id,
      'booking.driver_assigned',
      { booking_id: data.id, driver_id: dto.driver_id },
    ).catch(() => {});

    return data;
  }

  // =====================
  // 司机接单
  // =====================
  async acceptJob(booking_id: string, user_id: string) {
    const driver_id = await this.getDriverIdByUserId(user_id);

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('driver_id', driver_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.driver_status !== 'ASSIGNED') {
      throw new BadRequestException('Job is not in ASSIGNED status');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        driver_status: 'ACCEPTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      driver_status: 'ACCEPTED',
      changed_by: driver_id,
      changed_by_role: 'DRIVER',
      note: 'Driver accepted the job',
    });

    return data;
  }

  // =====================
  // 司机拒绝
  // =====================
  async declineJob(booking_id: string, user_id: string) {
    const driver_id = await this.getDriverIdByUserId(user_id);

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('driver_id', driver_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.driver_status !== 'ASSIGNED') {
      throw new BadRequestException('Job is not in ASSIGNED status');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        driver_id: null,
        driver_status: 'UNASSIGNED',
        driver_fare: 0,
        driver_toll: 0,
        driver_extras: 0,
        driver_total: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      driver_status: 'UNASSIGNED',
      changed_by: driver_id,
      changed_by_role: 'DRIVER',
      note: 'Driver declined the job',
    });

    return data;
  }

  // =====================
  // 司机出发
  // =====================
  async driverOnTheWay(booking_id: string, user_id: string) {
    const driver_id = await this.getDriverIdByUserId(user_id);

    const data = await this.updateDriverStatus(
      booking_id,
      driver_id,
      'ACCEPTED',
      'ON_THE_WAY',
      'Driver is on the way',
    );

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('tenant_id')
      .eq('id', booking_id)
      .single();

    if (booking?.tenant_id) {
      const fullBooking = await this.getBookingWithDetails(
        booking_id,
        booking.tenant_id as string,
      );
      if (fullBooking) {
        await this.notificationsService.notifyDriverOnTheWay(fullBooking);
      }
      await this.webhooksService.triggerEvent(
        booking.tenant_id as string,
        'booking.driver_on_the_way',
        { booking_id },
      ).catch(() => {});
    }

    return data;
  }

  // =====================
  // 司机到达
  // =====================
  async driverArrived(booking_id: string, user_id: string) {
    const driver_id = await this.getDriverIdByUserId(user_id);

    const data = await this.updateDriverStatus(
      booking_id,
      driver_id,
      'ON_THE_WAY',
      'ARRIVED',
      'Driver has arrived',
    );

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('tenant_id')
      .eq('id', booking_id)
      .single();

    if (booking?.tenant_id) {
      const fullBooking = await this.getBookingWithDetails(
        booking_id,
        booking.tenant_id as string,
      );
      if (fullBooking) {
        await this.notificationsService.notifyDriverArrived(fullBooking);
      }
      await this.webhooksService.triggerEvent(
        booking.tenant_id as string,
        'booking.driver_arrived',
        { booking_id },
      ).catch(() => {});
    }

    return data;
  }

  // =====================
  // 乘客上车
  // =====================
  async passengerOnBoard(booking_id: string, user_id: string) {
    const driver_id = await this.getDriverIdByUserId(user_id);

    await this.updateDriverStatus(
      booking_id,
      driver_id,
      'ARRIVED',
      'PASSENGER_ON_BOARD',
      'Passenger on board',
    );

    // 同时更新booking_status为IN_PROGRESS
    await supabaseAdmin
      .from('bookings')
      .update({
        booking_status: 'IN_PROGRESS',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id);

    return { message: 'Trip started' };
  }

  // =====================
  // No Show
  // =====================
  async markNoShow(booking_id: string, user_id: string) {
    const driver_id = await this.getDriverIdByUserId(user_id);

    return this.updateDriverStatus(
      booking_id,
      driver_id,
      'ARRIVED',
      'JOB_DONE',
      'Passenger no show',
    );
  }

  // =====================
  // 行程完成（司机）
  // =====================
  async jobDone(
    booking_id: string,
    user_id: string,
    dto: {
      actual_km?: number;
      driver_extras?: number;
      note?: string;
    } = {},
  ) {
    const driver_id = await this.getDriverIdByUserId(user_id);

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('driver_id', driver_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.driver_status !== 'PASSENGER_ON_BOARD') {
      throw new BadRequestException(
        'Booking must be PASSENGER_ON_BOARD to complete',
      );
    }

    // 计算超出KM费用（如果是Hourly Charter）
    let extra_km_charge = 0;
    if (
      booking.service_type === 'HOURLY_CHARTER' &&
      booking.included_km_per_hour &&
      dto.actual_km
    ) {
      const included_km =
        booking.included_km_per_hour * (booking.duration_hours ?? 1);
      const extra_km = Math.max(0, dto.actual_km - included_km);
      extra_km_charge = extra_km * (booking.extra_km_rate ?? 0);
    }

    const driver_extras =
      (dto.driver_extras ?? booking.driver_extras) + extra_km_charge;
    const driver_total = parseFloat(
      (booking.driver_fare + booking.driver_toll + driver_extras).toFixed(2),
    );

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        driver_status: 'JOB_DONE',
        booking_status: 'COMPLETED',
        actual_km: dto.actual_km ?? null,
        driver_extras,
        driver_total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      booking_status: 'COMPLETED',
      driver_status: 'JOB_DONE',
      changed_by: driver_id,
      changed_by_role: 'DRIVER',
      note: dto.note ?? 'Job completed by driver',
    });

    const fullBooking = await this.getBookingWithDetails(
      booking_id,
      booking.tenant_id as string,
    );
    if (fullBooking) {
      await this.notificationsService.notifyTripCompleted(fullBooking);
    }

    await this.webhooksService.triggerEvent(
      booking.tenant_id as string,
      'booking.completed',
      { booking_id: data.id, booking_number: data.booking_number },
    ).catch(() => {});

    return data;
  }

  // =====================
  // Admin Fulfil
  // =====================
  async fulfil(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    dto: {
      supplement_amount?: number;
      credit_amount?: number;
      note?: string;
    } = {},
  ) {
    const booking = await this.getBookingOrFail(booking_id, tenant_id);

    if (booking.driver_status !== 'JOB_DONE') {
      throw new BadRequestException(
        'Only JOB_DONE bookings can be fulfilled',
      );
    }

    const supplement_amount = dto.supplement_amount ?? 0;
    const credit_amount = dto.credit_amount ?? 0;
    const final_amount = parseFloat(
      (booking.charged_amount + supplement_amount - credit_amount).toFixed(2),
    );

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        booking_status: 'COMPLETED',
        payment_status: 'PAID',
        supplement_amount,
        credit_amount,
        charged_amount: final_amount,
        fulfilled_by: admin_id,
        fulfilled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 记录支付
    if (supplement_amount > 0) {
      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'SUPPLEMENT',
        amount: supplement_amount,
        note: dto.note ?? 'Supplement charge',
        processed_by: admin_id,
      });
    }

    if (credit_amount > 0) {
      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'CREDIT_NOTE',
        amount: -credit_amount,
        note: dto.note ?? 'Credit note issued',
        processed_by: admin_id,
      });
    }

    await this.logStatusChange(booking_id, {
      booking_status: 'COMPLETED',
      payment_status: 'PAID',
      changed_by: admin_id,
      changed_by_role: 'TENANT_ADMIN',
      note: dto.note ?? 'Booking fulfilled',
    });

    return data;
  }

  // =====================
  // Modify订单
  // =====================
  async modifyBooking(
    booking_id: string,
    tenant_id: string,
    modified_by: string,
    modified_by_role: string,
    dto: {
      pickup_address?: string;
      pickup_lat?: number;
      pickup_lng?: number;
      dropoff_address?: string;
      dropoff_lat?: number;
      dropoff_lng?: number;
      waypoints?: any[];
      pickup_datetime?: string;
      return_datetime?: string;
      duration_hours?: number;
      service_type?: string;
      vehicle_type_id?: string;
      passenger_name?: string;
      passenger_phone?: string;
      passenger_email?: string;
      passenger_count?: number;
      flight_number?: string;
      special_requests?: string;
    },
  ) {
    const booking = await this.getBookingOrFail(booking_id, tenant_id);

    // 检查是否可以修改
    if (['COMPLETED', 'CANCELLED'].includes(booking.booking_status)) {
      throw new BadRequestException(
        'Cannot modify completed or cancelled bookings',
      );
    }

    // 如果乘客修改，只允许在PENDING状态
    if (
      modified_by_role === 'PASSENGER' &&
      booking.booking_status !== 'PENDING'
    ) {
      throw new ForbiddenException(
        'Passengers can only modify PENDING bookings',
      );
    }

    // 需要重新计价的字段
    const needsRecalculation =
      dto.pickup_address !== undefined ||
      dto.dropoff_address !== undefined ||
      dto.vehicle_type_id !== undefined ||
      dto.service_type !== undefined ||
      dto.duration_hours !== undefined ||
      dto.pickup_datetime !== undefined;

    let updates: any = { ...dto, updated_at: new Date().toISOString() };
    const old_total = booking.total_price;
    let new_total = booking.total_price;

    if (needsRecalculation) {
      // 重新计算价格
      const recalculated = await this.recalculatePrice(booking, dto);
      updates = { ...updates, ...recalculated };
      new_total = recalculated.total_price;
    }

    // 记录修改历史
    const modify_record = {
      modified_at: new Date().toISOString(),
      modified_by,
      modified_by_role,
      old_total,
      new_total,
      changes: dto,
      supplement:
        new_total > old_total
          ? parseFloat((new_total - old_total).toFixed(2))
          : 0,
      refund:
        new_total < old_total
          ? parseFloat((old_total - new_total).toFixed(2))
          : 0,
    };

    updates.modify_history = [
      ...(booking.modify_history ?? []),
      modify_record,
    ];

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updates)
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 如果已付款且价格变动，记录支付差异
    if (booking.payment_status === 'PAID' && needsRecalculation) {
      const diff = parseFloat((new_total - old_total).toFixed(2));
      if (diff > 0) {
        await this.recordPayment(booking_id, tenant_id, {
          payment_type: 'SUPPLEMENT',
          amount: diff,
          note: 'Modify supplement',
          processed_by: modified_by,
        });
      } else if (diff < 0) {
        await this.recordPayment(booking_id, tenant_id, {
          payment_type: 'CREDIT_NOTE',
          amount: diff,
          note: 'Modify refund',
          processed_by: modified_by,
        });
      }
    }

    await this.logStatusChange(booking_id, {
      booking_status: booking.booking_status,
      driver_status: booking.driver_status,
      changed_by: modified_by,
      changed_by_role: modified_by_role,
      note: `Booking modified. Old total: ${old_total}, New total: ${new_total}`,
    });

    const fullBooking = await this.getBookingWithDetails(booking_id, tenant_id);
    if (fullBooking) {
      await this.notificationsService.notifyBookingModified(
        fullBooking,
        `Old total: ${old_total}, New total: ${new_total}`,
      );
    }

    return data;
  }

  // =====================
  // 取消订单
  // =====================
  async cancelBooking(
    booking_id: string,
    tenant_id: string,
    cancelled_by: string,
    cancelled_by_role: string,
    reason?: string,
  ) {
    const booking = await this.getBookingOrFail(booking_id, tenant_id);

    if (['COMPLETED', 'CANCELLED'].includes(booking.booking_status)) {
      throw new BadRequestException(
        'Booking is already completed or cancelled',
      );
    }

    // Admin取消 → 全额退款
    // 乘客取消 → 按取消政策
    let refunded_amount = 0;

    if (cancelled_by_role === 'TENANT_ADMIN') {
      refunded_amount = booking.charged_amount;
    } else if (
      cancelled_by_role === 'PASSENGER' &&
      booking.payment_status === 'PAID'
    ) {
      const policy = await this.getCancellationFee(
        tenant_id,
        booking.pickup_datetime,
      );
      const cancellation_fee = parseFloat(
        ((booking.charged_amount * policy.percentage) / 100).toFixed(2),
      );
      refunded_amount = parseFloat(
        (booking.charged_amount - cancellation_fee).toFixed(2),
      );
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        booking_status: 'CANCELLED',
        payment_status:
          refunded_amount > 0 ? 'REFUNDED' : booking.payment_status,
        refunded_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    if (refunded_amount > 0) {
      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'REFUND',
        amount: -refunded_amount,
        note: reason ?? 'Booking cancelled',
        processed_by: cancelled_by,
      });
    }

    await this.logStatusChange(booking_id, {
      booking_status: 'CANCELLED',
      changed_by: cancelled_by,
      changed_by_role: cancelled_by_role,
      note: reason ?? 'Booking cancelled',
    });

    const fullBooking = await this.getBookingWithDetails(booking_id, tenant_id);
    if (fullBooking) {
      await this.notificationsService.notifyBookingCancelled(fullBooking);
    }

    await this.webhooksService.triggerEvent(
      tenant_id,
      'booking.cancelled',
      { booking_id: data.id, reason: reason ?? 'Booking cancelled' },
    ).catch(() => {});

    return data;
  }

  // =====================
  // No Show处理
  // =====================
  async handleNoShow(
    booking_id: string,
    tenant_id: string,
    admin_id: string,
    dto: {
      action: 'REFUND' | 'CLOSE';
      note?: string;
    },
  ) {
    const booking = await this.getBookingOrFail(booking_id, tenant_id);

    const updates: any = {
      booking_status: 'NO_SHOW',
      updated_at: new Date().toISOString(),
    };

    if (dto.action === 'REFUND') {
      updates.payment_status = 'REFUNDED';
      updates.refunded_amount = booking.charged_amount;

      await this.recordPayment(booking_id, tenant_id, {
        payment_type: 'REFUND',
        amount: -booking.charged_amount,
        note: dto.note ?? 'No show refund',
        processed_by: admin_id,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updates)
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      booking_status: 'NO_SHOW',
      changed_by: admin_id,
      changed_by_role: 'TENANT_ADMIN',
      note: dto.note ?? `No show - ${dto.action}`,
    });

    return data;
  }

  // =====================
  // 今日统计
  // =====================
  async getTodayStats(tenant_id: string) {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).toISOString();
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    ).toISOString();

    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('id, status, payment_status, total_price, currency')
      .eq('tenant_id', tenant_id)
      .gte('pickup_datetime', startOfDay)
      .lt('pickup_datetime', endOfDay);

    const all = bookings ?? [];
    const pending = all.filter((b: any) => b.status === 'PENDING').length;
    const in_progress = all.filter(
      (b: any) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS',
    ).length;
    const today_revenue = all
      .filter((b: any) => b.payment_status === 'PAID')
      .reduce((sum: number, b: any) => sum + (b.total_price ?? 0), 0);
    const currency = all[0]?.currency ?? 'AUD';

    return {
      today_total: all.length,
      pending,
      in_progress,
      completed: all.filter((b: any) => b.status === 'COMPLETED').length,
      today_revenue: parseFloat(today_revenue.toFixed(2)),
      currency,
    };
  }

  // =====================
  // 查询方法
  // =====================
  async getBooking(booking_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        `
          *,
          profiles!bookings_passenger_id_fkey(
            first_name, last_name, phone, email
          ),
          drivers(
            id,
            profiles(first_name, last_name, phone),
            vehicles:driver_vehicles(
              make, model, year, color, plate_number,
              platform_vehicle_id,
              platform_vehicle:platform_vehicles(make, model)
            )
          ),
          tenant_service_cities(city_name, timezone, currency),
          tenant_vehicle_types(name),
          booking_status_logs(
            booking_status, driver_status, payment_status,
            changed_by_role, note, created_at
          )
        `,
      )
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Booking not found');
    return this.formatBookingResponse(data);
  }

  async getBookings(
    tenant_id: string,
    filters: {
      booking_status?: string;
      driver_status?: string;
      payment_status?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    let query = supabaseAdmin
      .from('bookings')
      .select(
        `
          *,
          profiles!bookings_passenger_id_fkey(first_name, last_name, phone),
          drivers(
            profiles(first_name, last_name),
            vehicles(make, model, plate_number)
          ),
          tenant_service_cities(city_name, timezone)
        `,
        { count: 'exact' },
      )
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (filters.booking_status) {
      query = query.eq('booking_status', filters.booking_status);
    }
    if (filters.driver_status) {
      query = query.eq('driver_status', filters.driver_status);
    }
    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    return {
      data: (data ?? []).map((b: any) => this.formatBookingResponse(b)),
      total: count ?? 0,
      page,
      limit,
    };
  }

  async getDriverBookings(user_id: string, query: any = {}) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found');

    let request = supabaseAdmin
      .from('bookings')
      .select(
        `
          *,
          tenant_service_cities(city_name, timezone)
        `,
      )
      .eq('driver_id', driver.id)
      .order('pickup_datetime', { ascending: true });

    if (query?.active) {
      request = request.in('driver_status', [
        'ASSIGNED',
        'ACCEPTED',
        'ON_THE_WAY',
        'ARRIVED',
        'PASSENGER_ON_BOARD',
      ]);
    }

    const { data, error } = await request;

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((b: any) => this.formatBookingResponse(b));
  }

  async getDriverBookingById(booking_id: string, user_id: string) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, tenant_id')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found');

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*, tenant_service_cities(city_name, timezone)')
      .eq('id', booking_id)
      .eq('driver_id', driver.id)
      .single();

    if (error || !data) throw new NotFoundException('Booking not found');
    return this.formatBookingResponse(data);
  }

  async driverUpdateStatus(
    booking_id: string,
    user_id: string,
    status:
      | 'ACCEPTED'
      | 'ON_THE_WAY'
      | 'ARRIVED'
      | 'PASSENGER_ON_BOARD'
      | 'JOB_DONE',
  ) {
    if (status === 'ACCEPTED') return this.acceptJob(booking_id, user_id);
    if (status === 'ON_THE_WAY') return this.driverOnTheWay(booking_id, user_id);
    if (status === 'ARRIVED') return this.driverArrived(booking_id, user_id);
    if (status === 'PASSENGER_ON_BOARD') {
      return this.passengerOnBoard(booking_id, user_id);
    }
    if (status === 'JOB_DONE') return this.jobDone(booking_id, user_id, {});

    throw new BadRequestException('Invalid driver status');
  }

  async getMyBookings(user_id: string, query: any = {}) {
    let request = supabaseAdmin
      .from('booking_summary')
      .select('*')
      .eq('passenger_id', user_id)
      .order('pickup_datetime', { ascending: false });

    if (query.booking_status) {
      const statuses = String(query.booking_status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length > 0) {
        request = request.in('booking_status', statuses);
      }
    }

    const limit = parseInt(String(query.limit ?? '20'), 10);
    request = request.limit(Number.isNaN(limit) ? 20 : limit);

    const { data, error } = await request;
    if (error) throw new BadRequestException(error.message);

    return {
      data: data ?? [],
      total: data?.length ?? 0,
    };
  }

  async getMyBookingById(booking_id: string, user_id: string) {
    const { data, error } = await supabaseAdmin
      .from('booking_summary')
      .select('*')
      .eq('id', booking_id)
      .eq('passenger_id', user_id)
      .single();

    if (error || !data) throw new NotFoundException('Booking not found');
    return data;
  }

  async cancelMyBooking(booking_id: string, user_id: string) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, tenant_id, booking_status, driver_status, total_price, payment_status')
      .eq('id', booking_id)
      .eq('passenger_id', user_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (!['PENDING', 'CONFIRMED'].includes(booking.booking_status)) {
      throw new BadRequestException('Cannot cancel this booking');
    }

    if (booking.driver_status !== 'UNASSIGNED') {
      throw new BadRequestException(
        'Cannot cancel after driver has been assigned. Please contact support.',
      );
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        booking_status: 'CANCELLED',
        payment_status:
          booking.payment_status === 'PAID' ? 'REFUNDED' : booking.payment_status,
        refunded_amount:
          booking.payment_status === 'PAID' ? booking.total_price : 0,
        cancellation_reason: 'Customer cancellation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.notificationsService.notifyBookingCancelled(data).catch(() => {});
    return data;
  }

  async getPassengerBookings(passenger_id: string) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        `
          *,
          drivers(
            profiles(first_name, last_name, phone),
            vehicles(make, model, color, plate_number)
          ),
          tenant_service_cities(city_name, timezone)
        `,
      )
      .eq('passenger_id', passenger_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((b: any) => this.formatBookingResponse(b));
  }

  // =====================
  // 辅助方法
  // =====================
  private async getDriverIdByUserId(user_id: string): Promise<string> {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!driver?.id) throw new NotFoundException('Driver not found');
    return driver.id as string;
  }

  private async getBookingOrFail(booking_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Booking not found');
    return data;
  }

  private async updateDriverStatus(
    booking_id: string,
    driver_id: string,
    from_status: string,
    to_status: string,
    note: string,
  ) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('driver_status')
      .eq('id', booking_id)
      .eq('driver_id', driver_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.driver_status !== from_status) {
      throw new BadRequestException(
        `Driver status must be ${from_status}`,
      );
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        driver_status: to_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.logStatusChange(booking_id, {
      driver_status: to_status,
      changed_by: driver_id,
      changed_by_role: 'DRIVER',
      note,
    });

    return data;
  }

  private async logStatusChange(
    booking_id: string,
    dto: {
      booking_status?: string;
      driver_status?: string;
      payment_status?: string;
      changed_by?: string;
      changed_by_role?: string;
      note?: string;
    },
  ) {
    await supabaseAdmin.from('booking_status_logs').insert({
      booking_id,
      booking_status: dto.booking_status ?? null,
      driver_status: dto.driver_status ?? null,
      payment_status: dto.payment_status ?? null,
      changed_by: dto.changed_by ?? null,
      changed_by_role: dto.changed_by_role ?? null,
      note: dto.note ?? null,
    });
  }

  private async recordPayment(
    booking_id: string,
    tenant_id: string,
    dto: {
      payment_type: string;
      amount: number;
      note?: string;
      processed_by?: string;
    },
  ) {
    await supabaseAdmin.from('booking_payments').insert({
      booking_id,
      tenant_id,
      payment_type: dto.payment_type,
      amount: dto.amount,
      status: 'COMPLETED',
      note: dto.note ?? null,
      processed_by: dto.processed_by ?? null,
    });
  }

  private async calculateSurcharge(
    fare: number,
    pickup_datetime: string,
    surcharge_rules: any[],
  ): Promise<{
    surcharge_amount: number;
    surcharge_percentage: number;
  }> {
    if (!surcharge_rules || surcharge_rules.length === 0) {
      return { surcharge_amount: 0, surcharge_percentage: 0 };
    }

    const pickupDate = new Date(pickup_datetime);
    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][
      pickupDate.getDay()
    ];
    const timeStr = pickupDate.toTimeString().slice(0, 5);

    let total_percentage = 0;

    for (const rule of surcharge_rules) {
      let applies = false;

      if (rule.type === 'TIME_RANGE') {
        const inDay = rule.days?.includes(dayOfWeek);
        const inTime =
          timeStr >= rule.start_time && timeStr <= rule.end_time;
        applies = inDay && inTime;
      } else if (rule.type === 'DAY_TYPE') {
        applies = rule.days?.includes(dayOfWeek);
      } else if (rule.type === 'SPECIAL_DATE') {
        const dateStr = pickupDate.toISOString().slice(0, 10);
        applies = rule.dates?.includes(dateStr);
      }

      if (applies) {
        if (rule.surcharge_type === 'PERCENTAGE') {
          total_percentage += rule.surcharge_value;
        }
      }
    }

    const surcharge_amount = parseFloat(
      ((fare * total_percentage) / 100).toFixed(2),
    );
    return { surcharge_amount, surcharge_percentage: total_percentage };
  }

  private async validatePromoCode(
    tenant_id: string,
    code: string,
    fare: number,
  ) {
    const { data } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!data) return null;

    const now = new Date();
    if (data.valid_from && new Date(data.valid_from) > now) return null;
    if (data.valid_until && new Date(data.valid_until) < now) return null;
    if (data.max_uses && data.used_count >= data.max_uses) return null;
    if (data.min_order_amount && fare < data.min_order_amount) return null;

    return data;
  }

  private async getCancellationFee(
    tenant_id: string,
    pickup_datetime: string,
  ): Promise<{ percentage: number }> {
    const { data: policy } = await supabaseAdmin
      .from('tenant_cancellation_policies')
      .select('tiers')
      .eq('tenant_id', tenant_id)
      .eq('is_default', true)
      .single();

    if (!policy) return { percentage: 0 };

    const hoursUntilPickup =
      (new Date(pickup_datetime).getTime() - Date.now()) / 3600000;

    const tiers = (policy.tiers as any[]).sort(
      (a: any, b: any) => b.hours_before - a.hours_before,
    );

    for (const tier of tiers) {
      if (hoursUntilPickup >= tier.hours_before) {
        return { percentage: tier.charge_percentage };
      }
    }

    return { percentage: 100 };
  }

  private async recalculatePrice(booking: any, dto: any) {
    const vehicle_type_id = dto.vehicle_type_id ?? booking.vehicle_type_id;
    const service_type = dto.service_type ?? booking.service_type;
    const pickup_datetime = dto.pickup_datetime ?? booking.pickup_datetime;

    const { data: pricingRule } = await supabaseAdmin
      .from('pricing_rules')
      .select('*')
      .eq('tenant_id', booking.tenant_id)
      .eq('vehicle_type_id', vehicle_type_id)
      .eq('is_active', true)
      .single();

    if (!pricingRule) throw new NotFoundException('Pricing rule not found');

    let fare = 0;
    let distance_km = 0;
    let duration_minutes = 0;

    if (service_type === 'POINT_TO_POINT') {
      const pickup_lat = dto.pickup_lat ?? booking.pickup_lat;
      const pickup_lng = dto.pickup_lng ?? booking.pickup_lng;
      const dropoff_lat = dto.dropoff_lat ?? booking.dropoff_lat;
      const dropoff_lng = dto.dropoff_lng ?? booking.dropoff_lng;

      distance_km = this.calcDistance(
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng,
      );
      duration_minutes = Math.round(distance_km * 1.5);
      fare =
        pricingRule.base_fare +
        pricingRule.price_per_km * distance_km +
        pricingRule.price_per_minute * duration_minutes;
      fare = Math.max(fare, pricingRule.minimum_fare);
    } else if (service_type === 'HOURLY_CHARTER') {
      const duration_hours =
        dto.duration_hours ?? booking.duration_hours ?? 1;
      const hours = Math.max(duration_hours, pricingRule.minimum_hours ?? 1);
      fare = pricingRule.hourly_rate * hours;
      fare = Math.max(fare, pricingRule.minimum_fare);
    }

    const { surcharge_amount, surcharge_percentage } =
      await this.calculateSurcharge(
        fare,
        pickup_datetime,
        pricingRule.surcharge_rules ?? [],
      );

    // 保留原折扣，按新金额重新计算
    let discount_amount = 0;
    if (booking.discount_type && booking.discount_value) {
      const base =
        booking.discount_applies_to === 'FARE_ONLY'
          ? fare
          : fare + surcharge_amount;
      if (
        booking.discount_type === 'PROMO' ||
        booking.discount_type === 'MEMBERSHIP'
      ) {
        discount_amount = (base * booking.discount_value) / 100;
      } else {
        // MANUAL/CORPORATE保持固定金额
        discount_amount = booking.discount_amount;
      }
    }

    const subtotal = fare + surcharge_amount;
    const total_price = parseFloat(
      Math.max(0, subtotal - discount_amount).toFixed(2),
    );

    return {
      vehicle_type_id,
      service_type,
      fare: parseFloat(fare.toFixed(2)),
      distance_km: parseFloat(distance_km.toFixed(2)),
      duration_minutes,
      surcharge_amount: parseFloat(surcharge_amount.toFixed(2)),
      surcharge_percentage: parseFloat(surcharge_percentage.toFixed(2)),
      discount_amount: parseFloat(discount_amount.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      total_price,
    };
  }

  // 获取完整booking数据（含关联数据）
  private async getBookingWithDetails(booking_id: string, tenant_id: string) {
    const { data } = await supabaseAdmin
      .from('bookings')
      .select(
        `
      *,
      profiles!bookings_passenger_id_fkey(
        first_name, last_name, phone, email
      ),
      drivers(
        id,
        profiles(first_name, last_name, phone),
        vehicles(make, model, year, color, plate_number)
      ),
      tenant_service_cities(city_name, timezone, currency),
      tenants(name)
    `,
      )
      .eq('id', booking_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!data) return null;

    const profile = data.profiles as any;
    const tenant = data.tenants as any;

    return {
      ...data,
      booker_name:
        data.booker_name ??
        `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
      booker_email: data.booker_email ?? profile?.email,
      booker_phone: data.booker_phone ?? profile?.phone,
      tenant_name: tenant?.name ?? '',
    };
  }

  // 获取租户名称
  private async getTenantName(tenant_id: string): Promise<string> {
    const { data } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenant_id)
      .single();
    return (data as any)?.name ?? '';
  }

  private formatBookingResponse(booking: any) {
    const city = booking.tenant_service_cities;
    const timezone = city?.timezone ?? 'Australia/Sydney';
    const cityName = city?.city_name ?? 'Sydney';

    return {
      ...booking,
      pickup_datetime_local: booking.pickup_datetime
        ? this.formatLocalTime(booking.pickup_datetime, timezone, cityName)
        : null,
      return_datetime_local: booking.return_datetime
        ? this.formatLocalTime(booking.return_datetime, timezone, cityName)
        : null,
    };
  }

  private formatLocalTime(
    utc: string,
    timezone: string,
    cityName: string,
  ): string {
    const date = new Date(utc);
    const formatted = date.toLocaleString('en-AU', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${formatted} (${cityName})`;
  }

  private calcDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
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

  // ========================
  // REPORTS
  // ========================

  async getRevenueReport(tenant_id: string, query: any) {
    const now = new Date();
    const {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      to = now.toISOString().slice(0, 10),
      group_by = 'day',
    } = query;

    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, status, payment_status, total_price, fare, toll, extras, surcharge_amount, discount_amount, currency, pickup_datetime, vehicle_type_id, service_type',
      )
      .eq('tenant_id', tenant_id)
      .eq('payment_status', 'PAID')
      .gte('pickup_datetime', `${from}T00:00:00`)
      .lte('pickup_datetime', `${to}T23:59:59`)
      .order('pickup_datetime', { ascending: true });

    const all = bookings ?? [];

    const grouped: Record<string, { date: string; revenue: number; bookings: number; avg_fare: number }> = {};
    all.forEach((b) => {
      const dt = new Date(b.pickup_datetime);
      let key = '';
      if (group_by === 'day') key = dt.toISOString().slice(0, 10);
      else if (group_by === 'week') {
        const ws = new Date(dt);
        ws.setDate(dt.getDate() - dt.getDay());
        key = ws.toISOString().slice(0, 10);
      } else if (group_by === 'month') key = dt.toISOString().slice(0, 7);

      if (!grouped[key]) grouped[key] = { date: key, revenue: 0, bookings: 0, avg_fare: 0 };
      grouped[key].revenue += b.total_price ?? 0;
      grouped[key].bookings += 1;
    });

    Object.values(grouped).forEach((g) => {
      g.avg_fare = g.bookings > 0 ? g.revenue / g.bookings : 0;
      g.revenue = parseFloat(g.revenue.toFixed(2));
      g.avg_fare = parseFloat(g.avg_fare.toFixed(2));
    });

    const byVehicleType: Record<string, { vehicle_type_id: string; revenue: number; bookings: number }> = {};
    all.forEach((b) => {
      const vt = b.vehicle_type_id ?? 'UNKNOWN';
      if (!byVehicleType[vt]) byVehicleType[vt] = { vehicle_type_id: vt, revenue: 0, bookings: 0 };
      byVehicleType[vt].revenue += b.total_price ?? 0;
      byVehicleType[vt].bookings += 1;
    });

    const byServiceType: Record<string, number> = {};
    all.forEach((b) => {
      const st = b.service_type ?? 'UNKNOWN';
      byServiceType[st] = (byServiceType[st] ?? 0) + 1;
    });

    const total_revenue = all.reduce((sum, b) => sum + (b.total_price ?? 0), 0);

    return {
      from,
      to,
      group_by,
      total_revenue: parseFloat(total_revenue.toFixed(2)),
      total_bookings: all.length,
      currency: all[0]?.currency ?? 'AUD',
      timeline: Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)),
      by_vehicle_type: Object.values(byVehicleType).map((v) => ({
        ...v,
        revenue: parseFloat(v.revenue.toFixed(2)),
      })),
      by_service_type: Object.entries(byServiceType).map(([service_type, count]) => ({
        service_type,
        count,
      })),
    };
  }

  async getDriverReport(tenant_id: string, query: any) {
    const now = new Date();
    const {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      to = now.toISOString().slice(0, 10),
    } = query;

    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select(
        `id, driver_id, status, total_price, pickup_datetime, vehicle_type_id,
         drivers(profiles(first_name, last_name))`,
      )
      .eq('tenant_id', tenant_id)
      .eq('status', 'COMPLETED')
      .not('driver_id', 'is', null)
      .gte('pickup_datetime', `${from}T00:00:00`)
      .lte('pickup_datetime', `${to}T23:59:59`);

    const all = bookings ?? [];

    const byDriver: Record<
      string,
      { driver_id: string; driver_name: string; total_earnings: number; total_jobs: number; avg_earnings: number }
    > = {};

    all.forEach((b: any) => {
      if (!b.driver_id) return;
      const key = b.driver_id;
      if (!byDriver[key]) {
        const p = b.drivers?.profiles;
        byDriver[key] = {
          driver_id: b.driver_id,
          driver_name: `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown',
          total_earnings: 0,
          total_jobs: 0,
          avg_earnings: 0,
        };
      }
      byDriver[key].total_earnings += b.total_price ?? 0;
      byDriver[key].total_jobs += 1;
    });

    Object.values(byDriver).forEach((d) => {
      d.avg_earnings = d.total_jobs > 0 ? d.total_earnings / d.total_jobs : 0;
      d.total_earnings = parseFloat(d.total_earnings.toFixed(2));
      d.avg_earnings = parseFloat(d.avg_earnings.toFixed(2));
    });

    return {
      from,
      to,
      total_jobs: all.length,
      drivers: Object.values(byDriver).sort((a, b) => b.total_jobs - a.total_jobs),
    };
  }

  async getReportSummary(tenant_id: string, query: any) {
    const now = new Date();
    const {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      to = now.toISOString().slice(0, 10),
    } = query;

    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('id, status, payment_status, total_price, currency')
      .eq('tenant_id', tenant_id)
      .gte('pickup_datetime', `${from}T00:00:00`)
      .lte('pickup_datetime', `${to}T23:59:59`);

    const all = bookings ?? [];
    const total = all.length;
    const completed = all.filter((b) => b.status === 'COMPLETED').length;
    const cancelled = all.filter((b) => b.status === 'CANCELLED').length;
    const pending = all.filter((b) => b.status === 'PENDING').length;
    const revenue = all
      .filter((b) => b.payment_status === 'PAID')
      .reduce((sum, b) => sum + (b.total_price ?? 0), 0);

    return {
      from,
      to,
      total_bookings: total,
      completed,
      cancelled,
      pending,
      completion_rate: total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
      cancellation_rate: total > 0 ? parseFloat(((cancelled / total) * 100).toFixed(1)) : 0,
      total_revenue: parseFloat(revenue.toFixed(2)),
      currency: all[0]?.currency ?? 'AUD',
    };
  }
}
