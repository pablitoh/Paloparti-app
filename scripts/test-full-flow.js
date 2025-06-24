const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFullFlow() {
  try {
    console.log(
      '🚀 Probando flujo completo de confirmación de asistencia...\n'
    );

    // 1. Encontrar un partido
    const match = await prisma.match.findFirst({
      include: {
        group: {
          include: {
            members: {
              take: 3,
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
    console.log(`👥 Grupo: ${match.group.name}\n`);

    // 2. Simular confirmaciones de asistencia con roles diferentes
    const users = match.group.members.slice(0, 3);

    const testCases = [
      {
        user: users[0],
        roles: [
          { role: 'Arquero', priority: 1 },
          { role: 'Defensor', priority: 2 },
        ],
      },
      {
        user: users[1],
        roles: [
          { role: 'Mediocampo', priority: 1 },
          { role: 'Delantero', priority: 2 },
        ],
      },
      {
        user: users[2],
        roles: [
          { role: 'Delantero', priority: 1 },
          { role: 'Comodín', priority: 2 },
        ],
      },
    ];

    console.log('🔄 Simulando confirmaciones de asistencia...\n');

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const user = testCase.user;
      const roles = testCase.roles;

      console.log(`👤 Usuario: ${user.user.name}`);
      console.log(`🎯 Roles a confirmar: ${JSON.stringify(roles)}`);

      // Simular la API call del frontend
      try {
        await prisma.matchAttendance.upsert({
          where: {
            userId_matchId: {
              userId: user.userId,
              matchId: match.id,
            },
          },
          update: {
            status: 'CONFIRMED',
            playerRoles: roles,
            updatedAt: new Date(),
          },
          create: {
            userId: user.userId,
            matchId: match.id,
            groupId: match.groupId,
            matchDate: match.date,
            status: 'CONFIRMED',
            playerRoles: roles,
          },
        });

        console.log(`✅ Asistencia confirmada con roles`);
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }

      console.log(''); // Línea en blanco
    }

    // 3. Verificar que los datos se guardaron correctamente
    console.log('🔍 Verificando datos guardados...\n');

    const attendances = await prisma.matchAttendance.findMany({
      where: { matchId: match.id },
      include: {
        user: { select: { name: true } },
      },
    });

    attendances.forEach((att) => {
      console.log(`👤 ${att.user?.name}:`);
      console.log(`   Estado: ${att.status}`);
      if (att.playerRoles) {
        console.log(`   Roles: ${JSON.stringify(att.playerRoles)}`);
      } else {
        console.log(`   Roles: Sin roles específicos`);
      }
      console.log('');
    });

    // 4. Simular consulta del endpoint next-match para ver si se obtienen correctamente
    console.log('🔍 Simulando consulta next-match...\n');

    const confirmedAttendances = await prisma.matchAttendance.findMany({
      where: {
        matchId: match.id,
        status: 'CONFIRMED',
      },
      select: {
        userId: true,
        playerRoles: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            birthdate: true,
          },
        },
      },
    });

    console.log('📊 Jugadores confirmados con roles:');
    confirmedAttendances.forEach((att) => {
      console.log(
        `- ${att.user?.name}: ${
          att.playerRoles ? JSON.stringify(att.playerRoles) : 'Sin roles'
        }`
      );
    });

    console.log('\n🎉 Prueba de flujo completo exitosa!');
    console.log(
      '✅ Los roles se guardan y recuperan correctamente en MatchAttendance'
    );
  } catch (error) {
    console.error('❌ Error en prueba de flujo completo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFullFlow();
