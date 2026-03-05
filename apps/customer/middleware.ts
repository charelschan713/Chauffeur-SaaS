import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Local dev: ?tenant=slug
  let slug = url.searchParams.get('tenant');

  // Production: extract from subdomain
  // aschauffeured.book.chauffeur-solutions.com → aschauffeured
  // aschauffeured.chauffeur-customer-portal.vercel.app → aschauffeured
  if (!slug) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const candidate = parts[0];
      // Exclude known non-tenant prefixes
      if (!['www', 'chauffeur-customer-portal'].includes(candidate)) {
        slug = candidate;
      }
    }
  }

  // Already have slug in cookie — keep it
  const existingSlug = request.cookies.get('tenant_slug')?.value;
  if (!slug && existingSlug) {
    return NextResponse.next();
  }

  if (slug) {
    // Skip /no-tenant to avoid redirect loop
    if (url.pathname === '/no-tenant') return NextResponse.next();

    const response = NextResponse.next();
    response.cookies.set('tenant_slug', slug, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    });
    return response;
  }

  // No slug found — redirect to error page
  if (url.pathname === '/no-tenant') return NextResponse.next();
  url.pathname = '/no-tenant';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
