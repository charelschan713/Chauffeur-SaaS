import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtGuard } from '../common/guards/jwt.guard';

@Controller('customers')
@UseGuards(JwtGuard)
export class CustomerController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: any, @Query() query: any) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const offset = (page - 1) * limit;


    // Check if deleted_at column exists (migration may not have run yet)
    const colExists = await this.dataSource.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'deleted_at'
       LIMIT 1`,
    );
    const deletedAtFilter = colExists.length > 0 ? 'AND c.deleted_at IS NULL' : '';

    let where = `WHERE c.tenant_id = $1 ${deletedAtFilter}`;
    const params: any[] = [req.user.tenant_id];
    let idx = 2;

    if (query.search) {
      const s = `${query.search}`;
      where += ` AND (
        c.first_name ILIKE $${idx}
        OR c.last_name ILIKE $${idx}
        OR c.last_name ILIKE $${idx}
        OR c.email ILIKE $${idx}
        OR CONCAT(c.first_name,' ',c.last_name) ILIKE $${idx}
        OR c.phone_number ILIKE $${idx + 1}
      )`;
      params.push(`%${s}%`);
      params.push(`${s}%`);
      idx += 2;
    }

    const orderClause = (query.sort === 'recent')
      ? 'ORDER BY c.created_at DESC'
      : 'ORDER BY c.last_name ASC';

    const count = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.customers c ${where}`,
      params,
    );
    const total = Number(count[0]?.count ?? 0);

    const data = await this.dataSource.query(
      `SELECT c.*
       FROM public.customers c
       ${where}
       ${orderClause}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return {
      data,
      meta: { page, limit, total, has_next: page * limit < total },
    };
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.customers
         (tenant_id, user_id, first_name, last_name, email,
          phone_country_code, phone_number, tier,
          custom_discount_type, custom_discount_value, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, true)
       RETURNING id`,
      [
        req.user.tenant_id,
        body.user_id ?? null,
        body.first_name,
        body.last_name,
        body.email ?? null,
        body.phone_country_code ?? null,
        body.phone_number ?? null,
        body.tier ?? 'STANDARD',
        body.custom_discount_type ?? null,
        body.custom_discount_value ?? null,
      ],
    );
    return { id: rows[0].id };
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM public.customers WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    const customer = rows[0] ?? null;
    if (!customer) return null;

    const passengers = await this.dataSource.query(
      `SELECT * FROM public.customer_passengers
       WHERE tenant_id = $1 AND customer_id = $2 AND active = true
       ORDER BY created_at DESC`,
      [req.user.tenant_id, id],
    );

    return { customer, passengers };
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.dataSource.query(
      `UPDATE public.customers
       SET first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name),
           email = COALESCE($5, email),
           phone_country_code = COALESCE($6, phone_country_code),
           phone_number = COALESCE($7, phone_number),
           tier = COALESCE($8, tier),
           custom_discount_type = COALESCE($9, custom_discount_type),
           custom_discount_value = COALESCE($10, custom_discount_value),
           active = COALESCE($11, active),
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [
        id,
        req.user.tenant_id,
        body.first_name ?? null,
        body.last_name ?? null,
        body.email ?? null,
        body.phone_country_code ?? null,
        body.phone_number ?? null,
        body.tier ?? null,
        body.custom_discount_type ?? null,
        body.custom_discount_value ?? null,
        body.active ?? null,
      ],
    );
    return { success: true };
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.bookings
       WHERE customer_id = $1 AND tenant_id = $2
         AND operational_status NOT IN ('CANCELLED','COMPLETED','JOB_COMPLETED')`,
      [id, req.user.tenant_id],
    );
    const activeBookings = Number(rows[0]?.count ?? 0);
    if (activeBookings > 0) {
      throw new BadRequestException('Customer has active bookings and cannot be deleted');
    }
    await this.dataSource.query(
      // deleted_at may not exist yet - guard
      `UPDATE public.customers SET deleted_at = NOW()
       WHERE id = $1 AND tenant_id = $2
         AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'deleted_at'
         )`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }

  @Get(':id/passengers')
  async listPassengers(@Req() req: any, @Param('id') id: string) {
    return this.dataSource.query(
      `SELECT * FROM public.customer_passengers
       WHERE tenant_id = $1 AND customer_id = $2 AND active = true
       ORDER BY created_at DESC`,
      [req.user.tenant_id, id],
    );
  }

  @Post(':id/passengers')
  async createPassenger(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.customer_passengers
         (tenant_id, customer_id, first_name, last_name,
          phone_country_code, phone_number, preferences, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING id`,
      [
        req.user.tenant_id,
        id,
        body.first_name,
        body.last_name,
        body.phone_country_code ?? null,
        body.phone_number ?? null,
        body.preferences ?? {},
      ],
    );
    return { id: rows[0].id };
  }
}
