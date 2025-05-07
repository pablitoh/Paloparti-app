import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define una función más simple que solo verifica rutas específicas
// en lugar de bloquear todo por defecto
export function middleware(request: NextRequest) {
  // Rutas públicas que no requieren autenticación
  const publicPaths = [
    '/api/auth',
    '/api/register',
    '/api/healthcheck',
    '/_next/static',
    '/_next/image',
    '/favicon.ico',
    '/auth/signin',
    '/register',
  ];

  // Verificar si es una ruta pública
  const isPublicPath = publicPaths.some(
    (path) =>
      request.nextUrl.pathname.startsWith(path) ||
      request.nextUrl.pathname === path
  );

  if (isPublicPath) {
    console.log(
      'Middleware: permitiendo acceso a ruta pública:',
      request.nextUrl.pathname
    );
    return NextResponse.next();
  }

  // Para todas las demás rutas, permitimos el acceso por defecto
  // y dejamos que NextAuth se encargue de verificar la autenticación
  return NextResponse.next();
}

// Configurar las rutas que requieren autenticación
export const config = {
  matcher: [
    // Rutas protegidas que requieren autenticación
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
