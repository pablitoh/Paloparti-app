# Corrección de Bugs en Edición de Historial

## Problemas Identificados y Solucionados

### 1. **Bug: Goles no se actualizaban al intercambiar jugadores**

**Problema:**

- Al intercambiar jugadores, solo se actualizaba su posición en los equipos
- Los goles seguían con el `isTeamA` original del jugador
- Esto causaba inconsistencias: el equipo tenía menos goles totales que los goles individuales del jugador

**Causa Raíz:**
El API `handleSwapPlayers` solo actualizaba la tabla `matchPlayers` pero no la tabla `goals`.

**Solución Implementada:**

```typescript
// ANTES: Solo intercambiaba jugadores
await Promise.all([
  prisma.matchPlayer.updateMany({
    where: { matchId: matchId, userId: player1Id },
    data: { isTeamA: !player1IsTeamA },
  }),
  prisma.matchPlayer.updateMany({
    where: { matchId: matchId, userId: player2Id },
    data: { isTeamA: !player2IsTeamA },
  }),
]);

// DESPUÉS: También intercambia los goles
await Promise.all([
  // ... intercambiar jugadores (igual que antes)

  // NUEVO: También intercambiar los goles
  prisma.goal.updateMany({
    where: { matchId: matchId, scorerId: player1Id },
    data: { isTeamA: !player1IsTeamA },
  }),
  prisma.goal.updateMany({
    where: { matchId: matchId, scorerId: player2Id },
    data: { isTeamA: !player2IsTeamA },
  }),
]);

// NUEVO: Recalcular puntajes automáticamente
const goalsTeamA = await prisma.goal.count({
  where: { matchId: matchId, isTeamA: true },
});
const goalsTeamB = await prisma.goal.count({
  where: { matchId: matchId, isTeamA: false },
});

await prisma.match.update({
  where: { id: matchId },
  data: { scoreA: goalsTeamA, scoreB: goalsTeamB },
});
```

### 2. **Bug: Modal de confirmación no aparecía**

**Problema:**

- El modal de advertencia para intercambios con goles no se mostraba
- Los intercambios se ejecutaban sin confirmación

**Posibles Causas:**

1. **IDs no coinciden:** Los IDs de jugadores en el estado local no coinciden con los IDs en los goles
2. **Estado de goles desactualizado:** El estado `goals` no refleja los goles actuales del partido
3. **Lógica de filtrado incorrecta:** Error en la función `calculateSwapImpact`

**Debugging Implementado:**

```typescript
// Logs condicionales para desarrollo
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Verificando impacto del intercambio...');
  console.log('Player 1:', player1);
  console.log('Player 2:', player2);
  console.log('Goals actuales:', goals);
  console.log('Impact calculado:', impact);
}
```

**Solución:**

- Se agregaron logs de debugging para identificar el problema específico
- Se mantienen los logs solo en desarrollo para no afectar producción

### 3. **Mejora: Logging mejorado en el backend**

**Implementación:**

```typescript
await logGroupEvent(match.groupId, user.id, LogAction.PLAYER_SWAPPED, {
  // ... datos existentes
  resultUpdated: {
    previousScore: { scoreA: match.scoreA, scoreB: match.scoreB },
    newScore: { scoreA: goalsTeamA, scoreB: goalsTeamB },
  },
});
```

## Proceso de Testing

### Pasos para Reproducir el Bug Original:

1. Ir a un partido completado con goles
2. Entrar al editor de historial
3. Intercambiar un jugador que tiene goles
4. Observar que:
   - El modal no aparecía
   - El resultado no cambiaba
   - Los goles totales del equipo no coincidían

### Pasos para Verificar la Solución:

1. Repetir los pasos anteriores
2. Verificar que:
   - **Modal aparece** cuando hay goles involucrados
   - **Resultado se actualiza** automáticamente
   - **Goles totales coinciden** con la suma individual
   - **Logs se registran** correctamente

## Archivos Modificados

- `pages/api/matches/[id]/edit-history.ts`: Corregido intercambio de goles
- `pages/matches/edit-history/[id].tsx`: Agregado debugging condicional
- `docs/edit-history-bugfixes.md`: Esta documentación

## Estado Actual

- ✅ **Backend corregido:** Los goles se intercambian correctamente
- ✅ **Puntajes se recalculan:** Automáticamente después del intercambio
- 🔍 **Frontend en debugging:** Logs agregados para identificar problema del modal
- ✅ **Logging mejorado:** Se registra el cambio de resultado en los logs

## Próximos Pasos

1. **Probar en desarrollo** con los logs para identificar por qué el modal no aparece
2. **Verificar consistencia de datos** entre frontend y backend
3. **Remover logs de debugging** una vez solucionado el problema del modal
4. **Testing completo** de todos los escenarios de intercambio
