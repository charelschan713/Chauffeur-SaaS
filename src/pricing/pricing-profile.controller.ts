import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';

@Controller('pricing-profiles')
@UseGuards(JwtGuard)
export class PricingProfileController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT
         pp.id,
         pp.service_type_id,
         pp.service_class_id,
         pp.active,
         st.code as service_type_code,
         st.display_name as service_type_name,
         sc.name as service_class_name
       FROM public.tenant_service_pricing_profiles pp
       JOIN public.tenant_service_types st ON st.id = pp.service_type_id
       JOIN public.tenant_service_classes sc ON sc.id = pp.service_class_id
       WHERE pp.tenant_id = $1
       ORDER BY sc.name, st.code`,
      [req.user.tenant_id],
    );
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.tenant_service_pricing_profiles
         (tenant_id, service_type_id, service_class_id, active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (tenant_id, service_type_id, service_class_id)
       DO UPDATE SET active = true
       RETURNING id`,
      [req.user.tenant_id, body.service_type_id, body.service_class_id],
    );
    return { id: rows[0].id };
  }

  @Get(':id/items')
  async getItems(@Param('id') id: string) {
    const [items, hourlyConfig] = await Promise.all([
      this.dataSource.query(
        `SELECT id, item_type, amount_minor, unit, active
         FROM public.service_class_pricing_items
         WHERE pricing_profile_id = $1
         ORDER BY item_type`,
        [id],
      ),
      this.dataSource.query(
        `SELECT minimum_hours, km_per_hour_included
         FROM public.hourly_pricing_configs
         WHERE pricing_profile_id = $1`,
        [id],
      ),
    ]);
    return {
      items,
      hourlyConfig: hourlyConfig[0] ?? null,
    };
  }

  @Put(':id/items')
  async upsertItems(
    @Param('id') id: string,
    @Body()
    body: {
      items: { type: string; amount: number; enabled: boolean }[];
      hourlyConfig?: { minimum_hours: number; km_per_hour_included: number };
    },
    @Req() req: any,
  ) {
    await this.dataSource.transaction(async (manager) => {
      for (const item of body.items) {
        const unit =
          {
            BASE_FARE: 'flat',
            MINIMUM_FARE: 'flat',
            PER_KM: 'per_km',
            DRIVING_TIME: 'per_minute',
            WAITING_TIME: 'per_minute',
            HOURLY_RATE: 'per_hour',
            WAYPOINT: 'per_item',
            INFANT_SEAT: 'per_item',
            TODDLER_SEAT: 'per_item',
            BOOSTER_SEAT: 'per_item',
          }[item.type] ?? 'flat';

        await manager.query(
          `INSERT INTO public.service_class_pricing_items
             (tenant_id, service_class_id, pricing_profile_id,
              item_type, amount_minor, unit, active)
           SELECT
             pp.tenant_id,
             pp.service_class_id,
             pp.id,
             $2::public.pricing_item_type,
             $3,
             $4::public.pricing_unit,
             $5
           FROM public.tenant_service_pricing_profiles pp
           WHERE pp.id = $1
           ON CONFLICT (service_class_id, item_type)
           DO UPDATE SET
             pricing_profile_id = EXCLUDED.pricing_profile_id,
             amount_minor = EXCLUDED.amount_minor,
             unit = EXCLUDED.unit,
             active = EXCLUDED.active`,
          [id, item.type, Math.round(item.amount * 100), unit, item.enabled],
        );
      }

      if (body.hourlyConfig) {
        await manager.query(
          `INSERT INTO public.hourly_pricing_configs
             (pricing_profile_id, minimum_hours, km_per_hour_included)
           VALUES ($1, $2, $3)
           ON CONFLICT (pricing_profile_id)
           DO UPDATE SET
             minimum_hours = $2,
             km_per_hour_included = $3`,
          [
            id,
            body.hourlyConfig.minimum_hours,
            body.hourlyConfig.km_per_hour_included,
          ],
        );
      }
    });

    return { success: true };
  }
}
