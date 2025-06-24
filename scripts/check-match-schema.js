const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Verificar estructura de la tabla Match
    console.log('🔍 Verificando esquema de la tabla Match...\n');

    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Match' 
      ORDER BY ordinal_position;
    `;

    console.log('📋 Columnas en la tabla Match:');
    result.forEach((col) => {
      console.log(
        `- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`
      );
    });

    // Verificar específicamente playerRoles
    const playerRolesColumn = result.find(
      (col) => col.column_name === 'playerRoles'
    );

    if (playerRolesColumn) {
      console.log('\n✅ Campo playerRoles encontrado:');
      console.log(`   Tipo: ${playerRolesColumn.data_type}`);
      console.log(`   Nullable: ${playerRolesColumn.is_nullable}`);
    } else {
      console.log('\n❌ Campo playerRoles NO encontrado en la tabla Match');
    }

    // Verificar un partido específico
    console.log('\n🎯 Verificando datos de playerRoles en el último partido:');
    const match = await prisma.match.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        playerRoles: true,
      },
    });

    if (match) {
      console.log(`Partido ID: ${match.id}`);
      console.log(`PlayerRoles tipo: ${typeof match.playerRoles}`);
      console.log(
        `PlayerRoles valor: ${JSON.stringify(match.playerRoles, null, 2)}`
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
