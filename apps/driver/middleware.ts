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
    const excluded = ['www', 'app', 'platform', 'api', 'chauffeur-customer-portal'];
    if (parts.length >= 3 && !excluded.includes(parts[0])) {
      slug = parts[0];
    }
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

  // No slug — redirect to error page
  if (url.pathname === '/no-tenant') return NextResponse.next();
  url.pathname = '/no-tenant';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
