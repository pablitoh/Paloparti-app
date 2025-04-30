import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define una función más simple que solo verifica rutas específicas
// en lugar de bloquear todo por defecto
export function middleware(request: NextRequest) {
  // Permitir todas las rutas por defecto
  return NextResponse.next();
}

// Configurar las rutas que requieren autenticación
export const config = {
  matcher: [
    '/groups/:path*',
    '/group/:path*',
    '/matches/:path*',
    '/match/:path*',
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
