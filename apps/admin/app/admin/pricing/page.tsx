/**
 * LEGACY REDIRECT — /admin/pricing
 * Canonical route: /(tenant)/pricing/service-types → /pricing/service-types
 */
import { redirect } from 'next/navigation';
export default function AdminPricingLegacy() { redirect('/pricing/service-types'); }
