/**
 * LEGACY REDIRECT — /admin/drivers
 * Canonical route: /(tenant)/drivers → /drivers
 */
import { redirect } from 'next/navigation';
export default function AdminDriversLegacy() { redirect('/drivers'); }
