# Tests del Sistema de Creación de Equipos

Este directorio contiene los tests para el sistema de creación y balance de equipos. Los tests verifican diferentes escenarios y casos límite para asegurar que el sistema funcione correctamente.

## Escenarios Cubiertos

### 1. Equipos con Menos Jugadores de los Requeridos

- Test con 6 jugadores total (3 vs 3)
- Test con 8 jugadores total (4 vs 4)
- Verifica que:
  - Los equipos tengan igual número de jugadores
  - **AMBOS** equipos tengan arquero
  - Los roles se distribuyan de manera balanceada
  - La diferencia de edad promedio sea ≤ 5 años
  - La diferencia de rating promedio sea ≤ 1 punto

### 2. Tests de Criterios Individuales

- **Balance por Edad**:
  - Verifica que la diferencia de edad promedio sea ≤ 5 años
  - Ignora otros criterios de balance
- **Balance por Rating**:
  - Verifica que la diferencia de rating promedio sea ≤ 1 punto
  - Ignora otros criterios de balance
- **Balance por Rol**:
  - Verifica que cada equipo tenga al menos 3 roles diferentes
  - Garantiza arquero en ambos equipos
  - Ignora edad y rating

### 3. Escenarios con Posiciones Forzadas

- **Test con Posiciones Forzadas Mixtas**:
  - Jugadores con posiciones forzadas mantienen su rol
  - Se mantiene el balance general de equipos
  - Verifica arqueros, edad y rating
- **Test con Múltiples Posiciones Forzadas**:
  - Maneja varios jugadores con posiciones forzadas
  - Distribuye jugadores forzados equitativamente
  - Mantiene balance general a pesar de restricciones

### 4. Equipos con Roles Homogéneos

- Test con equipo compuesto solo por defensores
- Verifica que:
  - Se asignen roles diferentes según necesidad
  - Se garantice la presencia de arqueros
  - Los equipos mantengan balance numérico

### 5. Equipos sin Arquero

- Test con equipo sin arqueros naturales
- Verifica que:
  - Se asignen arqueros de otros roles
  - Se prioricen comodines para el rol de arquero
  - Ambos equipos tengan arquero asignado

### 6. Arqueros de Rol Secundario

- Test con jugadores que tienen arquero como rol secundario
- Verifica que:
  - Se prioricen jugadores con rol secundario de arquero
  - Se respete la distribución de roles principal cuando sea posible
  - Se mantenga el balance general del equipo

### 7. Formaciones Estándar

- Test de formación 4-3-3
- Test de formación 4-4-2
- Verifica que:
  - Se respeten las formaciones cuando hay suficientes jugadores
  - Se distribuyan los roles correctamente
  - Se mantenga el balance entre equipos

## Criterios de Balance

El sistema utiliza tres criterios principales de balance que pueden combinarse:

1. **Balance por Rol (`balanceByRole`):**

   - Garantiza distribución equitativa de posiciones
   - Prioriza roles naturales sobre roles asignados
   - Maneja casos especiales como falta de arqueros
   - **Restricción**: Ambos equipos DEBEN tener arquero

2. **Balance por Edad (`balanceByAge`):**

   - Distribuye jugadores para tener promedio de edad similar
   - Diferencia máxima permitida: 5 años entre promedios
   - Considera edad real de cada jugador

3. **Balance por Nivel (`balanceByRating`):**
   - Equilibra el nivel de habilidad (star rating) entre equipos
   - Diferencia máxima permitida: 1 punto entre promedios
   - Escala de rating: 0-5 puntos

## Posiciones Forzadas

El sistema maneja jugadores con posiciones forzadas:

- Respeta la posición forzada del jugador
- Distribuye jugadores forzados equitativamente
- Mantiene balance general a pesar de restricciones
- No permite cambiar el rol de jugadores forzados

## Cómo Ejecutar los Tests

1. **Ejecutar todos los tests:**

   ```bash
   npm test
   ```

2. **Ejecutar solo los tests de TeamBuilder:**

   ```bash
   npm test -- __tests__/lib/teambuilder/TeamBuilder.test.ts
   ```

3. **Ejecutar un escenario específico:**

   ```bash
   npm test -- -t "debería manejar 6 jugadores total"
   ```

4. **Ejecutar tests de un criterio específico:**
   ```bash
   npm test -- -t "debería balancear solo por edad"
   ```

## Notas Importantes

1. **Prioridad de Arqueros:**

   - Primero se buscan arqueros naturales
   - Luego arqueros de rol secundario
   - Después comodines
   - Como último recurso, se convierten otros roles
   - **SIEMPRE** debe haber un arquero en cada equipo

2. **Formaciones:**

   - Se respetan 4-3-3 y 4-4-2 cuando hay suficientes jugadores
   - En equipos pequeños se prioriza balance sobre formación

3. **Jugadores TBD:**

   - No se agregan si hay suficientes jugadores reales
   - Se usan solo para completar formaciones cuando es necesario

4. **Balance General:**
   - Se verifica que la diferencia de edad sea ≤ 5 años
   - Se verifica que la diferencia de rating sea ≤ 1 punto
   - Se garantiza al menos 3 roles diferentes por equipo
   - Se distribuyen jugadores forzados equitativamente
