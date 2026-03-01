import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MultiplierResolver {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(
    tenantId: string,
    serviceClassId: string,
  ): Promise<{ surgeMultiplier: number; serviceClassName: string }> {
    const rows = await this.dataSource.query(
      `SELECT name, surge_multiplier
       FROM public.tenant_service_classes
       WHERE id = $1
         AND tenant_id = $2
         AND active = true`,
      [serviceClassId, tenantId],
    );
    if (!rows.length) throw new Error('Service class not found');
    return {
      surgeMultiplier: Number(rows[0].surge_multiplier),
      serviceClassName: rows[0].name,
    };
  }
}
