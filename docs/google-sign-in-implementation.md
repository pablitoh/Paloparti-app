# Implementación de Google Sign-In

## Resumen

Se implementó Google Sign-In usando Firebase + NextAuth manteniendo el control total de usuarios y sesiones en nuestro sistema.

## Características Implementadas

### ✅ Autenticación Híbrida

- **Login por credenciales**: Sistema original mantiene funcionalidad completa
- **Login con Google**: Nuevo método usando OAuth 2.0
- **Sesiones unificadas**: NextAuth maneja ambos tipos de autenticación

### ✅ Gestión Inteligente de Usuarios

#### Creación de Usuarios Google

- Email único como identificador principal
- Nombre temporal inteligente basado en email si no viene de Google
- Fecha de nacimiento: `null` (se solicita completar después)
- Avatar de Google se usa automáticamente
- Password: `null` (indica usuario de Google)

#### Unificación de Cuentas Existentes

- **Prioriza datos de la aplicación** sobre datos de Google
- Solo actualiza campos vacíos con información de Google
- Preserva avatars personalizados (usa Google solo como fallback)
- Mantiene fechas de nacimiento existentes

### ✅ Experiencia de Usuario Mejorada

#### Banner de Perfil Incompleto

- Detecta automáticamente usuarios con información faltante
- Mensaje personalizado según campos pendientes
- Enlace directo a completar perfil
- Opción de descartar temporalmente

#### Página de Edición de Perfil

- **Banner informativo** para usuarios de Google
- **Sección de contraseñas oculta** para usuarios de Google
- Detección automática del tipo de usuario

## Arquitectura Técnica

### Flujo de Autenticación Google

```mermaid
graph TD
    A[Usuario hace clic en "Iniciar con Google"] --> B[NextAuth redirige a Google OAuth]
    B --> C[Usuario autoriza en Google]
    C --> D[Google redirige con credenciales]
    D --> E[Callback signIn ejecuta]
    E --> F{¿Usuario existe en BD?}
    F -->|No| G[Crear nuevo usuario]
    F -->|Sí| H[Unificar datos inteligentemente]
    G --> I[NextAuth crea sesión JWT]
    H --> I
    I --> J[Redirección a /groups]
```

### Componentes Nuevos

1. **`lib/firebase.ts`**: Configuración de Firebase
2. **`lib/userProfileUtils.ts`**: Utilidades para perfil de usuario
3. **`components/GoogleSignInButton.tsx`**: Botón reutilizable
4. **`components/ProfileCompletionBanner.tsx`**: Banner de perfil incompleto
5. **`scripts/fix-google-users-birthdate.ts`**: Script de migración

### Callbacks NextAuth Modificados

#### `signIn` Callback

```typescript
async signIn({ user, account, profile }) {
  if (account?.provider === 'google') {
    // Lógica de creación/unificación de usuarios
    // Prioriza datos existentes de la aplicación
    // Genera nombres temporales inteligentes
  }
  return true;
}
```

## Configuración Requerida

### Variables de Entorno

```bash
# Google OAuth (OBLIGATORIAS)
GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Firebase (OPCIONALES - para futuras funcionalidades)
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
# ... otras variables de Firebase
```

### Google Cloud Console

1. Crear proyecto o usar existente
2. Habilitar Google Identity API
3. Configurar OAuth 2.0:
   - Orígenes autorizados: `http://localhost:3000`, `https://tu-dominio.com`
   - URIs de redirección: `*/api/auth/callback/google`

## Lógica de Datos

### Detección de Usuarios Google

```typescript
const isGoogleUser = user.password === null;
```

### Unificación de Cuentas

```typescript
const updateData = {};

// Solo actualizar campos vacíos
if (!existingUser.name && user.name) {
  updateData.name = user.name;
}

// Avatar: usar Google solo como fallback
if (!existingUser.image && user.image) {
  updateData.image = user.image;
}
```

### Nombres Temporales

```typescript
const temporaryName =
  user.name ||
  `Usuario ${
    user.email.split('@')[0].charAt(0).toUpperCase() +
    user.email.split('@')[0].slice(1)
  }`;
```

## Scripts de Mantenimiento

### Corregir Fechas de Nacimiento Incorrectas

```bash
npx ts-node scripts/fix-google-users-birthdate.ts
```

Este script:

- Encuentra usuarios de Google con fecha 1990-01-01
- Las actualiza a `null`
- Fuerza completar perfil

## Limitaciones y Consideraciones

### Google OAuth Scope Limitado

- **No incluye fecha de nacimiento** por defecto
- Requeriría permisos especiales para información detallada
- Decidimos pedir fecha de nacimiento manualmente

### Información de Perfil

- Google proporciona: `name`, `email`, `picture`
- Nuestra app requiere: `name`, `email`, `birthdate`, `image`
- Fecha de nacimiento se solicita después del login

### Seguridad

- Contraseñas: `null` para usuarios de Google
- No pueden usar login por credenciales
- Autenticación completamente manejada por Google

## Testing

### Casos de Prueba

1. **Nuevo usuario Google**: Crear cuenta completa
2. **Usuario existente sin avatar**: Adoptar avatar de Google
3. **Usuario existente con avatar**: Preservar avatar propio
4. **Usuario existente con nombre**: Preservar nombre propio
5. **Usuario con perfil incompleto**: Mostrar banner

### Verificaciones

- Login exitoso redirige a `/groups`
- Banner aparece solo para perfiles incompletos
- Sección contraseñas oculta para usuarios Google
- Avatar de Google se usa como fallback

## Beneficios

### Para Usuarios

- 🚀 **Login más rápido** con Google
- 🔒 **Mayor seguridad** (sin contraseñas que recordar)
- 📱 **Mejor UX móvil** (autenticación del dispositivo)
- 🖼️ **Avatar automático** desde Google

### Para el Sistema

- 🎯 **Control total** de usuarios y sesiones
- 🔄 **Compatibilidad completa** con sistema existente
- 📊 **Datos consistentes** en nuestra base de datos
- 🛡️ **Sin dependencias críticas** de Firebase

## Próximos Pasos

1. **Configurar Google Cloud Console** con URLs de producción
2. **Probar en entorno de producción**
3. **Monitorear métricas** de adopción de Google Sign-In
4. **Considerar Apple Sign-In** si hay demanda
