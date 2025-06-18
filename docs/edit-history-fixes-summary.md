# Resumen de Correcciones - Editor de Historial

## 🐛 **Problemas Encontrados y Solucionados**

### 1. **Modal no aparecía - Problema de `scorerId`**

**Problema:** Los goles tenían `scorerId: undefined`, por lo que el filtro para detectar goles de jugadores no funcionaba.

**Causa:** Los goles en la base de datos no tenían `scorerId` poblado correctamente.

**Solución:**

```typescript
// ANTES
scorerId: goal.scorerId,

// DESPUÉS
scorerId: goal.scorerId || goal.scorer?.id || null,
```

**Aplicado en:**

- `fetchMatch()` - Carga inicial de datos
- `handleUpdateScore()` - Después de actualizar puntajes
- `executeSwapPlayers()` - Después de intercambiar jugadores
- `handleUpdateGoals()` - Después de actualizar goles
- Reset de goles al cancelar edición

### 2. **Error 500 en API - Acceso inseguro a propiedades**

**Problema:** El API crasheaba al intentar acceder a `player1.user.name` cuando la estructura de datos no incluía `user`.

**Solución:**

```typescript
// ANTES
name: player1.user.name,

// DESPUÉS
name: player1?.user?.name || 'Jugador desconocido',
```

### 3. **Goles no se intercambiaban en el backend**

**Problema:** Al intercambiar jugadores, solo se actualizaba `matchPlayers` pero no `goals`.

**Solución:** Agregado intercambio automático de goles y recálculo de puntajes:

```typescript
// Intercambiar goles de los jugadores
await Promise.all([
  prisma.goal.updateMany({
    where: { matchId: matchId, scorerId: player1Id },
    data: { isTeamA: !player1IsTeamA },
  }),
  prisma.goal.updateMany({
    where: { matchId: matchId, scorerId: player2Id },
    data: { isTeamA: !player2IsTeamA },
  }),
]);

// Recalcular puntajes automáticamente
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

## 🧪 **Testing Después de las Correcciones**

### Escenario de Prueba:

1. **Partido con goles:** Ariel Ortega tiene 3 goles en Equipo A
2. **Intercambio:** Mover Ariel del Equipo A al Equipo B
3. **Resultado esperado:**
   - ✅ Modal de confirmación debe aparecer
   - ✅ Debe mostrar cambio de resultado (ej: 3-0 → 0-3)
   - ✅ Debe listar los 3 goles afectados
   - ✅ Al confirmar, debe actualizar correctamente

### Logs de Debug (Solo en Desarrollo):

```
🔍 Verificando impacto del intercambio...
Player1 ID: cmae9mt2t000hyqw9y9n3o0ar
Goals actuales: [3 goles con scorerId poblado correctamente]
Goles Player1: [3 goles encontrados]
✅ Mostrando modal de confirmación
```

## 📋 **Estado Actual**

- ✅ **Frontend:** `scorerId` se popula correctamente usando fallback
- ✅ **Backend:** Intercambio de goles implementado
- ✅ **API:** Manejo seguro de propiedades con optional chaining
- ✅ **Logging:** Información de debugging agregada
- ✅ **Recálculo:** Puntajes se actualizan automáticamente

## 🔄 **Próxima Prueba**

Con estas correcciones, el flujo debería ser:

1. **Cargar partido:** Los goles ahora tienen `scorerId` correcto
2. **Seleccionar jugadores:** Sistema detecta goles de jugadores
3. **Modal aparece:** Muestra impacto del intercambio
4. **Confirmar:** Backend intercambia jugadores Y goles
5. **Resultado:** Puntajes se recalculan automáticamente
6. **Cache:** Se invalida al regresar al historial

## 🛠️ **Archivos Modificados**

- `pages/matches/edit-history/[id].tsx`: Fallback para `scorerId`
- `pages/api/matches/[id]/edit-history.ts`: Intercambio de goles + logging seguro
- `docs/edit-history-fixes-summary.md`: Esta documentación
