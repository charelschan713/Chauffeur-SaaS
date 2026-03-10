/**
 * LEGACY REDIRECT — /admin/settings/templates
 * Canonical route: /(tenant)/settings/templates → /settings/templates
 */
import { redirect } from 'next/navigation';
export default function AdminSettingsTemplatesLegacy() { redirect('/settings/templates'); }
