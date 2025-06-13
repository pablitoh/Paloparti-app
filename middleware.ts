import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Lista ampliada de rutas públicas
const publicPaths = [
  '/api/auth',
  '/api/register',
  '/api/healthcheck',
  '/_next/',
  '/static/',
  '/favicon',
  '/auth/',
  '/register',
  '/login',
  '/s/', // Short URLs
  '/invite/', // Enlaces de invitación
  '/', // Página principal
];

// Detectar si estamos en ambiente de Vercel Preview
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

// Contador para evitar loops de middleware
let requestCounts: Record<string, { count: number; timestamp: number }> = {};

// Función para verificar si una ruta es pública
function isPublicPath(path: string): boolean {
  return publicPaths.some(
    (prefix) => path.startsWith(prefix) || path === prefix
  );
}

// Middleware personalizado simplificado
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Registrar cada solicitud para detección de loops
  const referrer = request.headers.get('referer') || '';
  const requestKey = `${path}-${referrer.slice(0, 30)}`;
  const now = Date.now();

  // Limpiar registros antiguos (más de 10 segundos)
  for (const key in requestCounts) {
    if (now - requestCounts[key].timestamp > 10000) {
      delete requestCounts[key];
    }
  }

  // Incrementar contador
  if (!requestCounts[requestKey]) {
    requestCounts[requestKey] = { count: 1, timestamp: now };
  } else {
    requestCounts[requestKey].count++;
    requestCounts[requestKey].timestamp = now;
  }

  // Detección de posible loop
  if (requestCounts[requestKey].count > 5) {
    console.warn('⚠️ Posible loop de middleware detectado para:', path);
    return NextResponse.next();
  }

  // 2. Logging
  console.log(`Middleware: ${request.method} ${path}`);

  // 3. Permitir todas las rutas públicas sin verificación
  if (isPublicPath(path)) {
    console.log('Middleware: ruta pública permitida');
    return NextResponse.next();
  }

  // 4. Para rutas protegidas, verificar token JWT
  const token = await getToken({ req: request });

  // Debug logging específico para preview
  if (isVercelPreview) {
    console.log('Middleware Preview Debug:', {
      path,
      hasToken: !!token,
      tokenSub: token?.sub,
      tokenEmail: token?.email,
      cookies: request.cookies.getAll().map((c) => c.name),
      sessionCookie: request.cookies.get('next-auth.session-token')?.value
        ? 'Present'
        : 'Missing',
      vercelUrl: process.env.VERCEL_URL,
    });
  }

  // Si no hay token, redirigir a la página de inicio de sesión SIN callbackUrl
  if (!token) {
    console.log('Middleware: no autenticado, redirigiendo a login');
    const url = new URL('/auth/signin', request.url);
    return NextResponse.redirect(url);
  }

  // Usuario autenticado, permitir acceso
  return NextResponse.next();
}

/**
 * Configuración del matcher para el middleware
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/healthcheck).*)'],
};
