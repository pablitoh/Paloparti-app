import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface PlayerRole {
  role: string;
  level: number;
}

type JsonObject = { [Key in string]?: Prisma.JsonValue };

interface TbdData extends JsonObject {
  playerRoles?: Record<string, PlayerRole[]>;
}

async function migratePlayerRoles() {
  console.log('🚀 Iniciando migración de roles de jugadores...');

  try {
    // Obtener todos los partidos que tienen tbdPlayers
    const matches = await prisma.match.findMany({
      where: {
        tbdPlayers: {
          not: null,
        },
      },
      include: {
        attendance: true,
      },
    });

    console.log(`📋 Encontrados ${matches.length} partidos para revisar`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const match of matches) {
      try {
        // Parsear tbdPlayers
        let tbdData: TbdData = {};
        if (match.tbdPlayers) {
          if (typeof match.tbdPlayers === 'string') {
            tbdData = JSON.parse(match.tbdPlayers);
          } else {
            tbdData = match.tbdPlayers as TbdData;
          }
        }

        // Verificar si tiene playerRoles en tbdPlayers
        if (
          tbdData.playerRoles &&
          Object.keys(tbdData.playerRoles).length > 0
        ) {
          const playerRolesData = tbdData.playerRoles;

          console.log(`📝 Migrando partido ${match.id}:`, {
            playersWithRoles: Object.keys(playerRolesData).length,
          });

          // Actualizar las asistencias con los roles correspondientes
          for (const [userId, roles] of Object.entries(playerRolesData)) {
            const attendance = match.attendance.find(
              (a) => a.userId === userId
            );
            if (attendance) {
              const jsonRoles = roles.map((r) => ({
                role: r.role,
                level: r.level,
              }));

              await prisma.matchAttendance.update({
                where: { id: attendance.id },
                data: {
                  playerRoles: jsonRoles as unknown as Prisma.InputJsonValue,
                },
              });
            }
          }

          // Limpiar playerRoles de tbdPlayers pero mantener el resto
          const cleanedTbdData = { ...tbdData };
          delete cleanedTbdData.playerRoles;

          // Solo actualizar tbdPlayers si aún tiene contenido
          const updatedTbdPlayers =
            Object.keys(cleanedTbdData).length > 0 ? cleanedTbdData : null;

          await prisma.match.update({
            where: { id: match.id },
            data: {
              tbdPlayers: updatedTbdPlayers as Prisma.InputJsonValue,
            },
          });

          migratedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error procesando partido ${match.id}:`, error);
      }
    }

    console.log('✅ Migración completada:');
    console.log(`   - Partidos migrados: ${migratedCount}`);
    console.log(`   - Partidos omitidos: ${skippedCount}`);

    // Verificar algunos resultados
    const updatedMatches = await prisma.match.findMany({
      where: {
        attendance: {
          some: {
            NOT: {
              playerRoles: null,
            },
          },
        },
      },
      include: {
        attendance: true,
      },
      take: 3,
    });

    console.log('\n🔍 Verificación - Primeros 3 partidos migrados:');
    updatedMatches.forEach((match, index) => {
      console.log(`${index + 1}. Partido ${match.id}:`);
      console.log('   Asistencias:', match.attendance.length);
      console.log('   tbdPlayers:', match.tbdPlayers);
    });
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
migratePlayerRoles()
  .then(() => {
    console.log('🎉 Migración finalizada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
