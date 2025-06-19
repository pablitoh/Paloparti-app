# Configuración de Google OAuth con People API

## Objetivo

Configurar Google OAuth para obtener no solo email/nombre, sino también **fecha de nacimiento** del usuario usando People API.

## 🔧 Pasos en Google Cloud Console

### 1. Crear/Seleccionar Proyecto

1. Ve a https://console.cloud.google.com/
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el ID del proyecto

### 2. Habilitar APIs Necesarias

#### Google Identity API (Obligatoria)

1. Ve a **"Biblioteca de APIs"**
2. Busca **"Google Identity API"**
3. Haz clic en **"Habilitar"**

#### People API (Nueva - Para fecha de nacimiento)

1. Ve a **"Biblioteca de APIs"**
2. Busca **"People API"**
3. Haz clic en **"Habilitar"**
4. **⚠️ IMPORTANTE**: Esta API permite acceso a información personal como fecha de nacimiento

### 3. Configurar Pantalla de Consentimiento OAuth

1. Ve a **"Pantalla de consentimiento OAuth"**
2. Selecciona **"Externo"** (para usuarios fuera de tu organización)
3. Completa información básica:

   - **Nombre de la aplicación**: "Paloparti"
   - **Email de soporte**: tu email
   - **Dominio autorizado**: tu dominio (ej: `paloparti.com`)
   - **Email de contacto del desarrollador**: tu email

4. **Scopes (Permisos)**:

   - En la sección "Permisos", agrega los siguientes scopes:

   ```
   email
   profile
   openid
   https://www.googleapis.com/auth/user.birthday.read
   https://www.googleapis.com/auth/user.gender.read
   ```

5. **Usuarios de prueba** (mientras esté en modo desarrollo):
   - Agrega emails de usuarios que pueden probar la aplicación
   - ⚠️ Solo estos usuarios podrán usar Google Sign-In hasta que publiques la app

### 4. Crear Credenciales OAuth 2.0

1. Ve a **"Credenciales"**
2. Haz clic en **"Crear credenciales"** → **"ID de cliente OAuth 2.0"**
3. Tipo de aplicación: **"Aplicación web"**
4. Nombre: "Paloparti Web App"

#### Orígenes autorizados de JavaScript:

```
http://localhost:3000
http://localhost:3001
https://tu-dominio.com
https://tu-dominio.vercel.app
```

#### URIs de redirección autorizados:

```
http://localhost:3000/api/auth/callback/google
http://localhost:3001/api/auth/callback/google
https://tu-dominio.com/api/auth/callback/google
https://tu-dominio.vercel.app/api/auth/callback/google
```

5. **Copiar credenciales**:
   - **Client ID**: Empieza con algo como `123456-abc.apps.googleusercontent.com`
   - **Client Secret**: Cadena secreta para el servidor

## 🔐 Variables de Entorno

Agrega estas variables a tu `.env.local`:

```bash
# Google OAuth (OBLIGATORIAS)
GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_google_client_secret
```

## 📋 Permisos Solicitados

Con la nueva configuración, Google solicitará permiso para:

### ✅ Permisos Básicos (todos los usuarios los aprueban)

- **email**: Dirección de correo electrónico
- **profile**: Información básica de perfil (nombre, foto)
- **openid**: Identificación única

### 🔍 Permisos Adicionales (pueden generar más fricción)

- **user.birthday.read**: Fecha de nacimiento
- **user.gender.read**: Género (opcional, por si quieres usarlo en el futuro)

## ⚠️ Consideraciones Importantes

### Aprobación de Google

- **Durante desarrollo**: Solo usuarios de prueba pueden usar la app
- **Para producción**: Necesitas verificación de Google si solicitas scopes sensibles
- **Tiempo de verificación**: 4-6 semanas aproximadamente

### Información Disponible

- **Fecha de nacimiento**: No todos los usuarios la tienen configurada en Google
- **Privacidad**: Algunos usuarios pueden rechazar el permiso
- **Fallback**: Si no se obtiene fecha, el sistema pedirá completar perfil

### Rates Limits

- **People API**: 1,000 solicitudes por día (gratis)
- **Para producción**: Considera aumentar límites o implementar caché

## 🧪 Testing

### Usuarios de Prueba

1. Agrega emails de prueba en la pantalla de consentimiento
2. Solo estos usuarios pueden usar Google Sign-In en desarrollo
3. Prueba con usuarios que TENGAN fecha de nacimiento en Google

### Verificar Permisos

1. Ve a https://myaccount.google.com/permissions
2. Verifica que tu app aparezca con los permisos correctos
3. Revoca permisos para probar el flujo completo

## 🚀 Publicación (Futuro)

### Para usar en producción sin restricciones:

1. **Completar pantalla de consentimiento**:

   - Política de privacidad
   - Términos de servicio
   - Capturas de pantalla de la app

2. **Enviar para verificación**:

   - Google revisará tu app
   - Proceso de 4-6 semanas
   - Pueden solicitar cambios

3. **Alternativa rápida**:
   - Usar solo scopes básicos (email, profile)
   - Pedir fecha de nacimiento manualmente
   - ✅ **Recomendado para MVP**

## 🎯 Resultado Final

Una vez configurado, el flujo será:

1. Usuario hace clic en "Iniciar con Google"
2. Google muestra pantalla de permisos (incluye fecha de nacimiento)
3. Usuario autoriza
4. Sistema recibe: email, nombre, foto, **fecha de nacimiento**
5. Usuario entra directamente sin necesidad de completar perfil

Si Google no proporciona fecha de nacimiento → Banner aparece para completar perfil.
