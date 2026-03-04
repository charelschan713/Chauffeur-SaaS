/**
 * Compute badge visibility for external/verified drivers and vehicles.
 * Rule: show Platform Verified badge only if source_type=EXTERNAL + approved + verified.
 */
export interface VerificationBadgeResult {
  show: boolean;
  label: 'Platform Verified';
  variant: 'success';
  icon: 'check';
}

export function getVerificationBadge(asset: {
  source_type?: string;
  approval_status?: string;
  platform_verified?: boolean;
}): VerificationBadgeResult {
  const show =
    asset.source_type === 'EXTERNAL' &&
    asset.approval_status === 'APPROVED' &&
    asset.platform_verified === true;

  return { show, label: 'Platform Verified', variant: 'success', icon: 'check' };
}

/**
 * Compute transfer badge for bookings.
 * Show if booking_source = TRANSFER_IN OR owner_tenant_id != executor_tenant_id.
 */
export interface TransferBadgeResult {
  show: boolean;
  label: string;
  sourceTenantName: string | null;
  variant: 'info';
}

export function getTransferBadge(booking: {
  booking_source?: string;
  owner_tenant_id?: string | null;
  executor_tenant_id?: string | null;
  transfer_source_tenant_name_snapshot?: string | null;
  tenant_id?: string;
}): TransferBadgeResult {
  const isTransfer =
    booking.booking_source === 'TRANSFER_IN' ||
    (booking.owner_tenant_id &&
      booking.executor_tenant_id &&
      booking.owner_tenant_id !== booking.executor_tenant_id);

  return {
    show: !!isTransfer,
    label: '📥 Transferred In',
    sourceTenantName: booking.transfer_source_tenant_name_snapshot ?? null,
    variant: 'info',
  };
}
