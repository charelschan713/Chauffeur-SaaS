/**
 * /admin index — redirects to canonical tenant admin home.
 * Platform admins are routed to /overview by the login page.
 */
import { redirect } from 'next/navigation';
export default function AdminIndexPage() { redirect('/dashboard'); }
