import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define una función más simple que solo verifica rutas específicas
// en lugar de bloquear todo por defecto
export function middleware(request: NextRequest) {
  // Permitir todas las rutas por defecto
  return NextResponse.next();
}

// Configurar las rutas que requieren el middleware
// Temporalmente lo desactivamos para todas las rutas
export const config = {
  matcher: [],
};
