# Guía para resolver errores de módulos de RC-components

Debido a un problema conocido con las dependencias `rc-util` y `rc-picker`, la construcción puede fallar con el siguiente error tanto localmente como en Vercel:

```
[Error: Cannot find module '/path/to/node_modules/rc-util/es/warning' imported from /path/to/node_modules/rc-picker/es/generate/dayjs.js
Did you mean to import "rc-util/es/warning.js"?]
```

## Solución implementada

Hemos implementado dos soluciones para este problema:

1. **Script de corrección automática**: Un script que modifica el archivo problemático para añadir la extensión `.js` al import.

   - Se ejecuta automáticamente durante el build tanto localmente como en Vercel.
   - Detecta el entorno y busca en diferentes ubicaciones posibles.

2. **Página de edición simplificada**: Reemplazamos la página original que usaba componentes problemáticos con una versión más simple que mantiene la funcionalidad básica.

## Construcción local

Para construir el proyecto localmente, usa el script proporcionado:

```bash
./scripts/local-build.sh
```

Este script:

1. Guarda temporalmente los archivos de la página problemática
2. Los reemplaza con versiones simplificadas
3. Ejecuta el build
4. Restaura los archivos originales

## Cómo funciona la solución en Vercel

En Vercel, el proceso es el siguiente:

1. Durante el build, `scripts/fix-rc-imports.js` se ejecuta automáticamente
2. Este script busca y corrige el archivo problemático
3. Si persisten problemas, la versión simplificada de la página de edición se usa como fallback

## Resolución de problemas

Si continúas teniendo problemas:

1. Verifica que el script `scripts/fix-rc-imports.js` tenga permisos de ejecución
2. Comprueba los logs de build en Vercel para ver si el script está encontrando y modificando el archivo correctamente
3. Considera añadir más rutas de búsqueda al script si el archivo no se encuentra en las ubicaciones predeterminadas
