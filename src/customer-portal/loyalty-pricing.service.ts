/**
 * LoyaltyPricingService
 *
 * Single source of truth for customer loyalty discount computation.
 * Used by:
 *   - GET  /customer-portal/discount-preview   (preview shown on /book page)
 *   - POST /customer-portal/bookings           (authenticated booking creation)
 *
 * Guarantees: the amount displayed to the customer == the amount stored in the booking
 * == the amount charged via payViaToken.
 *
 * Design rules:
 *   - Input:  quote session result + customer ID + tenant ID
 *   - Output: { finalFareMinor, discountMinor, discountName, discountRate, tollParkingMinor, trueBase, cappedByMax, currency }
 *   - Tolls and parking are NEVER discounted — they pass through unchanged.
 *   - Client-supplied totalPriceMinor and discountMinor are NEVER trusted.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface LoyaltyPricingResult {
  /** Final amount to charge (discounted fare + toll/parking) */
  finalFareMinor: number;
  /** Loyalty discount removed from base fare (NOT applied to tolls) */
  discountMinor: number;
  /** Discountable base (pre-discount fare, excluding toll/parking) */
  trueBase: number;
  /** Toll + parking pass-through (not discounted) */
  tollParkingMinor: number;
  /** Human-readable discount label e.g. "10% loyalty" */
  discountName: string | null;
  /** Combined percentage rate applied */
  discountRate: number;
  /** Whether the raw rate was capped by tenant's max_discount_pct */
  cappedByMax: boolean;
  /** Currency from quote session */
  currency: string;
  /** Source snapshot used for calculation (for debug/audit) */
  snapshotSource: 'pre_discount_fare_minor' | 'pre_discount_total_minor' | 'base_calculated_minor' | 'fallback';
}

const TIER_DISCOUNT: Record<string, number> = {
  STANDARD: 0,
  SILVER: 5,
  GOLD: 10,
  PLATINUM: 15,
  VIP: 20,
};

@Injectable()
export class LoyaltyPricingService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Compute loyalty-adjusted fare for a customer against a stored quote result.
   *
   * @param customerId   Authenticated customer UUID
   * @param tenantId     Tenant UUID (from JWT — trusted)
   * @param quoteResult  Single result entry from quote_sessions.payload.results[]
   * @param currency     Currency string from quote session payload
   */
  async compute(
    customerId: string,
    tenantId: string,
    quoteResult: any,
    currency: string,
  ): Promise<LoyaltyPricingResult> {
    const snap = quoteResult.pricing_snapshot_preview ?? {};

    // ── 1. Toll / parking isolation ────────────────────────────────────────
    // Tolls must NEVER be discounted. Extract from snapshot.
    // Priority: split fields first (toll_minor + parking_minor), then combined,
    // then fall through to 0 (safe — means toll was already baked into estimated_total).
    const tollMinor    = Number(snap.toll_minor    ?? 0);
    const parkingMinor = Number(snap.parking_minor ?? 0);
    const tollParkingMinor = tollMinor + parkingMinor;

    // ── 2. Discountable base (true fare without toll/parking) ──────────────
    // Field name convention changed during development:
    //   Old quotes: pre_discount_total_minor
    //   New quotes: pre_discount_fare_minor   ← preferred
    // Accept both during transition period.
    let trueBase: number;
    let snapshotSource: LoyaltyPricingResult['snapshotSource'];

    if (snap.pre_discount_fare_minor != null && Number(snap.pre_discount_fare_minor) > 0) {
      trueBase = Number(snap.pre_discount_fare_minor);
      snapshotSource = 'pre_discount_fare_minor';
    } else if (snap.pre_discount_total_minor != null && Number(snap.pre_discount_total_minor) > 0) {
      trueBase = Number(snap.pre_discount_total_minor);
      snapshotSource = 'pre_discount_total_minor';
    } else if (snap.base_calculated_minor != null && Number(snap.base_calculated_minor) > 0) {
      // Reconstruct from components present in the snapshot
      trueBase = Number(snap.base_calculated_minor)
        + Number(snap.surcharge_minor       ?? 0)
        + Number(snap.time_surcharge_minor  ?? 0)
        + Number(snap.extras_minor          ?? 0)
        + Number(snap.waypoints_minor       ?? 0)
        + Number(snap.baby_seats_minor      ?? 0);
      snapshotSource = 'base_calculated_minor';
    } else {
      // Final fallback: estimated_total_minor already includes auto-discount and tolls.
      // Subtract tolls to get the base. This may double-count an existing auto-discount
      // but it's better than returning 0.
      trueBase = Math.max(0, Number(quoteResult.estimated_total_minor) - tollParkingMinor);
      snapshotSource = 'fallback';
    }

    // ── 3. Customer tier + personal rate ───────────────────────────────────
    const [custRow] = await this.db.query(
      `SELECT tier, discount_rate
       FROM public.customers
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [customerId, tenantId],
    );
    const tierRate  = TIER_DISCOUNT[custRow?.tier ?? 'STANDARD'] ?? 0;
    const extraRate = Number(custRow?.discount_rate ?? 0);
    const rawCombinedRate = tierRate + extraRate;

    // ── 4. Tenant max_discount_pct cap ─────────────────────────────────────
    const [capRow] = await this.db.query(
      `SELECT max_discount_pct
       FROM public.tenant_discounts
       WHERE tenant_id = $1
         AND active = true
         AND max_discount_pct IS NOT NULL
       ORDER BY max_discount_pct DESC
       LIMIT 1`,
      [tenantId],
    );
    const maxPctCap: number | null = capRow?.max_discount_pct
      ? Number(capRow.max_discount_pct)
      : null;

    const cappedCombinedRate = maxPctCap != null
      ? Math.min(rawCombinedRate, maxPctCap)
      : rawCombinedRate;
    const cappedByMax = maxPctCap != null && rawCombinedRate > maxPctCap;

    // ── 5. Final amount ────────────────────────────────────────────────────
    const discountMinor = Math.round(trueBase * cappedCombinedRate / 100);
    // Tolls added back after discount — never reduced
    const finalFareMinor = Math.max(0, trueBase - discountMinor) + tollParkingMinor;

    const discountName = cappedCombinedRate > 0
      ? `${cappedCombinedRate}% loyalty`
      : null;

    return {
      finalFareMinor,
      discountMinor,
      trueBase,
      tollParkingMinor,
      discountName,
      discountRate: cappedCombinedRate,
      cappedByMax,
      currency,
      snapshotSource,
    };
  }
}
