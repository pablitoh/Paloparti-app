const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestAttendance() {
  try {
    console.log('🎯 Creando asistencias de prueba...\n');

    // 1. Encontrar un partido y grupo
    const match = await prisma.match.findFirst({
      include: {
        group: {
          include: {
            members: {
              take: 5, // Tomar 5 miembros para probar
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!match) {
      console.log('❌ No se encontraron partidos');
      return;
    }

    console.log(`🏆 Partido: ${match.id}`);
    console.log(`📅 Fecha: ${match.date}`);
    console.log(
      `👥 Grupo: ${match.group.name} (${match.group.members.length} miembros)\n`
    );

    // 2. Crear asistencias confirmadas con roles diferentes
    const testUsers = match.group.members.slice(0, 3); // Usar 3 usuarios para probar

    const testRolesOptions = [
      [
        { role: 'Delantero', priority: 1 },
        { role: 'Mediocampista', priority: 2 },
      ],
      [
        { role: 'Defensor', priority: 1 },
        { role: 'Delantero', priority: 2 },
      ],
      [
        { role: 'Arquero', priority: 1 },
        { role: 'Defensor', priority: 2 },
      ],
    ];

    console.log('🔄 Creando asistencias...');

    for (let i = 0; i < testUsers.length; i++) {
      const member = testUsers[i];
      const roles = testRolesOptions[i];

      // Verificar si ya existe asistencia
      const existingAttendance = await prisma.matchAttendance.findFirst({
        where: {
          userId: member.userId,
          matchId: match.id,
        },
      });

      if (existingAttendance) {
        // Actualizar existente
        await prisma.matchAttendance.update({
          where: { id: existingAttendance.id },
          data: {
            status: 'CONFIRMED',
            playerRoles: roles,
          },
        });
        console.log(
          `✅ Actualizada asistencia para ${member.user.name}: ${JSON.stringify(
            roles
          )}`
        );
      } else {
        // Crear nueva
        await prisma.matchAttendance.create({
          data: {
            userId: member.userId,
            matchId: match.id,
            groupId: match.groupId,
            matchDate: match.date,
            status: 'CONFIRMED',
            playerRoles: roles,
          },
        });
        console.log(
          `✅ Creada asistencia para ${member.user.name}: ${JSON.stringify(
            roles
          )}`
        );
      }
    }

    console.log('\n🎉 Asistencias de prueba creadas exitosamente!');
    console.log(`\n🧪 Ahora ejecuta: node scripts/test-new-player-roles.js`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAttendance();
