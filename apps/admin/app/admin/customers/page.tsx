/**
 * LEGACY REDIRECT — /admin/customers
 * Canonical route: /(tenant)/customers → /customers
 */
import { redirect } from 'next/navigation';
export default function AdminCustomersLegacy() { redirect('/customers'); }
