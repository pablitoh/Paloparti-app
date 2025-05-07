/**
 * Utilidades para la autenticación y manejo de redirecciones
 */

/**
 * Limpia parámetros de Vercel toolbar y otros parámetros que pueden causar problemas
 */
export function cleanCallbackUrl(url: string): string {
  try {
    // Si la URL no tiene protocolo, agregamos uno temporal para parsear
    const urlToClean = url.startsWith('http')
      ? url
      : `https://example.com${url}`;
    const urlObj = new URL(urlToClean);

    // Eliminar parámetros problemáticos
    const paramsToRemove = ['__vercel_', 'callbackUrl=', 'error=', 'callback='];

    [...urlObj.searchParams.keys()].forEach((key) => {
      if (paramsToRemove.some((param) => key.startsWith(param))) {
        urlObj.searchParams.delete(key);
      }
    });

    // Devolver solo pathname y search si no tenía protocolo original
    if (!url.startsWith('http')) {
      return urlObj.pathname + (urlObj.search !== '?' ? urlObj.search : '');
    }

    return urlObj.toString();
  } catch (e) {
    // Si hay error de parseo, devolvemos la URL original o /groups como fallback
    return url || '/groups';
  }
}

/**
 * Obtiene un callbackUrl seguro
 * - Limpia parámetros problemáticos
 * - Previene redirecciones a páginas de autenticación (que causan loops)
 * - Maneja errores y provee un valor por defecto
 */
export function getSafeCallbackUrl(
  url?: string,
  defaultUrl = '/groups'
): string {
  if (!url) return defaultUrl;

  try {
    // Limpiar parámetros problemáticos
    const cleaned = cleanCallbackUrl(url);

    // Prevenir redirecciones a páginas de auth (evitar loops)
    const authPaths = ['/auth/', '/login', '/register', '/signin'];
    if (authPaths.some((path) => cleaned.includes(path))) {
      return defaultUrl;
    }

    return cleaned;
  } catch (e) {
    return defaultUrl;
  }
}

/**
 * Limpia completamente el estado de autenticación
 * Útil para resolver problemas de sesión
 */
export function clearAuthState(): void {
  try {
    // Limpiar localStorage
    const keysToRemove = [
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      'next-auth.state',
    ];

    // Limpiar de localStorage y sessionStorage
    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        // Ignorar errores
      }
    });

    // Limpiar cookies
    keysToRemove.forEach((key) => {
      document.cookie = `${key}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    });

    console.log('Estado de autenticación limpiado correctamente');
  } catch (e) {
    console.error('Error al limpiar estado de autenticación:', e);
  }
}

/**
 * Detecta si estamos en un ambiente de preview
 */
export function isVercelPreview(): boolean {
  return process.env.VERCEL_ENV === 'preview';
}

/**
 * Obtiene la URL base para la aplicación
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
}
