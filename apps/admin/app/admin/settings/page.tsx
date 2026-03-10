/**
 * LEGACY REDIRECT — /admin/settings
 * Canonical route: /(tenant)/settings/general → /settings/general
 */
import { redirect } from 'next/navigation';
export default function AdminSettingsLegacy() { redirect('/settings/general'); }
