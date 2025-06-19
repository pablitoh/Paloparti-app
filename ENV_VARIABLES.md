# Variables de Entorno para Vercel

Para que el deploy funcione correctamente en Vercel, necesitas configurar las siguientes variables de entorno:

## Variables Requeridas

### Base de Datos

```
DATABASE_URL=postgresql://username:password@host:port/database
```

### NextAuth.js

```
NEXTAUTH_URL=https://tu-dominio.vercel.app
NEXTAUTH_SECRET=tu-clave-secreta-aqui
```

### Supabase (si usas Supabase)

```
SUPABASE_URL=tu-url-de-supabase
SUPABASE_ANON_KEY=tu-clave-anonima-de-supabase
```

### Entorno

```
NODE_ENV=production
VERCEL_ENV=production
```

## Variables de Autenticación

### Google OAuth (Nuevo)

```bash
# Credenciales de Google Cloud Console
GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Variables públicas de Firebase (opcionales)
NEXT_PUBLIC_FIREBASE_API_KEY=tu_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

## Cómo configurar en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Navega a Settings > Environment Variables
3. Agrega cada variable con su valor correspondiente
4. Asegúrate de seleccionar los entornos apropiados (Production, Preview, Development)

## Notas Importantes

- La `DATABASE_URL` debe apuntar a una base de datos PostgreSQL accesible desde internet
- El `NEXTAUTH_SECRET` debe ser una cadena aleatoria y segura
- Para entornos de preview, considera usar una base de datos separada o deshabilitar las migraciones
- **Solo necesitas las credenciales de Google OAuth para que funcione el login de Google**
- Las variables de Firebase son opcionales si decides usar Firebase en el futuro
- En producción, asegúrate de configurar las URLs correctas en Google Cloud Console

## Troubleshooting

Si ves el error "FATAL: Tenant or user not found":

1. Verifica que la `DATABASE_URL` esté correctamente configurada
2. Asegúrate de que las credenciales de la base de datos sean válidas
3. Confirma que la base de datos esté accesible desde Vercel
