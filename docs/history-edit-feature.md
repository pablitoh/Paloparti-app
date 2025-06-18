# Feature: Editar Partidos Terminados desde el Historial

## Descripción

Esta feature permite a los administradores de grupos editar partidos que ya han sido completados directamente desde la pestaña de historial. Las funcionalidades incluyen:

- **Modificar puntajes**: Cambiar el resultado final del partido
- **Intercambiar jugadores**: Mover jugadores entre equipos
- **Gestionar goles**: Agregar, eliminar o reasignar goles a jugadores
- **Logging completo**: Todas las acciones quedan registradas en los logs del grupo

## Restricciones

- Solo los **administradores** del grupo pueden editar partidos
- Solo se pueden editar partidos con estado `COMPLETED`
- Los puntajes deben estar entre 0 y 99
- Para intercambiar jugadores, deben estar en equipos diferentes

## Componentes Creados

### 1. API Endpoint

**Archivo**: `/pages/api/matches/[id]/edit-history.ts`

Maneja las siguientes acciones:

- `update-score`: Actualizar puntajes del partido
- `swap-players`: Intercambiar jugadores entre equipos
- `update-goals`: Gestionar goles del partido

### 2. Página de Edición

**Archivo**: `/pages/matches/edit-history/[id].tsx`

Interface completa para editar partidos con:

- Vista previa del resultado actual
- Herramientas de edición de puntajes
- Sistema de intercambio visual de jugadores
- Editor de goles por jugador
- Confirmaciones y validaciones

### 3. Actualización del HistoryTab

**Archivo**: `/components/group/tabs/HistoryTab.tsx`

- Agregado botón "Editar" para administradores
- Integración con la nueva página de edición
- Prop `currentUserIsAdmin` para mostrar/ocultar botón

### 4. Utilidades

**Archivo**: `/utils/historyUtils.ts`

Funciones helper para:

- Formateo de fechas
- Cálculo de puntajes y goles
- Validaciones
- Formateo de mensajes de log

## Flujo de Uso

1. **Acceso**: Administrador va a la pestaña "Historial"
2. **Selección**: Hace clic en "Editar" en cualquier partido completado
3. **Edición**: Usa las herramientas disponibles para modificar:
   - Puntajes (campos numéricos)
   - Jugadores (selección visual para intercambio)
   - Goles (botones + y - por jugador)
4. **Guardado**: Confirma cambios con botones específicos
5. **Logging**: Toda acción queda registrada automáticamente

## Tipos de Log

- `MATCH_RESULT_EDITED`: Cuando se cambian puntajes o goles
- `PLAYER_SWAPPED`: Cuando se intercambian jugadores entre equipos

## Seguridad

- Verificación de autenticación (usuario logueado)
- Verificación de permisos (admin del grupo)
- Validación de estado del partido (COMPLETED)
- Validación de datos de entrada
- Logging completo de todas las acciones

## Integración

La feature se integra perfectamente con:

- Sistema de logs existente
- Patrones estéticos de la aplicación
- Componentes y utilidades existentes
- Sistema de permisos actual

## Ejemplo de Uso

```typescript
// Para ir a editar un partido desde código
router.push(`/matches/edit-history/${matchId}`);

// Para verificar si se puede editar
const canEdit = canEditMatch(match, currentUserIsAdmin);
```
