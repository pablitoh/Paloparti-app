import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define una función más simple que solo verifica rutas específicas
// en lugar de bloquear todo por defecto
export function middleware(request: NextRequest) {
  // Specifically exclude the register endpoint
  if (request.nextUrl.pathname === '/api/auth/register') {
    return NextResponse.next();
  }

  // Permitir todas las rutas por defecto
  return NextResponse.next();
}

// Configurar las rutas que requieren autenticación
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

// Aplicar middleware de autenticación
export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
});
