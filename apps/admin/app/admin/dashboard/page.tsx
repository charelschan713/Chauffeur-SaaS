/**
 * LEGACY REDIRECT — /admin/dashboard
 *
 * This route has been superseded by /(platform)/overview which has proper
 * isPlatformAdmin JWT guard enforcement.
 *
 * /admin/* uses AdminLayout (no platform guard) — any tenant admin could
 * access platform metrics. The active platform admin path is /overview.
 */
import { redirect } from 'next/navigation';

export default function AdminDashboardLegacyPage() {
  redirect('/overview');
}
