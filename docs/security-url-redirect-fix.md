# Corrección de Vulnerabilidad Crítica: Redirección a URLs No Autorizadas

## Problema Identificado

Se identificó una vulnerabilidad crítica de seguridad donde usuarios en producción eran redirigidos a URLs de preview de Vercel en lugar del dominio principal después del login con Google.

### Síntomas

- Usuarios autenticados correctamente con Google
- Después del login, redirección a URLs como: `https://paloparti-9rp0ss196-pablitohs-projects.vercel.app/auth/signin`
- URLs de preview en lugar del dominio principal de producción

### Impacto de Seguridad

- **CRÍTICO**: Usuarios pueden ser redirigidos a dominios no controlados
- Posible interceptación de sesiones
- Phishing potencial a través de dominios similares
- Pérdida de control sobre la experiencia del usuario

## Causa Raíz

El problema estaba en las funciones `getBaseUrl()` que utilizaban automáticamente `VERCEL_URL` sin verificar el ambiente:

```typescript
// PROBLEMÁTICO - Antes
if (process.env.VERCEL_URL) {
  return `https://${process.env.VERCEL_URL}`;
}
```

Esto hacía que en producción se usaran URLs de preview generadas automáticamente.

## Solución Implementada

### 1. Corrección en `pages/api/auth/[...nextauth].ts`

```typescript
function getBaseUrl() {
  // En desarrollo local
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXTAUTH_URL || 'http://localhost:3000';
  }

  // En producción, SIEMPRE usar NEXTAUTH_URL si está definida
  // Esto previene redirecciones a URLs de preview no autorizadas
  if (process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // Solo en preview/desarrollo usar VERCEL_URL como fallback
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback final a NEXTAUTH_URL
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  return 'http://localhost:3000';
}
```

### 2. Corrección en `next.config.js`

```javascript
env: {
  NEXTAUTH_URL:
    process.env.NEXTAUTH_URL ||
    (process.env.NODE_ENV === 'development' && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : undefined),
},
```

### 3. Corrección en `lib/authUtils.ts`

```typescript
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // En producción, SIEMPRE usar NEXTAUTH_URL si está definida
  if (process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // Solo en preview usar VERCEL_URL como fallback
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback a NEXTAUTH_URL o desarrollo local
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}
```

## Configuración Requerida en Vercel

### Variables de Entorno en Producción

**MUY IMPORTANTE**: Asegúrate de que en Vercel → Settings → Environment Variables → Production:

```bash
NEXTAUTH_URL=https://tu-dominio-principal.com
```

### Variables para Preview (Opcional)

```bash
NEXTAUTH_URL=https://preview-domain.vercel.app  # Solo si necesitas un dominio específico
```

## Verificación de la Corrección

Para verificar que la corrección funciona:

1. **Verifica las variables de entorno en Vercel**
2. **Haz un nuevo deployment**
3. **Testea el login de Google en producción**
4. **Confirma que la redirección va al dominio principal**

## Medidas Preventivas

### 1. Validación de Variables de Entorno

Agregar validación en el startup de la aplicación:

```typescript
if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) {
  throw new Error('NEXTAUTH_URL is required in production');
}
```

### 2. Logging de Seguridad

Todas las funciones `getBaseUrl()` ahora incluyen logging para auditoría:

```typescript
console.log('Security check - Base URL:', correctBaseUrl, {
  environment: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL_ENV,
  hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
});
```

### 3. Tests de Seguridad

Crear tests que verifiquen que las URLs generadas son correctas:

```typescript
describe('URL Security', () => {
  it('should never redirect to preview URLs in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXTAUTH_URL = 'https://main-domain.com';
    process.env.VERCEL_URL = 'preview-domain.vercel.app';

    const baseUrl = getBaseUrl();
    expect(baseUrl).toBe('https://main-domain.com');
    expect(baseUrl).not.toContain('vercel.app');
  });
});
```

## Lecciones Aprendidas

1. **Nunca confiar en variables automáticas en producción**
2. **Siempre validar URLs antes de redirigir**
3. **Separar lógica de desarrollo vs producción**
4. **Implementar logging de seguridad**
5. **Tener variables de entorno explícitas para producción**

## Monitoreo Continuo

- Agregar alertas si se detectan redirecciones a dominios no autorizados
- Monitorear logs de NextAuth por patterns sospechosos
- Revisar periódicamente las configuraciones de URLs en Vercel
