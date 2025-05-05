# Guía para construir el proyecto localmente

Debido a un problema conocido con las dependencias `rc-util` y `rc-picker`, la construcción local puede fallar con el siguiente error:

```
[Error: Cannot find module '/path/to/node_modules/rc-util/es/warning' imported from /path/to/node_modules/rc-picker/es/generate/dayjs.js
Did you mean to import "rc-util/es/warning.js"?]
```

## Solución: Script de construcción local

Para evitar este problema, hemos creado un script que realiza la construcción localmente de forma correcta:

```bash
./scripts/local-build.sh
```

Este script:

1. Guarda temporalmente los archivos de la página problemática
2. Los reemplaza con versiones simplificadas
3. Ejecuta el build
4. Restaura los archivos originales

## Alternativa: Modificación manual

Si prefieres hacerlo manualmente:

1. Guarda los archivos de `pages/matches/edit/` en algún lugar
2. Crea un archivo temporal simple en `pages/matches/edit/[id].js`
3. Ejecuta `npm run build`
4. Restaura los archivos originales

## Nota importante

Este problema solo afecta el entorno de desarrollo local. El despliegue en Vercel funciona correctamente porque utiliza un entorno diferente de construcción.
