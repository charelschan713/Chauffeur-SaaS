/**
 * LEGACY REDIRECT — /admin/dispatch
 * Canonical route: /(tenant)/dispatch → /dispatch
 */
import { redirect } from 'next/navigation';
export default function AdminDispatchLegacy() { redirect('/dispatch'); }
