# Debug y Arreglos - Cálculo de Intercambio

## 🐛 **Problema Principal**

El cálculo del intercambio de jugadores no funciona correctamente y no se pueden guardar goles.

## 🔧 **Arreglos Aplicados**

### 1. **Arreglo Backend - Campo scorerId → userId**

**Error**:

```
Argument `userId` is missing.
Invalid `prisma.goal.createMany()` invocation
```

**Solución**:

```typescript
// ANTES (❌)
const goalData = goals.map((goal) => ({
  matchId,
  scorerId: goal.scorerId, // Campo incorrecto
  isTeamA: goal.isTeamA,
  minute: goal.minute || null,
}));

// DESPUÉS (✅)
const goalData = goals.map((goal) => ({
  matchId,
  userId: goal.scorerId, // Campo correcto según schema
  isTeamA: goal.isTeamA,
  minute: goal.minute || null,
}));
```

### 2. **Debugging Mejorado en Frontend**

Agregado logging detallado para identificar problemas:

```typescript
// Información de jugadores
console.log(
  'Player1 ID:',
  player1.id,
  'Name:',
  player1.name,
  'Team:',
  player1.isTeamA ? 'A' : 'B'
);
console.log(
  'Player2 ID:',
  player2.id,
  'Name:',
  player2.name,
  'Team:',
  player2.isTeamA ? 'A' : 'B'
);

// Estado actual
console.log('Scores actuales: A =', scoreA, 'B =', scoreB);

// Análisis de goles
console.log(
  'IDs de scorers en goles:',
  goals.map((g) => ({
    id: g.scorerId,
    name: g.scorerName,
    team: g.isTeamA ? 'A' : 'B',
  }))
);

// Proceso de cálculo paso a paso
console.log('🔢 Iniciando cálculo:');
console.log('Score inicial: A =', newScoreA, 'B =', newScoreB);
console.log('Después de restar: A =', newScoreA, 'B =', newScoreB);
console.log('🎯 Resultado final: A =', newScoreA, 'B =', newScoreB);
```

### 3. **Limitación de Goles Corregida**

```typescript
// Team A: No puede exceder scoreA
disabled={goalsA.length >= scoreA}

// Team B: No puede exceder scoreB
disabled={goalsB.length >= scoreB}
```

## 🧪 **Casos de Prueba con Debug**

### **Escenario Esperado**:

```
Situación inicial:
- Resultado: 3-2
- Ariel (Team A): 3 goles
- Emiliano (Team B): 0 goles

Debug esperado:
Player1 ID: [ariel-id] Name: Ariel Ortega Team: A
Player2 ID: [emiliano-id] Name: Emiliano Martínez Team: B
Scores actuales: A = 3 B = 2
Goles Player1 (Ariel Ortega): 3 [array de goles]
Goles Player2 (Emiliano Martínez): 0 []

Cálculo:
🔢 Iniciando cálculo:
Score inicial: A = 3 B = 2
Restando gol de Ariel Ortega del Team A: 2
Restando gol de Ariel Ortega del Team A: 1
Restando gol de Ariel Ortega del Team A: 0
Después de restar: A = 0 B = 2
Ariel Ortega gol va de A → B: 3
Ariel Ortega gol va de A → B: 4
Ariel Ortega gol va de A → B: 5
🎯 Resultado final: A = 0 B = 5
```

### **Modal debe mostrar**:

```
Actual: 3 - 2 → Nuevo: 0 - 5
Goles afectados: 3
• Ariel Ortega (Celeste)
• Ariel Ortega (Celeste)
• Ariel Ortega (Celeste)
```

## 🔍 **Diagnóstico de Problemas**

### **Si no aparece el modal**:

- Verificar que `affectedGoals.length > 0`
- Revisar que `scorerId` coincida con `player.id`
- Comprobar que los goles estén cargados correctamente

### **Si el cálculo es incorrecto**:

- Verificar valores de `scoreA` y `scoreB` en estado
- Revisar que `player1Goals` y `player2Goals` contengan los goles correctos
- Comprobar lógica de suma/resta por equipo

### **Si no se guardan los goles**:

- Error `userId is missing` → Usar `userId` en lugar de `scorerId` en backend
- Verificar que el frontend envíe `scorerId` correctamente

## ✅ **Estado Actual**

- [x] **Backend arreglado**: Campo `userId` correcto para crear goles
- [x] **Debug mejorado**: Logging detallado para identificar problemas
- [x] **Limitación de goles**: Respeta máximo por equipo
- [x] **Cálculo de intercambio**: Usa valores dinámicos del estado

## 🚀 **Próximas Pruebas**

1. **Abrir consola** del navegador
2. **Intentar intercambio** de Ariel y Emiliano
3. **Revisar logs** para identificar problema exacto
4. **Verificar modal** muestra cálculo correcto
5. **Confirmar intercambio** funciona sin errores
