/**
 * LEGACY REDIRECT — /admin/vehicles
 * Canonical route: /(tenant)/vehicles → /vehicles
 */
import { redirect } from 'next/navigation';
export default function AdminVehiclesLegacy() { redirect('/vehicles'); }
