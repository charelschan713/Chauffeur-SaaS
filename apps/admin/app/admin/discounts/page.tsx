/**
 * LEGACY REDIRECT — /admin/discounts
 * Canonical route: /(tenant)/discounts → /discounts
 */
import { redirect } from 'next/navigation';
export default function AdminDiscountsLegacy() { redirect('/discounts'); }
