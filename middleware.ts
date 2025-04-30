import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Esta función se ejecuta antes de cualquier verificación de autenticación
export function middleware(request: NextRequest) {
  // Gestión especial para los endpoints de registro
  if (
    request.nextUrl.pathname === '/api/auth/register' ||
    request.nextUrl.pathname === '/api/auth/register/index' ||
    request.nextUrl.pathname === '/api/auth/register/'
  ) {
    // Para solicitudes OPTIONS (preflight), respondemos inmediatamente con OK
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          'Access-Control-Allow-Headers':
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
        },
      });
    }

    // Para otras solicitudes al endpoint de registro, permitimos el paso sin restricciones
    return NextResponse.next();
  }

  // Permitir todas las demás rutas por defecto
  return NextResponse.next();
}

// Configurar qué rutas requieren autenticación
// Importante: excluir explícitamente todos los endpoints de registro del matcher
export const config = {
  matcher: [
    '/((?!api/auth/register)api/groups)/:path*',
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
