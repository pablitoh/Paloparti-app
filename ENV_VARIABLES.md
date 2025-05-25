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

## Cómo configurar en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Navega a Settings > Environment Variables
3. Agrega cada variable con su valor correspondiente
4. Asegúrate de seleccionar los entornos apropiados (Production, Preview, Development)

## Notas Importantes

- La `DATABASE_URL` debe apuntar a una base de datos PostgreSQL accesible desde internet
- El `NEXTAUTH_SECRET` debe ser una cadena aleatoria y segura
- Para entornos de preview, considera usar una base de datos separada o deshabilitar las migraciones

## Troubleshooting

Si ves el error "FATAL: Tenant or user not found":

1. Verifica que la `DATABASE_URL` esté correctamente configurada
2. Asegúrate de que las credenciales de la base de datos sean válidas
3. Confirma que la base de datos esté accesible desde Vercel
