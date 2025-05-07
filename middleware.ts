import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/api/auth',
  '/api/register',
  '/api/healthcheck',
  '/_next/static',
  '/_next/image',
  '/_next/data',
  '/favicon.ico',
  '/auth/signin',
  '/register',
];

export default withAuth(
  function middleware(request: NextRequest) {
    console.log(
      'Middleware processing:',
      request.method,
      request.nextUrl.pathname
    );

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
    '/((?!api/register|api/auth|api/healthcheck|_next/static|_next/image|_next/data|favicon.ico|auth/signin|register).*)',
  ],
};
