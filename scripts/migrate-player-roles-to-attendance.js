const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Iniciando migración de playerRoles...\n');

    // 1. Obtener todos los partidos que tienen playerRoles
    const matchesWithRoles = await prisma.match.findMany({
      where: {
        playerRoles: {
          not: null,
        },
      },
      select: {
        id: true,
        playerRoles: true,
        attendance: {
          select: {
            id: true,
            userId: true,
            playerRoles: true,
          },
        },
      },
    });

    console.log(
      `📊 Encontrados ${matchesWithRoles.length} partidos con roles\n`
    );

    let totalMigrated = 0;
    let totalSkipped = 0;

    // 2. Para cada partido
    for (const match of matchesWithRoles) {
      console.log(`🏆 Procesando partido: ${match.id}`);

      // Parsear roles del partido
      const matchRoles =
        typeof match.playerRoles === 'string'
          ? JSON.parse(match.playerRoles)
          : match.playerRoles;

      console.log(
        `   Roles encontrados para ${Object.keys(matchRoles).length} usuarios`
      );

      // 3. Para cada usuario con roles en el partido
      for (const [userId, userRoles] of Object.entries(matchRoles)) {
        // Buscar la asistencia de este usuario para este partido
        const attendance = match.attendance.find(
          (att) => att.userId === userId
        );

        if (!attendance) {
          console.log(`   ⚠️ No se encontró asistencia para usuario ${userId}`);
          totalSkipped++;
          continue;
        }

        // Verificar si ya tiene roles
        if (attendance.playerRoles) {
          console.log(`   ⏭️ Usuario ${userId} ya tiene roles en asistencia`);
          totalSkipped++;
          continue;
        }

        // Migrar roles a la asistencia
        try {
          await prisma.matchAttendance.update({
            where: { id: attendance.id },
            data: {
              playerRoles: userRoles,
            },
          });

          console.log(
            `   ✅ Migrado usuario ${userId}: ${JSON.stringify(userRoles)}`
          );
          totalMigrated++;
        } catch (error) {
          console.error(
            `   ❌ Error migrando usuario ${userId}:`,
            error.message
          );
        }
      }

      console.log(''); // Línea en blanco
    }

    console.log('📈 RESUMEN DE MIGRACIÓN:');
    console.log(`✅ Total migrados: ${totalMigrated}`);
    console.log(`⏭️ Total omitidos: ${totalSkipped}`);

    if (totalMigrated > 0) {
      console.log('\n🎯 Verificando migración...');

      // Verificar que los datos se migraron correctamente
      const attendancesWithRoles = await prisma.matchAttendance.findMany({
        where: {
          playerRoles: { not: null },
        },
        select: {
          userId: true,
          playerRoles: true,
          user: { select: { name: true } },
        },
      });

      console.log(
        `\n✅ ${attendancesWithRoles.length} asistencias ahora tienen roles:`
      );
      attendancesWithRoles.forEach((att) => {
        console.log(
          `- ${att.user?.name} (${att.userId}): ${JSON.stringify(
            att.playerRoles
          )}`
        );
      });
    }
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

console.log(
  '🚀 Iniciando migración de playerRoles de Match → MatchAttendance\n'
);
main();
