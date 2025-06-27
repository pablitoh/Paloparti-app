// Simular el entorno de Node.js para usar el algoritmo directamente
const {
  createStructuredBalancedTeams,
} = require('./lib/matches/unifiedBalancer');

// Simular datos de jugadores con diferentes edades y ratings para probar balanceo
const mockMembers = [
  {
    id: '1',
    name: 'Lionel Messi',
    age: 36,
    starRating: 5,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '2',
    name: 'Cristiano Ronaldo',
    age: 38,
    starRating: 5,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '3',
    name: 'Neymar',
    age: 31,
    starRating: 4,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '4',
    name: 'Kylian Mbappé',
    age: 24,
    starRating: 5,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '5',
    name: 'Kevin De Bruyne',
    age: 32,
    starRating: 4,
    playerRoles: [{ role: 'Mediocampo', priority: 1 }],
  },
  {
    id: '6',
    name: 'Luka Modrić',
    age: 37,
    starRating: 4,
    playerRoles: [{ role: 'Mediocampo', priority: 1 }],
  },
  {
    id: '7',
    name: 'Virgil van Dijk',
    age: 32,
    starRating: 4,
    playerRoles: [{ role: 'Defensor', priority: 1 }],
  },
  {
    id: '8',
    name: 'Sergio Ramos',
    age: 37,
    starRating: 4,
    playerRoles: [{ role: 'Defensor', priority: 1 }],
  },
  {
    id: '9',
    name: 'Manuel Neuer',
    age: 37,
    starRating: 4,
    playerRoles: [{ role: 'Arquero', priority: 1 }],
  },
  {
    id: '10',
    name: 'Alisson',
    age: 30,
    starRating: 4,
    playerRoles: [{ role: 'Arquero', priority: 1 }],
  },
  {
    id: '11',
    name: 'Erling Haaland',
    age: 23,
    starRating: 5,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '12',
    name: 'Jude Bellingham',
    age: 20,
    starRating: 4,
    playerRoles: [{ role: 'Mediocampo', priority: 1 }],
  },
  {
    id: '13',
    name: 'Vinícius Jr.',
    age: 23,
    starRating: 4,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '14',
    name: 'Mohamed Salah',
    age: 31,
    starRating: 4,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '15',
    name: 'Harry Kane',
    age: 30,
    starRating: 4,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
  {
    id: '16',
    name: 'Bruno Fernandes',
    age: 29,
    starRating: 4,
    playerRoles: [{ role: 'Mediocampo', priority: 1 }],
  },
  {
    id: '17',
    name: 'Frenkie de Jong',
    age: 26,
    starRating: 4,
    playerRoles: [{ role: 'Mediocampo', priority: 1 }],
  },
  {
    id: '18',
    name: 'Rúben Dias',
    age: 26,
    starRating: 4,
    playerRoles: [{ role: 'Defensor', priority: 1 }],
  },
  {
    id: '19',
    name: 'Thiago Silva',
    age: 39,
    starRating: 4,
    playerRoles: [{ role: 'Defensor', priority: 1 }],
  },
  {
    id: '20',
    name: 'Marc-André ter Stegen',
    age: 31,
    starRating: 4,
    playerRoles: [{ role: 'Arquero', priority: 1 }],
  },
  {
    id: '21',
    name: 'Ederson',
    age: 30,
    starRating: 4,
    playerRoles: [{ role: 'Arquero', priority: 1 }],
  },
  {
    id: '22',
    name: 'Rafael Leão',
    age: 24,
    starRating: 4,
    playerRoles: [{ role: 'Delantero', priority: 1 }],
  },
];

// Función para probar diferentes configuraciones de balanceo
function testBalanceConfigurations() {
  console.log('🧪 === PRUEBA DE VARIABILIDAD CON DIFERENTES CRITERIOS ===\n');

  const configurations = [
    {
      name: 'Solo por posición',
      options: {
        balanceByAge: false,
        balanceByRating: false,
        balanceByRole: true,
        addVariability: true,
      },
    },
    {
      name: 'Por posición + edad',
      options: {
        balanceByAge: true,
        balanceByRating: false,
        balanceByRole: true,
        addVariability: true,
      },
    },
    {
      name: 'Por posición + rating',
      options: {
        balanceByAge: false,
        balanceByRating: true,
        balanceByRole: true,
        addVariability: true,
      },
    },
    {
      name: 'Los 3 criterios',
      options: {
        balanceByAge: true,
        balanceByRating: true,
        balanceByRole: true,
        addVariability: true,
      },
    },
  ];

  // Equipos previos para comparar
  const previousTeams = {
    teamA: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    teamB: ['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'],
  };

  configurations.forEach((config) => {
    console.log(`\n🎯 === PROBANDO: ${config.name} ===`);

    const results = [];
    const numTests = 5;

    for (let i = 0; i < numTests; i++) {
      console.log(`\n🔄 Ejecutando prueba ${i + 1}/${numTests}...`);

      try {
        // Llamar directamente al algoritmo
        const [teamA, teamB] = createStructuredBalancedTeams(
          mockMembers,
          config.options,
          previousTeams
        );

        // Extraer IDs de los equipos
        const teamAIds = teamA.map((p) => p.id).sort();
        const teamBIds = teamB.map((p) => p.id).sort();

        // Calcular estadísticas de balance
        const avgAgeA =
          teamA.reduce((sum, p) => sum + (p.age || 25), 0) / teamA.length;
        const avgAgeB =
          teamB.reduce((sum, p) => sum + (p.age || 25), 0) / teamB.length;
        const avgRatingA =
          teamA.reduce((sum, p) => sum + (p.starRating || 3), 0) / teamA.length;
        const avgRatingB =
          teamB.reduce((sum, p) => sum + (p.starRating || 3), 0) / teamB.length;

        results.push({
          test: i + 1,
          teamA: teamAIds,
          teamB: teamBIds,
          teamAString: teamAIds.join(','),
          teamBString: teamBIds.join(','),
          avgAgeA: avgAgeA.toFixed(1),
          avgAgeB: avgAgeB.toFixed(1),
          avgRatingA: avgRatingA.toFixed(1),
          avgRatingB: avgRatingB.toFixed(1),
          ageDiff: Math.abs(avgAgeA - avgAgeB).toFixed(1),
          ratingDiff: Math.abs(avgRatingA - avgRatingB).toFixed(1),
        });

        console.log(`✅ Prueba ${i + 1} completada`);
        console.log(`   Equipo A: ${teamAIds.join(', ')}`);
        console.log(`   Equipo B: ${teamBIds.join(', ')}`);
        console.log(
          `   Edad: A=${avgAgeA.toFixed(1)}, B=${avgAgeB.toFixed(
            1
          )} (diff: ${Math.abs(avgAgeA - avgAgeB).toFixed(1)})`
        );
        console.log(
          `   Rating: A=${avgRatingA.toFixed(1)}, B=${avgRatingB.toFixed(
            1
          )} (diff: ${Math.abs(avgRatingA - avgRatingB).toFixed(1)})`
        );
      } catch (error) {
        console.error(`❌ Error en prueba ${i + 1}:`, error.message);
      }
    }

    // Analizar resultados para esta configuración
    console.log(`\n📊 === ANÁLISIS: ${config.name} ===`);

    if (results.length === 0) {
      console.log('❌ No se pudieron completar pruebas');
      return;
    }

    // Verificar si todos los resultados son iguales
    const firstResult = results[0];
    const allSame = results.every(
      (result) =>
        result.teamAString === firstResult.teamAString &&
        result.teamBString === firstResult.teamBString
    );

    if (allSame) {
      console.log('❌ TODOS LOS RESULTADOS SON IGUALES - No hay variabilidad');
      console.log('   Equipo A:', firstResult.teamA.join(', '));
      console.log('   Equipo B:', firstResult.teamB.join(', '));
    } else {
      console.log('✅ HAY VARIABILIDAD - Se generaron resultados diferentes');

      // Mostrar las diferentes combinaciones
      const uniqueCombinations = new Set();
      results.forEach((result) => {
        uniqueCombinations.add(`${result.teamAString}|${result.teamBString}`);
      });

      console.log(
        `\n🎯 Se encontraron ${uniqueCombinations.size} combinaciones únicas:`
      );
      Array.from(uniqueCombinations).forEach((combination, index) => {
        const [teamA, teamB] = combination.split('|');
        const result = results.find(
          (r) => r.teamAString === teamA && r.teamBString === teamB
        );
        console.log(`\n   Combinación ${index + 1}:`);
        console.log(`   Equipo A: ${teamA.split(',').join(', ')}`);
        console.log(`   Equipo B: ${teamB.split(',').join(', ')}`);
        if (result) {
          console.log(
            `   Edad: A=${result.avgAgeA}, B=${result.avgAgeB} (diff: ${result.ageDiff})`
          );
          console.log(
            `   Rating: A=${result.avgRatingA}, B=${result.avgRatingB} (diff: ${result.ratingDiff})`
          );
        }
      });
    }

    // Verificar si hay algún resultado diferente al original
    const originalTeamA = [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
    ];
    const originalTeamB = [
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
      '21',
      '22',
    ];

    const differentFromOriginal = results.some(
      (result) =>
        result.teamAString !== originalTeamA.join(',') ||
        result.teamBString !== originalTeamB.join(',')
    );

    if (differentFromOriginal) {
      console.log(
        '\n🎉 ¡ÉXITO! Se encontraron resultados diferentes al original'
      );
    } else {
      console.log('\n⚠️ No se encontraron resultados diferentes al original');
    }
  });
}

// Ejecutar la prueba
testBalanceConfigurations();
