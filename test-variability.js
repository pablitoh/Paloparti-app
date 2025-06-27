// Simulación simplificada del algoritmo de balanceo para probar variabilidad
function createUnifiedBalancedTeams(members, options = {}) {
  const { addVariability = false } = options;

  console.log(`⚙️ Opciones: variabilidad=${addVariability}`);

  // Clasificar jugadores por posición
  const goalkeepers = members.filter((m) =>
    m.playerRoles.some((r) => r.role === 'Arquero' && r.priority === 1)
  );
  const defenders = members.filter((m) =>
    m.playerRoles.some((r) => r.role === 'Defensor' && r.priority === 1)
  );
  const others = members.filter(
    (m) =>
      !m.playerRoles.some((r) => r.role === 'Arquero' && r.priority === 1) &&
      !m.playerRoles.some((r) => r.role === 'Defensor' && r.priority === 1)
  );

  // Ordenar candidatos con variabilidad
  const sortCandidates = (candidates) => {
    return candidates.sort((a, b) => {
      // Criterio principal: rating
      if (a.starRating !== b.starRating) {
        return b.starRating - a.starRating;
      }

      // Si hay empate y se activó la variabilidad, agregar aleatoriedad
      if (addVariability) {
        return Math.random() - 0.5;
      }

      return 0;
    });
  };

  // Asignar arqueros
  const sortedGoalkeepers = sortCandidates([...goalkeepers]);
  const teamA = [];
  const teamB = [];

  if (sortedGoalkeepers.length >= 2) {
    teamA.push({ ...sortedGoalkeepers[0], assignedRole: 'Arquero' });
    teamB.push({ ...sortedGoalkeepers[1], assignedRole: 'Arquero' });
  } else if (sortedGoalkeepers.length === 1) {
    teamA.push({ ...sortedGoalkeepers[0], assignedRole: 'Arquero' });
    // Buscar otro arquero de emergencia
    const emergencyGK = members.find((m) =>
      m.playerRoles.some((r) => r.role === 'Arquero' && r.priority === 2)
    );
    if (emergencyGK) {
      teamB.push({ ...emergencyGK, assignedRole: 'Arquero' });
    }
  }

  // Asignar defensores
  const sortedDefenders = sortCandidates([...defenders]);
  for (let i = 0; i < sortedDefenders.length; i++) {
    const player = sortedDefenders[i];
    if (teamA.length <= teamB.length) {
      teamA.push({ ...player, assignedRole: 'Defensor' });
    } else {
      teamB.push({ ...player, assignedRole: 'Defensor' });
    }
  }

  // Asignar otros jugadores
  const sortedOthers = sortCandidates([...others]);
  for (let i = 0; i < sortedOthers.length; i++) {
    const player = sortedOthers[i];
    const primaryRole = player.playerRoles[0].role;
    if (teamA.length <= teamB.length) {
      teamA.push({ ...player, assignedRole: primaryRole });
    } else {
      teamB.push({ ...player, assignedRole: primaryRole });
    }
  }

  return [teamA, teamB];
}

// Datos de prueba basados en los jugadores que vimos en los logs
const testMembers = [
  {
    id: 'cmcawwfbj0000yqdzg6fshweb',
    name: 'Lionel Messi',
    age: 38,
    starRating: 5,
    playerRoles: [
      { role: 'Arquero', priority: 1 },
      { role: 'Defensor', priority: 2 },
    ],
  },
  {
    id: 'cmcawwfbw0007yqdz8h7y2zqa',
    name: 'Ángel Di María',
    age: 37,
    starRating: 4,
    playerRoles: [
      { role: 'Arquero', priority: 1 },
      { role: 'Defensor', priority: 2 },
    ],
  },
  {
    id: 'cmcawwfcg000ryqdzw7c7tpe8',
    name: 'Alexis Mac Allister',
    age: 26,
    starRating: 4,
    playerRoles: [
      { role: 'Defensor', priority: 1 },
      { role: 'Delantero', priority: 2 },
    ],
  },
  {
    id: 'cmcawwfc2000cyqdzu5kdhfkx',
    name: 'Claudio Caniggia',
    age: 58,
    starRating: 5,
    playerRoles: [
      { role: 'Defensor', priority: 1 },
      { role: 'Mediocampo', priority: 2 },
    ],
  },
  {
    id: 'cmcawwfc7000hyqdz5ag75bfk',
    name: 'Ariel Ortega',
    age: 51,
    starRating: 5,
    playerRoles: [
      { role: 'Defensor', priority: 1 },
      { role: 'Delantero', priority: 2 },
    ],
  },
];

console.log('🧪 Probando variabilidad del algoritmo...\n');

const results = [];

// Ejecutar el algoritmo 10 veces
for (let i = 0; i < 10; i++) {
  console.log(`\n--- Ejecución ${i + 1} ---`);

  const [teamA, teamB] = createUnifiedBalancedTeams(testMembers, {
    addVariability: true,
  });

  const teamANames = teamA.map((p) => p.name).sort();
  const teamBNames = teamB.map((p) => p.name).sort();

  const result = {
    execution: i + 1,
    teamA: teamANames,
    teamB: teamBNames,
    teamASize: teamA.length,
    teamBSize: teamB.length,
  };

  results.push(result);

  console.log(`Equipo A (${teamA.length}): ${teamANames.join(', ')}`);
  console.log(`Equipo B (${teamB.length}): ${teamBNames.join(', ')}`);
}

// Analizar variabilidad
console.log('\n📊 ANÁLISIS DE VARIABILIDAD:');
console.log('============================');

const uniqueResults = new Set();
results.forEach((result) => {
  const key = `${result.teamA.join(',')}|${result.teamB.join(',')}`;
  uniqueResults.add(key);
});

console.log(`Total de ejecuciones: ${results.length}`);
console.log(`Resultados únicos: ${uniqueResults.size}`);
console.log(
  `Variabilidad: ${((uniqueResults.size / results.length) * 100).toFixed(1)}%`
);

if (uniqueResults.size === 1) {
  console.log('\n❌ NO HAY VARIABILIDAD - Todos los resultados son iguales');
} else {
  console.log('\n✅ HAY VARIABILIDAD - Se generaron resultados diferentes');

  // Mostrar las diferentes combinaciones
  console.log('\n🔍 DIFERENTES COMBINACIONES ENCONTRADAS:');
  const uniqueCombinations = Array.from(uniqueResults);
  uniqueCombinations.forEach((combination, index) => {
    const [teamA, teamB] = combination.split('|');
    console.log(`\nCombinación ${index + 1}:`);
    console.log(`  Equipo A: ${teamA.split(',').join(', ')}`);
    console.log(`  Equipo B: ${teamB.split(',').join(', ')}`);
  });
}

// Verificar si hay algún resultado que no sea el original
const originalResult = `${results[0].teamA.join(',')}|${results[0].teamB.join(
  ','
)}`;
const differentResults = Array.from(uniqueResults).filter(
  (result) => result !== originalResult
);

if (differentResults.length > 0) {
  console.log('\n🎯 RESULTADO DIFERENTE AL ORIGINAL:');
  const [teamA, teamB] = differentResults[0].split('|');
  console.log(`Equipo A: ${teamA.split(',').join(', ')}`);
  console.log(`Equipo B: ${teamB.split(',').join(', ')}`);
} else {
  console.log('\n⚠️ No se encontraron resultados diferentes al original');
}
