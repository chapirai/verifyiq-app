import { NextRequest, NextResponse } from 'next/server';

const protectedPaths = ['/dashboard', '/search', '/companies', '/bulk', '/billing', '/api-keys', '/settings'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!needsAuth) return NextResponse.next();

  const session = request.cookies.get('verifyiq_access_token')?.value;
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/search/:path*', '/companies/:path*', '/bulk/:path*', '/billing/:path*', '/api-keys/:path*', '/settings/:path*'],
};
