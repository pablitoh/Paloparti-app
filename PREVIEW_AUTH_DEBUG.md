# Guía de Diagnóstico de Autenticación en Preview

## Problema

En el ambiente de preview de Vercel, cuando intento acceder al perfil del usuario aparece como "unauthenticated".

## Soluciones Implementadas

### 1. Configuración de NextAuth Mejorada

- ✅ Habilitado debug logging para preview
- ✅ Configurado cookies correctamente para HTTPS
- ✅ Agregado logger específico para preview
- ✅ Mejorado callback de redirect

### 2. Endpoint de Debug Creado

Usa `/api/debug-preview-auth` en el ambiente de preview para diagnosticar:

```bash
curl https://tu-preview-url.vercel.app/api/debug-preview-auth
```

### 3. Variables de Entorno Requeridas en Vercel

Ve a tu proyecto en Vercel Dashboard → Settings → Environment Variables y asegúrate de tener:

```bash
# Variables requeridas para Preview
NEXTAUTH_SECRET=tu-clave-secreta-segura
NEXTAUTH_URL=https://tu-preview-url.vercel.app  # (Opcional, se auto-detecta)
DATABASE_URL=tu-url-de-base-de-datos
```

## Pasos de Diagnóstico

### Paso 1: Verificar Variables de Entorno

1. En el dashboard de Vercel, verifica que `NEXTAUTH_SECRET` esté configurada para **Preview**
2. Verifica que `DATABASE_URL` apunte a una base de datos accesible

### Paso 2: Usar el Endpoint de Debug

1. Ve a `https://tu-preview-url.vercel.app/api/debug-preview-auth`
2. Revisa el JSON de respuesta
3. Verifica las "recommendations" al final

### Paso 3: Revisar Logs de Vercel

1. Ve a Vercel Dashboard → Functions → View Function Logs
2. Busca logs que comiencen con "NextAuth" o "Preview Auth Debug"
3. Busca errores relacionados con cookies o tokens

### Paso 4: Probar la Autenticación

1. Cierra todas las pestañas del navegador
2. Ve a la URL de preview
3. Inicia sesión nuevamente
4. Intenta acceder al perfil

## Posibles Causas y Soluciones

### 1. NEXTAUTH_SECRET No Configurada

**Síntoma**: Error "NEXTAUTH_SECRET missing"
**Solución**: Configurar en Vercel Environment Variables

### 2. Cookies No Persistentes

**Síntoma**: Token presente pero sesión no funciona
**Solución**: Verificar que las cookies están marcadas como `secure: true` para HTTPS

### 3. URL Base Incorrecta

**Síntoma**: Redirects no funcionan correctamente
**Solución**: La configuración auto-detecta `VERCEL_URL`

### 4. Base de Datos No Accesible

**Síntoma**: Usuario no encontrado en `/api/profile`
**Solución**: Verificar `DATABASE_URL` y conectividad

## Configuración Específica para Preview

La configuración está optimizada para preview con:

```typescript
// En [...nextauth].ts
useSecureCookies: process.env.VERCEL_ENV === 'preview',
debug: process.env.VERCEL_ENV === 'preview',
```

## Comandos Útiles

### Verificar Deployment

```bash
vercel logs tu-deployment-url
```

### Limpiar Cache del Navegador

```bash
# Chrome DevTools
Application → Storage → Clear site data
```

### Verificar Conectividad a BD

```bash
# En Vercel Functions logs, buscar errores de Prisma
```

## Notas Importantes

1. **El ambiente de preview usa HTTPS**: Las cookies deben ser seguras
2. **URL dinámica**: Cada push genera una nueva URL de preview
3. **Variables de entorno**: Deben estar configuradas específicamente para Preview
4. **Cache del navegador**: Puede causar problemas, limpiar si es necesario

## Solución Rápida

Si el problema persiste:

1. **Borra todas las variables de entorno de Preview en Vercel**
2. **Vuelve a configurar solo estas**:
   ```
   NEXTAUTH_SECRET=nueva-clave-secreta-larga-y-segura
   DATABASE_URL=tu-url-de-bd
   ```
3. **Redeploy el branch**
4. **Limpia cache del navegador**
5. **Inicia sesión de nuevo**
