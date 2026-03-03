import { Body, Controller, Delete, Patch, Param, Req, UseGuards } from '@nestjs/common';
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
       SET first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name),
           phone_country_code = COALESCE($5, phone_country_code),
           phone_number = COALESCE($6, phone_number),
           preferences = COALESCE($7, preferences),
           updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [
        id,
        req.user.tenant_id,
        body.first_name ?? null,
        body.last_name ?? null,
        body.phone_country_code ?? null,
        body.phone_number ?? null,
        body.preferences ?? null,
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
}
