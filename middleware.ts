import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Rutas públicas que no requieren autenticación
const publicRoutes = [
  '/api/auth/register',
  '/api/test-auth',
  '/api/debug',
  '/api/invitations/',
  '/api/url-shortener',
  '/api/s/',
];

// Temporarily disable middleware to debug 404 issues
export const config = {
  matcher: [], // Empty matcher = no routes will use this middleware
};

// Export a simple middleware that does nothing but allow all requests
export default function middleware() {
  return NextResponse.next();
}

/*
// Original auth middleware
export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
});
*/
