const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Obtener el último partido
    const lastMatch = await prisma.match.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        playerRoles: true,
        createdAt: true,
        groupId: true,
      },
    });

    if (!lastMatch) {
      console.log('❌ No hay partidos');
      return;
    }

    console.log('🏆 Último partido:');
    console.log('ID:', lastMatch.id);
    console.log('Grupo:', lastMatch.groupId);
    console.log('Creado:', lastMatch.createdAt);

    console.log('\n🎯 PlayerRoles:');
    if (lastMatch.playerRoles) {
      const roles =
        typeof lastMatch.playerRoles === 'string'
          ? JSON.parse(lastMatch.playerRoles)
          : lastMatch.playerRoles;

      console.log('Total usuarios con roles:', Object.keys(roles).length);

      for (const [userId, playerRoles] of Object.entries(roles)) {
        console.log(`${userId}: ${JSON.stringify(playerRoles)}`);
      }
    } else {
      console.log('❌ No hay playerRoles');
    }

    // Verificar asistencias confirmadas
    console.log('\n✅ Asistencias confirmadas:');
    const attendances = await prisma.matchAttendance.findMany({
      where: {
        matchId: lastMatch.id,
        status: 'CONFIRMED',
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    console.log(`Total: ${attendances.length}`);
    attendances.forEach((att) => {
      console.log(`- ${att.user?.name} (${att.userId})`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
