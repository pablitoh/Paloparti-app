const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTeamColors() {
  try {
    console.log('🧪 Probando funcionalidad de colores de equipos...');

    // Buscar un grupo existente
    const group = await prisma.group.findFirst({
      select: {
        id: true,
        name: true,
        teamAName: true,
        teamBName: true,
        teamAColor: true,
        teamBColor: true,
        lastSortingCriteria: true,
      },
    });

    if (!group) {
      console.log('❌ No se encontraron grupos para probar');
      return;
    }

    console.log('📋 Grupo encontrado:', {
      id: group.id,
      name: group.name,
      teamAName: group.teamAName,
      teamBName: group.teamBName,
      teamAColor: group.teamAColor,
      teamBColor: group.teamBColor,
      lastSortingCriteria: group.lastSortingCriteria,
    });

    // Actualizar colores de equipos
    const updatedGroup = await prisma.group.update({
      where: { id: group.id },
      data: {
        teamAColor: '#10B981', // Verde
        teamBColor: '#8B5CF6', // Púrpura
        lastSortingCriteria: {
          balanceByAge: true,
          balanceByRole: true,
          balanceByRating: false,
          isRandomMode: false,
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log('✅ Grupo actualizado:', {
      teamAColor: updatedGroup.teamAColor,
      teamBColor: updatedGroup.teamBColor,
      lastSortingCriteria: updatedGroup.lastSortingCriteria,
    });

    console.log('🎉 Prueba completada exitosamente');
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTeamColors();
