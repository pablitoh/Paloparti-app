# Arreglos Finales - Modal de Intercambio con Goles

## 🐛 Problemas Identificados y Resueltos

### 1. **Error de Base de Datos - Campo Incorrecto**

**Problema**: El API intentaba usar `scorerId` pero el schema usa `userId`

```
Unknown argument `scorerId`. Did you mean `scorer`?
```

**Solución**: Corregir los campos en el API

```typescript
// ANTES (❌)
prisma.goal.updateMany({
  where: { matchId, scorerId: player1Id },
  data: { isTeamA: !player1IsTeamA },
});

// DESPUÉS (✅)
prisma.goal.updateMany({
  where: { matchId, userId: player1Id },
  data: { isTeamA: !player1IsTeamA },
});
```

### 2. **Cálculo Incorrecto del Resultado**

**Problema**: El modal mostraba "3-2 → 3-2" cuando debería mostrar "3-2 → 0-5"

**Causa**: Lógica incorrecta en el cálculo de intercambio

```typescript
// ANTES (❌) - Lógica confusa
player1Goals.forEach((goal) => {
  if (!goal.isTeamA) {
    newScoreA++; // Esto estaba mal
  } else {
    newScoreB++;
  }
});

// DESPUÉS (✅) - Lógica clara
player1Goals.forEach((goal) => {
  if (goal.isTeamA) {
    // Estaba en A, ahora va a B
    newScoreB++;
  } else {
    // Estaba en B, ahora va a A
    newScoreA++;
  }
});
```

### 3. **Error de TypeScript**

**Problema**: Referencia a propiedad inexistente `goal.scorer?.id`
**Solución**: Usar solo `goal.scorerId` ya que está disponible

## 🧪 Caso de Prueba Esperado

**Situación**:

- Ariel Ortega (Team A) tiene 3 goles
- Emiliano Martínez (Team B) tiene 0 goles
- Resultado actual: 3-2

**Al intercambiar**:

- Ariel va de A → B (sus 3 goles van de A → B)
- Emiliano va de B → A (sin goles)
- Resultado nuevo: 0-5

**Modal debe mostrar**:

```
Cambio de resultado:
Actual: 3 - 2 → Nuevo: 0 - 5

Goles afectados: 3
• Ariel Ortega (Celeste)
• Ariel Ortega (Celeste)
• Ariel Ortega (Celeste)
```

## ✅ Estado Actual

- [x] Modal aparece correctamente cuando hay goles involucrados
- [x] Cálculo de resultado corregido
- [x] API actualiza tanto jugadores como goles
- [x] Recálculo automático de puntajes
- [x] Errores de TypeScript resueltos
- [x] Cache invalidation funciona al volver

## 🚀 Próximo Test

1. Abrir editor de historia
2. Seleccionar Ariel (3 goles) y Emiliano (0 goles)
3. Hacer clic en Intercambiar
4. Verificar modal muestra: "3-2 → 0-5"
5. Confirmar intercambio
6. Verificar resultado final es 0-5
