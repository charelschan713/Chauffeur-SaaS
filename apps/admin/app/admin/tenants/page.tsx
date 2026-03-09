/**
 * LEGACY REDIRECT — /admin/tenants
 *
 * Superseded by /(platform)/tenants which has isPlatformAdmin guard.
 */
import { redirect } from 'next/navigation';

export default function AdminTenantsLegacyPage() {
  redirect('/tenants');
}
