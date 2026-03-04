import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class NetworkService {
  constructor(private readonly db: DataSource) {}

  // ─── Tenant Connections ────────────────────────────────────────────────────

  /** List connections for a tenant (both directions) */
  async listConnections(tenantId: string) {
    return this.db.query(
      `SELECT tc.*,
              tr.name AS requester_name,
              ta.name AS acceptor_name
       FROM tenant_connections tc
       JOIN tenants tr ON tr.id = tc.requester_id
       JOIN tenants ta ON ta.id = tc.acceptor_id
       WHERE (tc.requester_id = $1 OR tc.acceptor_id = $1)
       ORDER BY tc.created_at DESC`,
      [tenantId],
    );
  }

  /** Tenant requests connection with another tenant (internal) */
  async requestConnection(requesterTenantId: string, acceptorTenantId: string, note?: string) {
    if (requesterTenantId === acceptorTenantId) {
      throw new BadRequestException('Cannot connect to yourself');
    }

    // Check if acceptor exists on platform
    const [acceptor] = await this.db.query(
      `SELECT id, name FROM tenants WHERE id = $1 AND status NOT IN ('archived')`,
      [acceptorTenantId],
    );
    if (!acceptor) throw new NotFoundException('Tenant not found');

    // Check for existing connection
    const existing = await this.db.query(
      `SELECT id, status FROM tenant_connections
       WHERE (requester_id = $1 AND acceptor_id = $2)
          OR (requester_id = $2 AND acceptor_id = $1)`,
      [requesterTenantId, acceptorTenantId],
    );
    if (existing.length) {
      const conn = existing[0];
      if (conn.status === 'active') throw new BadRequestException('Already connected');
      if (conn.status === 'pending') throw new BadRequestException('Connection request already pending');
      if (conn.status === 'rejected') {
        // Allow re-request after rejection
        await this.db.query(
          `UPDATE tenant_connections SET status = 'pending', requester_note = $3,
           requested_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [conn.id, note ?? null],
        );
        return { id: conn.id, status: 'pending', message: 'Connection re-requested' };
      }
    }

    const [row] = await this.db.query(
      `INSERT INTO tenant_connections
         (requester_id, acceptor_id, connection_type, status, requester_note)
       VALUES ($1, $2, 'internal', 'pending', $3)
       RETURNING *`,
      [requesterTenantId, acceptorTenantId, note ?? null],
    );
    return row;
  }

  /** Accept a connection request (acceptor tenant) */
  async acceptConnection(tenantId: string, connectionId: string, note?: string) {
    const [conn] = await this.db.query(
      `SELECT * FROM tenant_connections WHERE id = $1`,
      [connectionId],
    );
    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.acceptor_id !== tenantId) throw new ForbiddenException('Not authorized');
    if (conn.status !== 'pending') throw new BadRequestException(`Cannot accept connection in status: ${conn.status}`);

    // External connections need platform approval before becoming active
    const newStatus = conn.connection_type === 'external' ? 'pending' : 'active';
    const platformApproved = conn.connection_type === 'internal';

    const [updated] = await this.db.query(
      `UPDATE tenant_connections
       SET status = $2, platform_approved = $3, acceptor_note = $4,
           accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [connectionId, newStatus, platformApproved, note ?? null],
    );
    return {
      ...updated,
      message: conn.connection_type === 'external'
        ? 'Accepted. Awaiting platform approval before activation.'
        : 'Connection is now active.',
    };
  }

  /** Reject a connection */
  async rejectConnection(tenantId: string, connectionId: string, note?: string) {
    const [conn] = await this.db.query(
      `SELECT * FROM tenant_connections WHERE id = $1`,
      [connectionId],
    );
    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.acceptor_id !== tenantId && conn.requester_id !== tenantId) {
      throw new ForbiddenException('Not authorized');
    }

    const [updated] = await this.db.query(
      `UPDATE tenant_connections
       SET status = 'rejected', acceptor_note = $2,
           rejected_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [connectionId, note ?? null],
    );
    return updated;
  }

  /** Suspend/disconnect an active connection */
  async suspendConnection(tenantId: string, connectionId: string) {
    const [conn] = await this.db.query(
      `SELECT * FROM tenant_connections WHERE id = $1`,
      [connectionId],
    );
    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.acceptor_id !== tenantId && conn.requester_id !== tenantId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.db.query(
      `UPDATE tenant_connections SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [connectionId],
    );
    return { success: true };
  }

  // ─── Platform Admin: Manage External Connections ──────────────────────────

  async platformListPendingConnections() {
    return this.db.query(
      `SELECT tc.*,
              tr.name AS requester_name,
              ta.name AS acceptor_name
       FROM tenant_connections tc
       JOIN tenants tr ON tr.id = tc.requester_id
       JOIN tenants ta ON ta.id = tc.acceptor_id
       WHERE tc.connection_type = 'external' AND tc.platform_approved = false
         AND tc.status = 'pending'
       ORDER BY tc.created_at ASC`,
    );
  }

  async platformApproveConnection(adminUserId: string, connectionId: string, notes?: string) {
    const [updated] = await this.db.query(
      `UPDATE tenant_connections
       SET platform_approved = true, status = 'active',
           platform_reviewed_at = NOW(), platform_reviewed_by = $2, platform_notes = $3,
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [connectionId, adminUserId, notes ?? null],
    );
    if (!updated) throw new NotFoundException('Connection not found or already processed');
    return updated;
  }

  async platformRejectConnection(adminUserId: string, connectionId: string, notes?: string) {
    const [updated] = await this.db.query(
      `UPDATE tenant_connections
       SET status = 'rejected', platform_approved = false,
           platform_reviewed_at = NOW(), platform_reviewed_by = $2, platform_notes = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [connectionId, adminUserId, notes ?? null],
    );
    if (!updated) throw new NotFoundException('Connection not found');
    return updated;
  }

  // ─── Driver External Approval ──────────────────────────────────────────────

  /** Driver applies to receive external orders */
  async applyExternalApproval(userId: string, reason?: string) {
    const existing = await this.db.query(
      `SELECT id, status FROM driver_external_approvals WHERE user_id = $1`,
      [userId],
    );
    if (existing.length) {
      const ea = existing[0];
      if (ea.status === 'approved') throw new BadRequestException('Already approved for external orders');
      if (ea.status === 'pending') throw new BadRequestException('Application already pending review');
      // Re-apply after rejection/suspension
      await this.db.query(
        `UPDATE driver_external_approvals
         SET status = 'pending', apply_reason = $2, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, reason ?? null],
      );
      return { status: 'pending', message: 'Re-application submitted for review' };
    }

    const [row] = await this.db.query(
      `INSERT INTO driver_external_approvals (user_id, status, apply_reason)
       VALUES ($1, 'pending', $2)
       RETURNING *`,
      [userId, reason ?? null],
    );
    return row;
  }

  /** Driver gets their external approval status */
  async getExternalApprovalStatus(userId: string) {
    const [row] = await this.db.query(
      `SELECT * FROM driver_external_approvals WHERE user_id = $1`,
      [userId],
    );
    return row ?? { status: 'not_applied' };
  }

  /** Platform admin: list pending driver external approvals */
  async platformListDriverApprovals(statusFilter?: string) {
    const where = statusFilter ? `AND dea.status = '${statusFilter}'` : '';
    return this.db.query(
      `SELECT dea.*, u.full_name, u.email, m.tenant_id,
              t.name AS tenant_name
       FROM driver_external_approvals dea
       JOIN users u ON u.id = dea.user_id
       LEFT JOIN memberships m ON m.user_id = dea.user_id AND m.role = 'driver' AND m.status = 'active'
       LEFT JOIN tenants t ON t.id = m.tenant_id
       WHERE 1=1 ${where}
       ORDER BY dea.created_at ASC`,
    );
  }

  async platformApproveDriverExternal(adminUserId: string, driverId: string, notes?: string) {
    const [updated] = await this.db.query(
      `UPDATE driver_external_approvals
       SET status = 'approved', platform_notes = $3,
           reviewed_at = NOW(), reviewed_by = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [driverId, adminUserId, notes ?? null],
    );
    if (!updated) throw new NotFoundException('Application not found');
    return updated;
  }

  async platformRejectDriverExternal(adminUserId: string, driverId: string, notes?: string) {
    const [updated] = await this.db.query(
      `UPDATE driver_external_approvals
       SET status = 'rejected', platform_notes = $3,
           reviewed_at = NOW(), reviewed_by = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [driverId, adminUserId, notes ?? null],
    );
    if (!updated) throw new NotFoundException('Application not found');
    return updated;
  }

  /** Check if two tenants are connected (for booking transfer validation) */
  async areTenantsConnected(tenantA: string, tenantB: string): Promise<boolean> {
    const [row] = await this.db.query(
      `SELECT id FROM tenant_connections
       WHERE status = 'active' AND platform_approved = true
         AND ((requester_id = $1 AND acceptor_id = $2)
           OR (requester_id = $2 AND acceptor_id = $1))`,
      [tenantA, tenantB],
    );
    return !!row;
  }
}
