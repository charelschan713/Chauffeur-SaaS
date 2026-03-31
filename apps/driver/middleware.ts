import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Local dev: ?tenant=slug
  let slug = url.searchParams.get('tenant');

  // Production: aschauffeured.chauffeurssolution.com → aschauffeured
  if (!slug) {
    const parts = hostname.split('.');
    // Need at least 3 parts (sub.domain.tld)
    // Exclude known non-tenant subdomains
    const excluded = ['www', 'app', 'platform', 'api', 'chauffeur-driver-portal'];
    if (parts.length >= 3 && !excluded.includes(parts[0])) {
      slug = parts[0];
    }
  }

  // Allow driver.chauffeurssolution.com to map to default tenant
  if (!slug && hostname.startsWith('driver.chauffeurssolution.com')) {
    slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG || 'aschauffeured';
  }

  // Already have slug in cookie — keep it
  const existingSlug = request.cookies.get('tenant_slug')?.value;
  if (!slug && existingSlug) {
    return NextResponse.next();
  }

  if (slug) {
    if (url.pathname === '/no-tenant') return NextResponse.next();
    const response = NextResponse.next();
    response.cookies.set('tenant_slug', slug, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return response;
  }

  // No slug — allow auth entry pages so tenant can be typed manually.
  const allowWithoutSlug = ['/login', '/forgot-password', '/reset-password', '/no-tenant'];
  if (allowWithoutSlug.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  url.pathname = '/no-tenant';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
