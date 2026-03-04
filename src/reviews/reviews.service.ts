import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Platform review queue — approve/reject external drivers & vehicles.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly db: DataSource) {}

  // ─── Drivers ──────────────────────────────────────────────────────────────

  async listDriverReviews(statusFilter?: string) {
    const where = statusFilter
      ? `AND dp.approval_status = '${statusFilter}'`
      : `AND dp.approval_status = 'PENDING'`;
    return this.db.query(
      `SELECT dp.user_id, dp.source_type, dp.approval_status, dp.platform_verified,
              dp.apply_reason, dp.platform_notes, dp.reviewed_at, dp.created_at,
              u.full_name, u.email,
              m.tenant_id, t.name AS tenant_name
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN memberships m ON m.user_id = dp.user_id AND m.role = 'driver' AND m.status = 'active'
       LEFT JOIN tenants t ON t.id = m.tenant_id
       WHERE dp.source_type = 'EXTERNAL' ${where}
       ORDER BY dp.created_at ASC`,
    );
  }

  async approveDriver(adminUserId: string, driverId: string, notes?: string) {
    const [row] = await this.db.query(
      `UPDATE driver_profiles
       SET approval_status = 'APPROVED', platform_verified = true,
           platform_notes = $3, reviewed_at = NOW(), reviewed_by = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [driverId, adminUserId, notes ?? null],
    );
    if (!row) throw new NotFoundException('Driver profile not found');
    return row;
  }

  async rejectDriver(adminUserId: string, driverId: string, notes?: string) {
    const [row] = await this.db.query(
      `UPDATE driver_profiles
       SET approval_status = 'REJECTED', platform_verified = false,
           platform_notes = $3, reviewed_at = NOW(), reviewed_by = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [driverId, adminUserId, notes ?? null],
    );
    if (!row) throw new NotFoundException('Driver profile not found');
    return row;
  }

  // ─── Vehicles ─────────────────────────────────────────────────────────────

  async listVehicleReviews(statusFilter?: string) {
    const where = statusFilter
      ? `AND v.approval_status = '${statusFilter}'`
      : `AND v.approval_status = 'PENDING'`;
    return this.db.query(
      `SELECT v.id, v.tenant_id, v.source_type, v.approval_status, v.platform_verified,
              v.plate, v.year, v.colour, v.notes, v.external_driver_id,
              v.created_at, t.name AS tenant_name,
              u.full_name AS external_driver_name
       FROM tenant_vehicles v
       JOIN tenants t ON t.id = v.tenant_id
       LEFT JOIN users u ON u.id = v.external_driver_id
       WHERE v.source_type = 'EXTERNAL' ${where}
       ORDER BY v.created_at ASC`,
    );
  }

  async approveVehicle(adminUserId: string, vehicleId: string, notes?: string) {
    const [row] = await this.db.query(
      `UPDATE tenant_vehicles
       SET approval_status = 'APPROVED', platform_verified = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [vehicleId],
    );
    if (!row) throw new NotFoundException('Vehicle not found');
    return row;
  }

  async rejectVehicle(adminUserId: string, vehicleId: string, notes?: string) {
    const [row] = await this.db.query(
      `UPDATE tenant_vehicles
       SET approval_status = 'REJECTED', platform_verified = false,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [vehicleId],
    );
    if (!row) throw new NotFoundException('Vehicle not found');
    return row;
  }
}
