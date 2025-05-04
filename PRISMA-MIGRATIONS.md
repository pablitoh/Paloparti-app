# Prisma Migrations en Vercel

Este documento explica cómo están configuradas las migraciones automáticas de Prisma en ambientes de Vercel para este proyecto.

## Configuración

Las migraciones se ejecutan automáticamente durante el proceso de build en Vercel, tanto para ambientes de preview como de producción.

### Archivos involucrados

1. `scripts/prisma-migrate.js` - Script personalizado que ejecuta las migraciones sólo en ambientes de Vercel
2. `package.json` - Configurado para ejecutar el script de migración durante el build
3. `vercel.json` - Configuración específica para Vercel

## ¿Cómo funciona?

1. Cuando se hace un push al repositorio, Vercel inicia automáticamente un deployment
2. Durante el proceso de build, se ejecuta `npm run build`
3. El script de build llama a `scripts/prisma-migrate.js`
4. El script verifica si está en un ambiente de Vercel (preview o producción)
5. Si es así, ejecuta `prisma migrate deploy` para aplicar las migraciones pendientes

## Variables de entorno requeridas

Asegúrate de que las siguientes variables estén configuradas en tu proyecto de Vercel:

- `DATABASE_URL`: URL de conexión a tu base de datos PostgreSQL
- `DIRECT_URL` (opcional): URL directa a la base de datos si usas pooling

## Buenas prácticas

1. **Siempre genera y prueba las migraciones localmente antes de hacer push**

   ```bash
   npx prisma migrate dev --name mi-migracion
   ```

2. **Todas las migraciones deben estar commiteadas en el repositorio**

   ```bash
   git add prisma/migrations/
   git commit -m "Add database migrations"
   ```

3. **Verifica las migraciones en un ambiente de preview antes de ir a producción**

4. **Considera hacer backups de la base de datos antes de desplegar cambios importantes**

## Solución de problemas

Si las migraciones no se ejecutan correctamente:

1. Verifica los logs de build en Vercel para ver mensajes de error específicos
2. Asegúrate de que tus variables de entorno estén configuradas correctamente
3. Prueba ejecutar las migraciones manualmente usando el Vercel CLI:
   ```bash
   vercel env pull
   npx prisma migrate deploy
   ```
