import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTbdPlayerRoles() {
  console.log('🧹 Iniciando limpieza de playerRoles en tbdPlayers...');

  try {
    // Obtener todos los partidos que tienen tbdPlayers y playerRoles
    const matches = await prisma.match.findMany({
      where: {
        AND: [
          { tbdPlayers: { not: undefined } },
          { playerRoles: { not: undefined } },
        ],
      },
      select: {
        id: true,
        tbdPlayers: true,
        playerRoles: true,
      },
    });

    console.log(`📋 Encontrados ${matches.length} partidos para limpiar`);

    let cleanedCount = 0;

    for (const match of matches) {
      try {
        // Parsear tbdPlayers
        let tbdData: any = {};
        if (match.tbdPlayers) {
          if (typeof match.tbdPlayers === 'string') {
            tbdData = JSON.parse(match.tbdPlayers);
          } else {
            tbdData = match.tbdPlayers;
          }
        }

        // Verificar si aún tiene playerRoles en tbdPlayers
        if (tbdData.playerRoles) {
          console.log(`🧹 Limpiando partido ${match.id}`);

          // Remover playerRoles de tbdPlayers
          const cleanedTbdData = { ...tbdData };
          delete cleanedTbdData.playerRoles;

          // Solo actualizar tbdPlayers si aún tiene contenido, sino null
          const updatedTbdPlayers =
            Object.keys(cleanedTbdData).length > 0 ? cleanedTbdData : undefined;

          await prisma.match.update({
            where: { id: match.id },
            data: {
              tbdPlayers: updatedTbdPlayers,
            },
          });

          cleanedCount++;
        }
      } catch (error) {
        console.error(`❌ Error procesando partido ${match.id}:`, error);
      }
    }

    console.log('✅ Limpieza completada:');
    console.log(`   - Partidos limpiados: ${cleanedCount}`);

    // Verificar algunos resultados
    const verifyMatches = await prisma.match.findMany({
      where: {
        playerRoles: { not: undefined },
      },
      select: {
        id: true,
        playerRoles: true,
        tbdPlayers: true,
      },
      take: 3,
    });

    console.log('\n🔍 Verificación final - Primeros 3 partidos:');
    verifyMatches.forEach((match, index) => {
      console.log(`${index + 1}. Partido ${match.id}:`);
      console.log('   playerRoles:', match.playerRoles);

      // Verificar que tbdPlayers no tenga playerRoles
      let tbdData: any = {};
      if (match.tbdPlayers) {
        if (typeof match.tbdPlayers === 'string') {
          tbdData = JSON.parse(match.tbdPlayers);
        } else {
          tbdData = match.tbdPlayers;
        }
      }

      console.log(
        '   tbdPlayers.playerRoles:',
        tbdData.playerRoles ? 'EXISTE (ERROR)' : 'LIMPIO ✓'
      );
      console.log(
        '   tbdPlayers (resto):',
        Object.keys(tbdData).filter((k) => k !== 'playerRoles')
      );
    });
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la limpieza
cleanupTbdPlayerRoles()
  .then(() => {
    console.log('🎉 Limpieza finalizada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
