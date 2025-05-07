import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

// Detectar si estamos en ambiente de Vercel Preview
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

export default withAuth(
  function middleware(request: NextRequest) {
    console.log(
      'Middleware processing:',
      request.method,
      request.nextUrl.pathname,
      isVercelPreview ? '(Preview Environment)' : ''
    );

    // En ambiente de preview, permitimos todas las rutas para depuración
    if (isVercelPreview) {
      console.log('Preview environment detected - more permissive middleware');
      // Si está intentando acceder a rutas API de autenticación o públicas, permitir
      if (
        request.nextUrl.pathname.startsWith('/api/auth') ||
        publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))
      ) {
        return NextResponse.next();
      }

      // Para otras rutas, continuamos con NextAuth para validar la sesión
      return NextResponse.next();
    }

    // Comportamiento normal para otros ambientes
    const isPublic = publicPaths.some(
      (path) =>
        request.nextUrl.pathname.startsWith(path) ||
        request.nextUrl.pathname === path
    );

    if (isPublic) {
      console.log(
        'Middleware: ruta pública permitida',
        request.nextUrl.pathname
      );
      return NextResponse.next();
    }

    return NextResponse.next(); // continuará con la validación de sesión de NextAuth
  },
  {
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  matcher: [
    '/((?!api/register|api/auth|api/healthcheck|_next/static|_next/image|favicon.ico|auth/signin|register).*)',
  ],
};
