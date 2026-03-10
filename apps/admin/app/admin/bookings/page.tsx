/**
 * LEGACY REDIRECT — /admin/bookings
 * Canonical route: /(tenant)/bookings → /bookings
 */
import { redirect } from 'next/navigation';
export default function AdminBookingsLegacy() { redirect('/bookings'); }
