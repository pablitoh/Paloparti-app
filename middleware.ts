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

// Configurar las rutas que requieren autenticación
export const config = {
  matcher: [
    '/groups/:path*',
    '/matches/:path*',
    '/profile/:path*',
    '/api/groups/:path*',
    '/api/matches/:path*',
    '/api/profile/:path*',
  ],
};

// Aplicar middleware de autenticación
export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
});
