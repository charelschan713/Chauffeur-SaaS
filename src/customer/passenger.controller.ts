import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtGuard } from '../common/guards/jwt.guard';

@Controller('passengers')
@UseGuards(JwtGuard)
export class PassengerController {
  constructor(private readonly dataSource: DataSource) {}

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.dataSource.query(
      `UPDATE public.customer_passengers
       SET first_name          = COALESCE($3,  first_name),
           last_name           = COALESCE($4,  last_name),
           email               = COALESCE($5,  email),
           phone_country_code  = COALESCE($6,  phone_country_code),
           phone_number        = COALESCE($7,  phone_number),
           relationship        = COALESCE($8,  relationship),
           is_default          = COALESCE($9,  is_default),
           preferences         = COALESCE($10, preferences),
           updated_at          = now()
       WHERE id = $1 AND tenant_id = $2`,
      [
        id,
        req.user.tenant_id,
        body.first_name        ?? null,
        body.last_name         ?? null,
        body.email             ?? null,
        body.phone_country_code ?? null,
        body.phone_number      ?? null,
        body.relationship      ?? null,
        body.is_default        ?? null,
        body.preferences != null ? JSON.stringify(body.preferences) : null,
      ],
    );
    return { success: true };
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.dataSource.query(
      `UPDATE public.customer_passengers
       SET active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }

  /** Set a passenger as default — clears other defaults for same customer */
  @Post(':id/set-default')
  async setDefault(@Req() req: any, @Param('id') id: string) {
    // Get customer_id first
    const [p] = await this.dataSource.query(
      `SELECT customer_id FROM public.customer_passengers WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    if (!p) return { success: false };

    // Clear existing defaults for this customer
    await this.dataSource.query(
      `UPDATE public.customer_passengers SET is_default = false
       WHERE customer_id = $1 AND tenant_id = $2`,
      [p.customer_id, req.user.tenant_id],
    );

    // Set new default
    await this.dataSource.query(
      `UPDATE public.customer_passengers SET is_default = true, updated_at = now()
       WHERE id = $1`,
      [id],
    );
    return { success: true };
  }
}
