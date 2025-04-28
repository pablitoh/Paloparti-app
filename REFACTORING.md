# Refactorización de la Arquitectura de API y Frontend

## Problema Actual

Actualmente, la página de detalles de grupo (`pages/group/[id].tsx`) es excesivamente grande (1765 líneas) y agrupa demasiada funcionalidad en un solo componente. El endpoint API devuelve todos los datos del grupo, incluyendo miembros, partidos, historial completo y estadísticas, lo que resulta en respuestas de gran tamaño y menor rendimiento.

## Solución Propuesta

Hemos reestructurado la arquitectura para seguir un enfoque más modular y eficiente:

1. **Endpoints API específicos**: Cada aspecto del grupo (datos básicos, miembros, partidos, etc.) tiene su propio endpoint.
2. **Hooks de React Query**: Cada endpoint tiene su propio hook para gestionar el estado, la caché y las refetchings.
3. **Carga de datos por demanda**: Los datos se cargan sólo cuando son necesarios.

## Nuevos Endpoints API

Se han creado los siguientes endpoints específicos:

- `/api/groups/[id]` - Información básica del grupo
- `/api/groups/[id]/next-match` - Detalles del próximo partido
- `/api/groups/[id]/members` - Lista de miembros y solicitudes pendientes
- `/api/groups/[id]/stats` - Estadísticas (goleadores y MVP)
- `/api/groups/[id]/history` - Historial de partidos con paginación

## Hooks de React Query

Se han creado hooks específicos para cada endpoint:

- `useGroupBasicInfo(groupId)` - Datos básicos del grupo
- `useGroupNextMatch(groupId)` - Datos del próximo partido
- `useGroupMembers(groupId)` - Miembros y solicitudes pendientes
- `useGroupStats(groupId)` - Estadísticas del grupo
- `useGroupHistory(groupId, page, limit)` - Historial de partidos con paginación

## Pasos para Implementar la Refactorización

1. **Implementar los nuevos endpoints API**

   - Revisar y ajustar los tipos según necesidad
   - Corregir errores de linting
   - Probar cada endpoint individualmente

2. **Implementar los hooks de React Query**

   - Actualizar el archivo `groupHooks.ts` con todos los hooks
   - Ajustar los tipos y parámetros según sea necesario

3. **Refactorizar la página de detalles del grupo**

   - Utilizar el archivo `modular-example.tsx` como referencia
   - Reemplazar gradualmente partes del componente grande por la nueva implementación modular
   - Mantener la compatibilidad durante la transición

4. **Verificar compatibilidad con componentes de pestaña existentes**

   - Asegurar que los componentes `NextMatchTab`, `HistoryTab`, etc. reciban los datos en el formato correcto
   - Actualizar las interfaces según sea necesario

5. **Implementar mecanismos de reintento y manejo de errores**
   - Mejorar la experiencia de usuario para casos de fallo en la red
   - Implementar retries automáticos donde sea apropiado

## Ventajas de la Nueva Arquitectura

1. **Mejor rendimiento**

   - Respuestas API más pequeñas y específicas
   - Carga bajo demanda de datos pesados (como historial)
   - Mejor utilización de la caché del navegador

2. **Mejor experiencia de desarrollo**

   - Código más modular y fácil de mantener
   - Separación clara de responsabilidades
   - Más fácil de probar y depurar

3. **Mejor experiencia de usuario**
   - Carga inicial más rápida
   - Actualizaciones parciales de la UI al cambiar datos
   - Menos tiempo de espera al navegar entre pestañas

## Compatibilidad y Migración

Para facilitar la transición, recomendamos:

1. Implementar primero los nuevos endpoints y hooks
2. Crear una versión nueva de la página que utilice la nueva arquitectura
3. Mantener la versión actual funcionando en paralelo durante las pruebas
4. Cambiar gradualmente a la nueva versión cuando esté lista

## Plan de Pruebas

1. Probar cada endpoint individualmente con Postman o similar
2. Implementar pruebas unitarias para los hooks de React Query
3. Probar la nueva interfaz con usuarios reales en entorno de staging
4. Monitorear rendimiento y errores después del despliegue

## Próximos Pasos

1. Aplicar esta arquitectura a otras páginas de la aplicación
2. Considerar implementar Server Components de Next.js para un rendimiento aún mejor
3. Explorar opciones de SSR/SSG para optimizar aún más la carga inicial
