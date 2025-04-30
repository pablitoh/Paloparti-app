import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function runs before any authentication checks
export function middleware(request: NextRequest) {
  // Specifically exclude the register endpoint to ensure it's accessible without authentication
  if (request.nextUrl.pathname === '/api/auth/register') {
    return NextResponse.next();
  }

  // Allow all other routes by default
  return NextResponse.next();
}

// Configure which routes require authentication
export const config = {
  matcher: [
    '/api/groups/:path*',
    '/api/groups/:id*/invite',
    '/api/groups/:id*/leave',
    '/api/groups/:id*/members',
    '/api/groups/:id*/member-role',
    '/api/groups/:id*/reset-attendance',
    '/api/matches/:path*',
    '/api/match/:path*',
    '/api/profile/:path*',
    '/groups/:path*',
    '/group/:path*',
    '/matches/:path*',
    '/match/:path*',
    '/profile/:path*',
  ],
};

// Apply authentication middleware
export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
});
