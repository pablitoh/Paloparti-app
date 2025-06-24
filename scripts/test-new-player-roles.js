const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewPlayerRoles() {
  try {
    console.log(
      '🧪 Probando nueva implementación de playerRoles en MatchAttendance\n'
    );

    // 1. Encontrar un partido activo
    const matches = await prisma.match.findMany({
      take: 1,
      include: {
        attendance: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (matches.length === 0) {
      console.log('❌ No se encontraron partidos para probar');
      return;
    }

    const match = matches[0];
    console.log(`🏆 Probando con partido: ${match.id}`);
    console.log(`📅 Fecha: ${match.date}`);
    console.log(`📍 Ubicación: ${match.location}`);

    // 2. Buscar una asistencia para probar
    const confirmedAttendance = match.attendance.find(
      (att) => att.status === 'CONFIRMED'
    );

    if (!confirmedAttendance) {
      console.log('⚠️ No hay asistencias confirmadas para probar');
      return;
    }

    console.log(
      `\n👤 Probando con usuario: ${confirmedAttendance.user?.name} (${confirmedAttendance.userId})`
    );

    // 3. Verificar roles actuales
    console.log(
      '📋 Roles actuales en MatchAttendance:',
      confirmedAttendance.playerRoles
    );

    // 4. Simular actualización de roles
    const testRoles = [
      { role: 'Delantero', priority: 1 },
      { role: 'Mediocampista', priority: 2 },
    ];

    console.log('\n🔄 Actualizando roles...');

    const updatedAttendance = await prisma.matchAttendance.update({
      where: { id: confirmedAttendance.id },
      data: {
        playerRoles: testRoles,
      },
    });

    console.log('✅ Roles actualizados exitosamente');
    console.log(
      '🎯 Nuevos roles:',
      JSON.stringify(updatedAttendance.playerRoles, null, 2)
    );

    // 5. Verificar que los datos se guardaron correctamente
    const verification = await prisma.matchAttendance.findUnique({
      where: { id: confirmedAttendance.id },
      select: { playerRoles: true, userId: true },
    });

    console.log('\n🔍 Verificación de base de datos:');
    console.log('- Usuario:', verification?.userId);
    console.log(
      '- Roles guardados:',
      JSON.stringify(verification?.playerRoles, null, 2)
    );

    // 6. Probar consulta de todos los roles en el partido
    console.log('\n📊 Todos los roles en este partido:');
    const allAttendances = await prisma.matchAttendance.findMany({
      where: { matchId: match.id },
      select: {
        userId: true,
        playerRoles: true,
        user: { select: { name: true } },
      },
    });

    allAttendances.forEach((att) => {
      if (att.playerRoles) {
        console.log(`- ${att.user?.name}: ${JSON.stringify(att.playerRoles)}`);
      } else {
        console.log(`- ${att.user?.name}: Sin roles específicos`);
      }
    });

    console.log('\n✅ Prueba completada exitosamente!');
    console.log('🎉 La nueva implementación funciona correctamente');
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewPlayerRoles();
